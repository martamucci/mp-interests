import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { TopPayersResponse } from '@/types/api'
import type { PayerType } from '@/types/database'

export const revalidate = 0 // Disable caching to ensure fresh data

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'Government', 'Company', 'Individual'
    const limit = parseInt(searchParams.get('limit') || '5')

    const supabase = createAPIClient()

    // Query live data from payers table with payment aggregation
    let query = supabase
      .from('payers')
      .select(`
        id,
        name,
        payer_type,
        payer_subtype,
        payments(amount, member_id)
      `)

    if (type) {
      query = query.eq('payer_type', type)
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

    // Convert to array, filter out zero payments, sort, and limit
    const payers = Array.from(payerMap.values())
      .map(p => ({
        ...p,
        payer_type: p.payer_type as PayerType,
        mp_count: p.mp_count.size
      }))
      .filter(p => p.total_paid > 0)
      .sort((a, b) => b.total_paid - a.total_paid)
      .slice(0, limit)

    const response: TopPayersResponse = {
      data: payers,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Top payers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top payers' },
      { status: 500 }
    )
  }
}
