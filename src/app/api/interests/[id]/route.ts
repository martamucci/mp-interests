import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'

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

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const interestId = Number(context.params.id)
    if (!Number.isFinite(interestId)) {
      return NextResponse.json({ error: 'Invalid interest id' }, { status: 400 })
    }

    const supabase = createAPIClient(true)

    const { data: interest, error } = await supabase
      .from('interests')
      .select(`
        id,
        summary,
        registration_date,
        raw_fields,
        member:members(id, name_display, party_name, party_color, constituency, thumbnail_url),
        category:categories(id, name)
      `)
      .eq('id', interestId)
      .single()

    if (error || !interest) {
      return NextResponse.json({ error: 'Interest not found' }, { status: 404 })
    }

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
        received_date
      `)
      .eq('interest_id', interestId)
      .order('amount', { ascending: false })

    const rawFields = interest.raw_fields as Array<{ name?: string; value?: string }> | null

    return NextResponse.json({
      interest: {
        id: interest.id,
        summary: interest.summary,
        registrationDate: interest.registration_date,
        purpose: extractFromRawFields(rawFields, ['purpose']),
        destination: extractFromRawFields(rawFields, ['destination', 'country', 'location']),
        donationDescription: extractFromRawFields(rawFields, ['description of donation', 'description']),
        member: interest.member,
        category: interest.category,
      },
      payments: payments || [],
    })
  } catch (error) {
    console.error('Interest details error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interest details' },
      { status: 500 }
    )
  }
}
