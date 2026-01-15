import { NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { DashboardSummaryResponse } from '@/types/api'
import type { TopEarner, PartyTotal, PayerType } from '@/types/database'

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
      membersWithPaymentsResult,
      payersWithPaymentsResult,
      categoriesResult,
      lastSyncResult,
    ] = await Promise.all([
      // Fetch members with their payments for party totals and top earners
      supabase.from('members').select(`
        id,
        name_display,
        party_name,
        party_color,
        constituency,
        payments(amount)
      `).eq('is_current', true),
      // Use live data from payers table
      supabase.from('payers').select(`
        id,
        name,
        payer_type,
        payer_subtype,
        payments(amount, member_id)
      `),
      supabase.from('categories').select('id, name'),
      supabase.from('sync_log').select('completed_at').eq('status', 'completed').order('completed_at', { ascending: false }).limit(1),
    ])

    // Calculate party totals from live data
    const partyMap = new Map<string, {
      party_name: string
      party_color: string | null
      mp_count: number
      total_amount: number
      payment_count: number
    }>()

    // Calculate top earners from live data
    const earnersList: Array<{
      member_id: number
      name_display: string
      party_name: string
      constituency: string | null
      total_amount: number
      payment_count: number
    }> = []

    for (const member of membersWithPaymentsResult.data || []) {
      let memberTotal = 0
      let memberPaymentCount = 0

      for (const payment of member.payments || []) {
        if (payment.amount) {
          memberTotal += payment.amount
          memberPaymentCount++
        }
      }

      // Add to earners list
      earnersList.push({
        member_id: member.id,
        name_display: member.name_display,
        party_name: member.party_name,
        constituency: member.constituency,
        total_amount: memberTotal,
        payment_count: memberPaymentCount,
      })

      // Aggregate by party
      const partyName = member.party_name
      if (!partyMap.has(partyName)) {
        partyMap.set(partyName, {
          party_name: partyName,
          party_color: member.party_color,
          mp_count: 0,
          total_amount: 0,
          payment_count: 0,
        })
      }
      const partyEntry = partyMap.get(partyName)!
      partyEntry.mp_count += 1
      partyEntry.total_amount += memberTotal
      partyEntry.payment_count += memberPaymentCount
    }

    // Convert party map to sorted array with avg_amount
    const partyTotals: PartyTotal[] = Array.from(partyMap.values())
      .map(p => ({
        ...p,
        avg_amount: p.mp_count > 0 ? p.total_amount / p.mp_count : 0
      }))
      .sort((a, b) => b.total_amount - a.total_amount)

    // Sort earners by total amount and get top 100
    const sortedEarners = earnersList
      .filter(e => e.total_amount > 0)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 100)

    // Convert to TopEarner format
    const allEarners: TopEarner[] = sortedEarners.map(e => ({
      member_id: e.member_id,
      name_display: e.name_display,
      party_name: e.party_name,
      constituency: e.constituency,
      category_id: null,
      category_name: null,
      total_amount: e.total_amount,
      payment_count: e.payment_count,
    }))

    // Aggregate payer data from live query
    const payerMap = new Map<number, {
      payer_id: number
      name: string
      payer_type: string
      payer_subtype: string | null
      total_paid: number
      mp_count: Set<number>
      payment_count: number
    }>()

    for (const payer of payersWithPaymentsResult.data || []) {
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

    // Convert to array with proper mp_count and typed payer_type
    const allPayers = Array.from(payerMap.values())
      .map(p => ({
        ...p,
        payer_type: p.payer_type as PayerType,
        mp_count: p.mp_count.size
      }))
      .filter(p => p.total_paid > 0)
      .sort((a, b) => b.total_paid - a.total_paid)

    // Extract unique parties
    const parties = [...new Set(partyTotals.map(p => p.party_name))]

    // Get category names from database or use defaults
    const categoryNames = categoriesResult.data?.map(c => c.name) || INTEREST_CATEGORIES

    // Get top 5 overall earners
    const topEarnersByCategory = allEarners.slice(0, 5)
    const topEarnersByParty = allEarners.slice(0, 5)

    // Split payers by type
    const governments = allPayers.filter(p => p.payer_type === 'Government').slice(0, 5)
    const companies = allPayers.filter(p => p.payer_type === 'Company').slice(0, 5)
    const individuals = allPayers.filter(p => p.payer_type === 'Individual').slice(0, 5)

    // Get latest payment date for each top payer
    const topPayerIds = [...governments, ...companies, ...individuals].map(p => p.payer_id)
    const { data: payerDates } = topPayerIds.length > 0
      ? await supabase
          .from('payments')
          .select('payer_id, received_date, start_date, interest_id')
          .in('payer_id', topPayerIds)
          .not('amount', 'is', null)
      : { data: [] }

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
      partyTotals,
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
