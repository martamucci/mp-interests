import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { TopPayersResponse } from '@/types/api'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'Government', 'Company', 'Individual'
    const limit = parseInt(searchParams.get('limit') || '5')

    const supabase = createAPIClient()

    let query = supabase
      .from('mv_top_payers')
      .select('*')
      .order('total_paid', { ascending: false })

    if (type) {
      query = query.eq('payer_type', type)
    }

    const { data, error } = await query.limit(limit)

    if (error) throw error

    const response: TopPayersResponse = {
      data: data || [],
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
