import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { MPDetailResponse } from '@/types/api'

export const revalidate = 0 // Disable caching for fresh data

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = parseInt(id)

    if (isNaN(memberId)) {
      return NextResponse.json(
        { error: 'Invalid member ID' },
        { status: 400 }
      )
    }

    const supabase = createAPIClient()

    // Fetch member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Fetch ALL payments for this member directly (not through interests)
    // This ensures we get all payments including multiple per interest
    const { data: payments } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        payer_name,
        role_description,
        hours_worked,
        hourly_rate,
        start_date,
        received_date,
        interest_id,
        category_id
      `)
      .eq('member_id', memberId)
      .order('amount', { ascending: false, nullsFirst: false })
      .limit(1000)

    // Fetch interests for additional fields (summary, raw_fields)
    const { data: interests } = await supabase
      .from('interests')
      .select(`
        id,
        summary,
        registration_date,
        raw_fields,
        category:categories(id, name)
      `)
      .eq('member_id', memberId)

    // Create maps for quick lookup
    const interestMap = new Map(
      (interests || []).map(i => [i.id, i])
    )

    // Get unique category IDs and fetch category names
    const categoryIds = [...new Set((payments || []).map(p => p.category_id).filter(Boolean))]
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', categoryIds)

    const categoryNameMap = new Map(
      (categories || []).map(c => [c.id, c.name])
    )

    // Calculate summary stats from ALL payments
    let totalAmount = 0
    const categoryMap = new Map<number, { name: string; amount: number; count: number }>()

    // Process each payment as a separate entry
    const paymentEntries = (payments || []).map(payment => {
      const amount = payment.amount || 0
      totalAmount += amount

      const interest = interestMap.get(payment.interest_id)
      const categoryId = payment.category_id
      const categoryName = categoryNameMap.get(categoryId) || 'Unknown'

      // Aggregate by category
      if (categoryId) {
        const existing = categoryMap.get(categoryId) || { name: categoryName, amount: 0, count: 0 }
        existing.amount += amount
        existing.count += 1
        categoryMap.set(categoryId, existing)
      }

      // Extract additional fields from interest's raw_fields
      const rawFields = interest?.raw_fields as Array<{ name?: string; value?: string }> | null
      const destination = extractFromRawFields(rawFields, ['destination', 'country', 'location'])
      const purpose = extractFromRawFields(rawFields, ['purpose'])
      const donationDescription = extractFromRawFields(rawFields, ['description of donation', 'description'])

      // Get date from payment or raw_fields
      const date = payment.received_date || payment.start_date || extractDate(rawFields)

      return {
        id: payment.interest_id,
        paymentId: payment.id,
        category: categoryName,
        categoryId: categoryId,
        summary: interest?.summary || null,
        amount: payment.amount,
        payerName: payment.payer_name,
        roleDescription: payment.role_description,
        registrationDate: interest?.registration_date || null,
        hoursWorked: payment.hours_worked,
        hourlyRate: payment.hourly_rate,
        date,
        destination,
        purpose,
        donationDescription,
      }
    })

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)

    const response: MPDetailResponse = {
      member: {
        id: member.id,
        name: member.name_display,
        party: member.party_name,
        partyColor: member.party_color || '#B18FCF',
        constituency: member.constituency,
        thumbnailUrl: member.thumbnail_url,
      },
      summary: {
        totalAmount,
        interestCount: paymentEntries.length,
        categoryBreakdown,
      },
      interests: paymentEntries,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('MP detail error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MP details' },
      { status: 500 }
    )
  }
}
