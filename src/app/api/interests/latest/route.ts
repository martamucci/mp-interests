import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'

export const revalidate = 0 // Disable caching for fresh data

// Type for the joined interest query result
interface InterestWithRelations {
  id: number
  summary: string | null
  registration_date: string | null
  raw_fields: unknown
  member: {
    id: number
    name_display: string
    party_name: string
    party_color: string | null
    constituency: string | null
    thumbnail_url: string | null
  } | null
  category: {
    id: number
    name: string
  } | null
}

// Extract fields from raw_fields array
function extractFromRawFields(
  rawFields: Array<{ name?: string; value?: string }> | null,
  fieldNames: string[]
): string | null {
  if (!Array.isArray(rawFields)) return null

  for (const field of rawFields) {
    const fieldName = field.name?.toLowerCase() || ''
    for (const searchName of fieldNames) {
      if (fieldName === searchName.toLowerCase() || fieldName.includes(searchName.toLowerCase())) {
        if (field.value) return field.value
      }
    }
  }
  return null
}

// Extract date from raw_fields
function extractDate(rawFields: Array<{ name?: string; value?: string }> | null): string | null {
  const dateValue = extractFromRawFields(rawFields, ['date', 'from', 'start date', 'date received'])
  if (dateValue) {
    const parsed = new Date(dateValue)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const party = searchParams.get('party') || ''
    const offset = (page - 1) * limit

    const supabase = createAPIClient()

    // Get date from one month ago
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0]

    // Build query - use !inner join when filtering by party
    let query = supabase
      .from('interests')
      .select(`
        id,
        summary,
        registration_date,
        raw_fields,
        member:members!inner(id, name_display, party_name, party_color, constituency, thumbnail_url),
        category:categories(id, name)
      `, { count: 'exact' })
      .gte('registration_date', oneMonthAgoStr)

    // Add party filter if specified
    if (party) {
      query = query.eq('member.party_name', party)
    }

    const { data: interests, error: interestsError, count } = await query
      .order('registration_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (interestsError) throw interestsError

    // Cast to typed result
    const typedInterests = (interests || []) as unknown as InterestWithRelations[]

    // Get all interest IDs to fetch their payments
    const interestIds = typedInterests.map(i => i.id)

    // Fetch payments for these interests
    const { data: payments } = await supabase
      .from('payments')
      .select(`
        id,
        interest_id,
        amount,
        payer_name,
        role_description,
        hours_worked,
        hourly_rate,
        start_date,
        received_date
      `)
      .in('interest_id', interestIds)

    // Create a map of interest_id to payments
    const paymentsByInterest = new Map<number, typeof payments>()
    for (const payment of payments || []) {
      const existing = paymentsByInterest.get(payment.interest_id) || []
      existing.push(payment)
      paymentsByInterest.set(payment.interest_id, existing)
    }

    // Process interests with their payments
    const processedInterests = typedInterests.map(interest => {
      const interestPayments = paymentsByInterest.get(interest.id) || []
      const rawFields = interest.raw_fields as Array<{ name?: string; value?: string }> | null

      // Get best available date
      const paymentDate = interestPayments[0]?.received_date || interestPayments[0]?.start_date
      const date = paymentDate || extractDate(rawFields) || interest.registration_date

      // Extract additional fields
      const destination = extractFromRawFields(rawFields, ['destination', 'country', 'location'])
      const purpose = extractFromRawFields(rawFields, ['purpose'])
      const donationDescription = extractFromRawFields(rawFields, ['description of donation', 'description'])

      // Get best payer name and role
      const payerName = interestPayments[0]?.payer_name || extractFromRawFields(rawFields, ['payer', 'donor', 'name of donor', 'employer'])
      const roleDescription = interestPayments[0]?.role_description || extractFromRawFields(rawFields, ['role', 'job title', 'position'])

      // Sum up all payments for this interest
      const totalAmount = interestPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      const hoursWorked = interestPayments[0]?.hours_worked
      const hourlyRate = interestPayments[0]?.hourly_rate

      return {
        id: interest.id,
        category: interest.category?.name || 'Unknown',
        categoryId: interest.category?.id,
        summary: interest.summary,
        amount: totalAmount > 0 ? totalAmount : null,
        payerName,
        roleDescription,
        registrationDate: interest.registration_date,
        hoursWorked,
        hourlyRate,
        date,
        destination,
        purpose,
        donationDescription,
        member: {
          id: interest.member?.id || 0,
          name: interest.member?.name_display || 'Unknown',
          party: interest.member?.party_name || 'Unknown',
          partyColor: interest.member?.party_color || '#B18FCF',
          constituency: interest.member?.constituency || null,
          thumbnailUrl: interest.member?.thumbnail_url || null,
        },
      }
    })

    const totalPages = count ? Math.ceil(count / limit) : 1

    // Get unique parties from the results for filter options
    const partiesSet = new Set<string>()
    for (const interest of typedInterests) {
      if (interest.member?.party_name) {
        partiesSet.add(interest.member.party_name)
      }
    }

    // Also fetch all parties that have recent interests (for complete filter list)
    const { data: allRecentParties } = await supabase
      .from('interests')
      .select('member:members!inner(party_name)')
      .gte('registration_date', oneMonthAgoStr)

    const allPartiesSet = new Set<string>()
    for (const item of allRecentParties || []) {
      const member = (item as unknown as { member: { party_name: string } | null }).member
      if (member?.party_name) {
        allPartiesSet.add(member.party_name)
      }
    }

    return NextResponse.json({
      data: processedInterests,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      },
      filterOptions: {
        parties: Array.from(allPartiesSet).sort(),
      },
    })
  } catch (error) {
    console.error('Latest interests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch latest interests' },
      { status: 500 }
    )
  }
}
