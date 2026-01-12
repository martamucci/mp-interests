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

    const supabase = createAPIClient()

    // Build query for members
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .eq('is_current', true)
      .order('name_list_as', { ascending: true })

    if (party) {
      query = query.eq('party_name', party)
    }

    if (search) {
      query = query.ilike('name_display', `%${search}%`)
    }

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: members, count, error } = await query

    if (error) throw error

    // Get payment totals for each member
    const memberIds = members?.map(m => m.id) || []

    const { data: paymentTotals } = await supabase
      .from('payments')
      .select('member_id, amount')
      .in('member_id', memberIds)

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

    const response: MPListResponse = {
      data: (members || []).map(m => ({
        id: m.id,
        name: m.name_display,
        party: m.party_name,
        partyColor: m.party_color || '#B18FCF',
        constituency: m.constituency,
        thumbnailUrl: m.thumbnail_url,
        totalInterests: totalsMap.get(m.id)?.totalInterests || 0,
        totalAmount: totalsMap.get(m.id)?.totalAmount || 0,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
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
