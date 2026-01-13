import { NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { DashboardSummaryResponse } from '@/types/api'
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

export const revalidate = 0 // Disable caching to ensure fresh data

export async function GET() {
  try {
    const supabase = createAPIClient()

    // Fetch all data in parallel
    const [
      partyTotalsResult,
      topPayersResult,
      categoriesResult,
      partiesResult,
      lastSyncResult,
      // Fetch top earners aggregated by member (not by role)
      topEarnersResult,
    ] = await Promise.all([
      supabase.from('mv_party_totals').select('*').order('total_amount', { ascending: false }),
      supabase.from('mv_top_payers').select('*'),
      supabase.from('categories').select('id, name'),
      supabase.from('members').select('party_name').eq('is_current', true),
      supabase.from('sync_log').select('completed_at').eq('status', 'completed').order('completed_at', { ascending: false }).limit(1),
      // Get top earners aggregated by member with total amounts
      supabase.rpc('get_top_earners_by_member', { limit_count: 100 }),
    ])

    // Extract unique parties
    const parties = [...new Set(partiesResult.data?.map(p => p.party_name))] as string[]

    // Get category names from database or use defaults
    const categoryNames = categoriesResult.data?.map(c => c.name) || INTEREST_CATEGORIES

    // Process top earners data
    const allEarners: TopEarner[] = topEarnersResult.data || []

    // Get top 5 overall earners (for category section - no filter applied)
    const topEarnersByCategory = allEarners.slice(0, 5)

    // Get top 5 overall earners by party (aggregate all payments per member)
    const topEarnersByParty = allEarners.slice(0, 5)

    // Split payers by type
    const allPayers = topPayersResult.data || []
    const governments = allPayers.filter(p => p.payer_type === 'Government').slice(0, 5)
    const companies = allPayers.filter(p => p.payer_type === 'Company').slice(0, 5)
    const individuals = allPayers.filter(p => p.payer_type === 'Individual').slice(0, 5)

    // Get latest payment date for each top payer
    const topPayerIds = [...governments, ...companies, ...individuals].map(p => p.payer_id)
    const { data: payerDates } = await supabase
      .from('payments')
      .select('payer_id, received_date, start_date, interest_id')
      .in('payer_id', topPayerIds)
      .not('amount', 'is', null)

    // Get interest_ids for payments without dates to check raw_fields
    const interestIdsWithoutDate = (payerDates || [])
      .filter(p => !p.received_date && !p.start_date)
      .map(p => p.interest_id)

    // Fetch raw_fields for interests without dates
    const { data: interestsWithDates } = interestIdsWithoutDate.length > 0
      ? await supabase
          .from('interests')
          .select('id, raw_fields')
          .in('id', interestIdsWithoutDate)
      : { data: [] }

    // Extract dates from raw_fields
    const interestDateMap = new Map<number, string | null>()
    for (const interest of interestsWithDates || []) {
      const rawFields = interest.raw_fields as Array<{ name?: string; value?: string }> | null
      if (Array.isArray(rawFields)) {
        for (const field of rawFields) {
          const fieldName = field.name?.toLowerCase() || ''
          if ((fieldName.includes('date') || fieldName === 'from' || fieldName === 'start') && field.value) {
            // Try to parse the date
            const parsed = new Date(field.value)
            if (!isNaN(parsed.getTime())) {
              interestDateMap.set(interest.id, parsed.toISOString().split('T')[0])
              break
            }
          }
        }
      }
    }

    // Build a map of payer_id to latest date
    const payerDateMap = new Map<number, string | null>()
    for (const payment of payerDates || []) {
      let date = payment.received_date || payment.start_date
      // Fall back to date from raw_fields
      if (!date && payment.interest_id) {
        date = interestDateMap.get(payment.interest_id) || null
      }
      if (date) {
        const existing = payerDateMap.get(payment.payer_id)
        if (!existing || date > existing) {
          payerDateMap.set(payment.payer_id, date)
        }
      }
    }

    // Add latest_date to each payer
    const addDateToPayers = (payers: typeof allPayers) =>
      payers.map(p => ({
        ...p,
        latest_date: payerDateMap.get(p.payer_id) || null,
      }))

    const response: DashboardSummaryResponse = {
      partyTotals: partyTotalsResult.data || [],
      topEarnersByCategory,
      topEarnersByParty,
      topPayers: {
        governments: addDateToPayers(governments),
        companies: addDateToPayers(companies),
        individuals: addDateToPayers(individuals),
      },
      filterOptions: {
        categories: categoryNames.sort(),
        parties: parties.sort(),
      },
      lastUpdated: lastSyncResult.data?.[0]?.completed_at || new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
