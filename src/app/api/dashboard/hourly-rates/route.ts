import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { HourlyRatesResponse } from '@/types/api'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = createAPIClient()

    const { data, error } = await supabase
      .from('mv_hourly_rates')
      .select('*')
      .order('hourly_rate', { ascending: false })
      .limit(limit)

    if (error) throw error

    const response: HourlyRatesResponse = {
      data: data || [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Hourly rates error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hourly rates' },
      { status: 500 }
    )
  }
}
