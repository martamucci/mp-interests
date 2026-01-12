import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import type { MPDetailResponse } from '@/types/api'

export const revalidate = 3600

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

    // Fetch interests with payments
    const { data: interests } = await supabase
      .from('interests')
      .select(`
        id,
        summary,
        registration_date,
        raw_fields,
        category:categories(id, name),
        payments(
          amount,
          payer_name,
          role_description,
          hours_worked,
          hourly_rate,
          start_date,
          received_date
        )
      `)
      .eq('member_id', memberId)
      .order('registration_date', { ascending: false })

    // Calculate summary stats
    let totalAmount = 0
    const categoryMap = new Map<number, { name: string; amount: number; count: number }>()

    const interestsWithPayments = (interests || []).map(interest => {
      const payment = interest.payments?.[0] || {} as Record<string, unknown>
      const amount = (payment.amount as number) || 0
      totalAmount += amount

      // Aggregate by category - Supabase returns single object or array
      const categoryData = Array.isArray(interest.category)
        ? interest.category[0]
        : interest.category
      const categoryId = (categoryData as { id: number; name: string } | null)?.id
      const categoryName = (categoryData as { id: number; name: string } | null)?.name || 'Unknown'

      if (categoryId) {
        const existing = categoryMap.get(categoryId) || { name: categoryName, amount: 0, count: 0 }
        existing.amount += amount
        existing.count += 1
        categoryMap.set(categoryId, existing)
      }

      // Extract additional fields from raw_fields
      const rawFields = interest.raw_fields as Array<{ name?: string; value?: string }> | null
      const destination = extractFromRawFields(rawFields, ['destination', 'country', 'location'])
      const purpose = extractFromRawFields(rawFields, ['purpose'])
      const donationDescription = extractFromRawFields(rawFields, ['description of donation', 'description'])

      // Get date from payment or raw_fields
      const date = (payment.received_date as string) ||
        (payment.start_date as string) ||
        extractDate(rawFields)

      return {
        id: interest.id,
        category: categoryName,
        categoryId: categoryId,
        summary: interest.summary,
        amount: payment.amount as number | null,
        payerName: payment.payer_name as string | null,
        roleDescription: payment.role_description as string | null,
        registrationDate: interest.registration_date,
        hoursWorked: payment.hours_worked as number | null,
        hourlyRate: payment.hourly_rate as number | null,
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
        interestCount: interestsWithPayments.length,
        categoryBreakdown,
      },
      interests: interestsWithPayments,
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
