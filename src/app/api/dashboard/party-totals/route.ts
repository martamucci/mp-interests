import { NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { PartyTotalsResponse } from '@/types/api'

export const revalidate = 3600

export async function GET() {
  try {
    const supabase = createAPIClient()

    const { data, error } = await supabase
      .from('mv_party_totals')
      .select('*')
      .order('total_amount', { ascending: false })

    if (error) throw error

    const { data: syncData } = await supabase
      .from('sync_log')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    const response: PartyTotalsResponse = {
      data: data || [],
      lastUpdated: syncData?.[0]?.completed_at || new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Party totals error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch party totals' },
      { status: 500 }
    )
  }
}
