import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'

export const revalidate = 0 // Disable caching to ensure fresh data

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const payerType = searchParams.get('type') // 'Government', 'Company', 'Individual'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'high' // 'high' or 'low'
    const subtype = searchParams.get('subtype') || ''

    const supabase = createAPIClient()

    // First, get the payer IDs that match our filters with their payment aggregates
    // Use RPC to get live data from base tables instead of stale materialized view
    const { data: payerStats, error: statsError } = await supabase
      .rpc('get_payer_stats', {
        p_payer_type: payerType || null,
        p_search: search || null,
        p_subtype: subtype || null,
        p_limit: limit,
        p_offset: offset,
        p_sort_asc: sort === 'low'
      })

    if (statsError) {
      // Fallback to materialized view if RPC doesn't exist
      console.log('RPC not available, falling back to materialized view')
      return fallbackToMaterializedView(supabase, payerType, search, subtype, sort, limit, offset)
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('payers')
      .select('*', { count: 'exact', head: true })
      .eq(payerType ? 'payer_type' : 'id', payerType || undefined as any)

    // Get unique subtypes for the filter dropdown
    let subtypesQuery = supabase
      .from('payers')
      .select('payer_subtype')

    if (payerType) {
      subtypesQuery = subtypesQuery.eq('payer_type', payerType)
    }

    const { data: subtypesData } = await subtypesQuery

    const subtypes = [...new Set(
      (subtypesData || [])
        .map(p => p.payer_subtype)
        .filter((s): s is string => s !== null && s !== '')
    )].sort()

    return NextResponse.json({
      data: payerStats || [],
      pagination: {
        page,
        limit,
        total: payerStats?.length || 0,
        totalPages: Math.ceil((payerStats?.length || 0) / limit),
      },
      subtypes,
    })
  } catch (error) {
    console.error('Payers list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payers' },
      { status: 500 }
    )
  }
}

// Fallback function that queries the materialized view
async function fallbackToMaterializedView(
  supabase: ReturnType<typeof createAPIClient>,
  payerType: string | null,
  search: string,
  subtype: string,
  sort: string,
  limit: number,
  offset: number
) {
  // Build query using base payers table with payment aggregation
  // This is more complex but gives us live data

  // Get payers with their payment totals
  let query = supabase
    .from('payers')
    .select(`
      id,
      name,
      payer_type,
      payer_subtype,
      payments!inner(amount)
    `)

  if (payerType) {
    query = query.eq('payer_type', payerType)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  if (subtype) {
    query = query.eq('payer_subtype', subtype)
  }

  const { data: rawPayers, error } = await query

  if (error) throw error

  // Aggregate payments manually
  const payerMap = new Map<number, {
    payer_id: number
    name: string
    payer_type: string
    payer_subtype: string | null
    total_paid: number
    mp_count: Set<number>
    payment_count: number
  }>()

  for (const payer of rawPayers || []) {
    if (!payerMap.has(payer.id)) {
      payerMap.set(payer.id, {
        payer_id: payer.id,
        name: payer.name,
        payer_type: payer.payer_type,
        payer_subtype: payer.payer_subtype,
        total_paid: 0,
        mp_count: new Set(),
        payment_count: 0
      })
    }
    const entry = payerMap.get(payer.id)!
    for (const payment of payer.payments || []) {
      if (payment.amount) {
        entry.total_paid += payment.amount
        entry.payment_count++
      }
    }
  }

  // Convert to array and sort
  let payers = Array.from(payerMap.values()).map(p => ({
    ...p,
    mp_count: p.mp_count.size
  }))

  payers.sort((a, b) => sort === 'low'
    ? a.total_paid - b.total_paid
    : b.total_paid - a.total_paid
  )

  // Paginate
  const total = payers.length
  payers = payers.slice(offset, offset + limit)

  // Get unique subtypes
  let subtypesQuery = supabase
    .from('payers')
    .select('payer_subtype')

  if (payerType) {
    subtypesQuery = subtypesQuery.eq('payer_type', payerType)
  }

  const { data: subtypesData } = await subtypesQuery

  const subtypes = [...new Set(
    (subtypesData || [])
      .map(p => p.payer_subtype)
      .filter((s): s is string => s !== null && s !== '')
  )].sort()

  return NextResponse.json({
    data: payers,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    subtypes,
  })
}
