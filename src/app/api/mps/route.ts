import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { MPListResponse } from '@/types/api'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const party = searchParams.get('party')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'az' // 'az' or 'high'

    const supabase = createAPIClient()

    // For proper sorting, we need to fetch ALL members first, then sort, then paginate
    let query = supabase
      .from('members')
      .select('*')
      .eq('is_current', true)

    if (party) {
      query = query.eq('party_name', party)
    }

    if (search) {
      query = query.ilike('name_display', `%${search}%`)
    }

    // For A-Z, we can use database sorting and pagination
    // For high-to-low, we need to fetch all and sort in memory
    if (sort === 'az') {
      query = query.order('name_list_as', { ascending: true })
    }

    const { data: allMembers, error } = await query

    if (error) throw error

    // Get ALL member IDs for payment totals
    const allMemberIds = allMembers?.map(m => m.id) || []

    // Get payment totals for ALL members - batch into chunks to avoid Supabase row limits
    let paymentTotals: { member_id: number; amount: number | null }[] = []
    if (allMemberIds.length > 0) {
      const BATCH_SIZE = 100
      const batches: number[][] = []
      for (let i = 0; i < allMemberIds.length; i += BATCH_SIZE) {
        batches.push(allMemberIds.slice(i, i + BATCH_SIZE))
      }

      // Fetch payments for each batch in parallel (with high limit to get all payments)
      const batchResults = await Promise.all(
        batches.map(batch =>
          supabase
            .from('payments')
            .select('member_id, amount')
            .in('member_id', batch)
            .limit(10000)
        )
      )

      // Combine all results
      for (const result of batchResults) {
        if (result.data) {
          paymentTotals.push(...result.data)
        }
      }
    }

    // Aggregate totals per member
    const totalsMap = new Map<number, { totalAmount: number; totalInterests: number }>()
    for (const payment of paymentTotals || []) {
      const existing = totalsMap.get(payment.member_id) || { totalAmount: 0, totalInterests: 0 }
      existing.totalAmount += payment.amount || 0
      existing.totalInterests += 1
      totalsMap.set(payment.member_id, existing)
    }

    // Get distinct parties for filter
    const { data: partiesData } = await supabase
      .from('members')
      .select('party_name')
      .eq('is_current', true)

    const parties = [...new Set(partiesData?.map(p => p.party_name))]

    // Map ALL members with their totals
    let mappedMembers = (allMembers || []).map(m => ({
      id: m.id,
      name: m.name_display,
      _sortName: m.name_list_as || m.name_display,
      party: m.party_name,
      partyColor: m.party_color || '#B18FCF',
      constituency: m.constituency,
      thumbnailUrl: m.thumbnail_url,
      totalInterests: totalsMap.get(m.id)?.totalInterests || 0,
      totalAmount: totalsMap.get(m.id)?.totalAmount || 0,
    }))

    // Sort based on sort parameter
    if (sort === 'high') {
      mappedMembers.sort((a, b) => b.totalAmount - a.totalAmount)
    }
    // For 'az', already sorted by database query

    // Calculate total count before pagination
    const totalCount = mappedMembers.length

    // Apply pagination AFTER sorting
    const offset = (page - 1) * limit
    const paginatedMembers = mappedMembers.slice(offset, offset + limit)

    // Remove _sortName before sending response
    const responseData = paginatedMembers.map(({ _sortName, ...rest }) => rest)

    const response: MPListResponse = {
      data: responseData,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filterOptions: {
        parties: parties.sort(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('MP list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MP list' },
      { status: 500 }
    )
  }
}
