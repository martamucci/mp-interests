import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_request: NextRequest, context: { params: { party: string } }) {
  try {
    const partyName = decodeURIComponent(context.params.party)
    const supabase = createAPIClient(true)

    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, party_color')
      .eq('party_name', partyName)
      .eq('is_current', true)

    if (membersError) throw membersError

    const memberIds = (members || []).map(member => member.id)
    if (memberIds.length === 0) {
      return NextResponse.json({
        party: {
          party_name: partyName,
          party_color: null,
          total_amount: 0,
          payment_count: 0,
          mp_count: 0,
        },
        categories: [],
      })
    }

    const partyColor = members?.find(member => member.party_color)?.party_color || null

    const payments: Array<{ amount: number | null; member_id: number; category_id: number }> = []
    const limit = 1000
    let offset = 0

    while (true) {
      const { data: chunk, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, member_id, category_id')
        .in('member_id', memberIds)
        .not('amount', 'is', null)
        .range(offset, offset + limit - 1)

      if (paymentsError) throw paymentsError
      payments.push(...(chunk || []))
      if (!chunk || chunk.length < limit) break
      offset += limit
    }

    let totalAmount = 0
    const mpIds = new Set<number>(memberIds)
    let paymentCount = 0

    for (const payment of payments || []) {
      const amount = payment.amount || 0
      totalAmount += amount
      paymentCount += 1
    }

    return NextResponse.json({
      party: {
        party_name: partyName,
        party_color: partyColor,
        total_amount: totalAmount,
        payment_count: paymentCount,
        mp_count: mpIds.size,
      },
    })
  } catch (error) {
    console.error('Party summary error:', error)
    return NextResponse.json({ error: 'Failed to fetch party summary' }, { status: 500 })
  }
}
