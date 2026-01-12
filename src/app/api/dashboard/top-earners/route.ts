import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { TopEarnersResponse } from '@/types/api'
import type { TopEarner } from '@/types/database'

// The 10 interest categories
const INTEREST_CATEGORIES = [
  'Employment and earnings',
  'Donations and other support (including loans) for activities as an MP',
  'Gifts, benefits and hospitality from UK sources',
  'Visits outside the UK',
  'Gifts and benefits from sources outside the UK',
  'Land and property (within or outside the UK)',
  'Shareholdings',
  'Miscellaneous',
  'Family members employed',
  'Family members engaged in third-party lobbying',
]

export const revalidate = 3600

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filterBy = searchParams.get('filterBy') // 'category' or 'party'
    const filterValue = searchParams.get('filterValue')
    const limit = parseInt(searchParams.get('limit') || '5')

    const supabase = createAPIClient()

    // Get category ID if filtering by category
    let categoryId: number | null = null
    if (filterBy === 'category' && filterValue) {
      // Try exact match first, then partial match
      let { data: category } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', filterValue)
        .single()

      // If no exact match, try contains match
      if (!category) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id, name')
          .ilike('name', `%${filterValue}%`)
        category = categories?.[0] || null
      }

      categoryId = category?.id || null
      console.log('Category filter:', filterValue, '-> ID:', categoryId)
    }

    // Build query based on filter type
    let query

    if (filterBy === 'category' && categoryId) {
      // Filter by category - aggregate payments by member for this category
      query = supabase.rpc('get_top_earners_by_category', {
        category_id_param: categoryId,
        limit_count: limit,
      })
    } else if (filterBy === 'party' && filterValue) {
      // Filter by party - aggregate payments by member for this party
      query = supabase.rpc('get_top_earners_by_party', {
        party_name_param: filterValue,
        limit_count: limit,
      })
    } else {
      // No filter - get top earners by total amount
      query = supabase.rpc('get_top_earners_by_member', { limit_count: limit })
    }

    const { data: earners, error } = await query

    if (error) throw error

    // Get filter options
    const [categoriesResult, partiesResult] = await Promise.all([
      supabase.from('categories').select('name'),
      supabase.from('members').select('party_name').eq('is_current', true),
    ])

    const categories = categoriesResult.data?.map(c => c.name) || INTEREST_CATEGORIES
    const parties = [...new Set(partiesResult.data?.map(p => p.party_name))] as string[]

    const response: TopEarnersResponse = {
      data: (earners || []) as TopEarner[],
      filterOptions: {
        categories: categories.sort(),
        parties: parties.sort(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Top earners error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top earners' },
      { status: 500 }
    )
  }
}
