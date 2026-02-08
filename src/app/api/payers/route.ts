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

    const supabase = createAPIClient(true)

    // Query payers with their payments for live data
    let query = supabase
      .from('payers')
      .select(`
        id,
        name,
        payer_type,
        payer_subtype,
        payments(amount, member_id)
      `)
      .order('id')
      .limit(10000)

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
          if (payment.member_id) {
            entry.mp_count.add(payment.member_id)
          }
        }
      }
    }

    const payerNameToId = new Map<string, number>()
    for (const payer of rawPayers || []) {
      if (payer.name) {
        payerNameToId.set(payer.name.toLowerCase(), payer.id)
      }
    }

    const { data: unlinkedPayments } = await supabase
      .from('payments')
      .select('payer_name, amount, member_id')
      .is('payer_id', null)
      .not('payer_name', 'is', null)

    for (const payment of unlinkedPayments || []) {
      const nameKey = payment.payer_name?.toLowerCase()
      if (!nameKey) continue
      const payerId = payerNameToId.get(nameKey)
      if (!payerId) continue
      const entry = payerMap.get(payerId)
      if (!entry) continue
      if (payment.amount) {
        entry.total_paid += payment.amount
        entry.payment_count++
        if (payment.member_id) {
          entry.mp_count.add(payment.member_id)
        }
      }
    }

    // Convert to array, filter out zero payments, and sort
    let payers = Array.from(payerMap.values())
      .map(p => ({
        ...p,
        mp_count: p.mp_count.size
      }))
      .filter(p => p.total_paid > 0 || p.payment_count > 0)

    payers.sort((a, b) => sort === 'low'
      ? a.total_paid - b.total_paid
      : b.total_paid - a.total_paid
    )

    // Paginate
    const total = payers.length
    payers = payers.slice(offset, offset + limit)

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
      data: payers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
