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

export async function GET(_request: NextRequest, context: { params: { party: string } }) {
  try {
    const partyName = decodeURIComponent(context.params.party)
    const supabase = createAPIClient(true)

    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id')
      .eq('party_name', partyName)
      .eq('is_current', true)

    if (membersError) throw membersError

    const memberIds = (members || []).map(member => member.id)
    if (memberIds.length === 0) {
      return NextResponse.json({ payments: [] })
    }

    const payments: Array<{
      id: number
      interest_id?: number | null
      amount: number | null
      payer_name: string | null
      role_description: string | null
      hours_worked: number | null
      hourly_rate: number | null
      start_date: string | null
      received_date: string | null
      member: { id: number; name_display: string; party_name: string; constituency: string | null } | Array<{ id: number; name_display: string; party_name: string; constituency: string | null }> | null
      category: { id: number; name: string } | Array<{ id: number; name: string }> | null
      interest: { summary: string | null; raw_fields: unknown; registration_date: string | null } | Array<{ summary: string | null; raw_fields: unknown; registration_date: string | null }> | null
    }> = []

    const limit = 1000
    let offset = 0

    while (true) {
      const { data: chunk, error } = await supabase
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
          received_date,
          member:members(id, name_display, party_name, party_color, constituency, thumbnail_url),
          category:categories(id, name),
          interest:interests(summary, raw_fields, registration_date)
        `)
        .in('member_id', memberIds)
        .not('amount', 'is', null)
        .order('amount', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      payments.push(...(chunk || []))
      if (!chunk || chunk.length < limit) break
      offset += limit
    }

    const enrichedPayments = payments.map(payment => {
      const member = Array.isArray(payment.member) ? payment.member[0] : payment.member
      const category = Array.isArray(payment.category) ? payment.category[0] : payment.category
      const interest = Array.isArray(payment.interest) ? payment.interest[0] : payment.interest
      const rawFields = interest?.raw_fields as Array<{ name?: string; value?: string }> | null
      const date = payment.received_date || payment.start_date || interest?.registration_date || null
      return {
        id: payment.id,
        interestId: payment.interest_id,
        amount: payment.amount,
        payerName: payment.payer_name,
        roleDescription: payment.role_description,
        hoursWorked: payment.hours_worked,
        hourlyRate: payment.hourly_rate,
        date,
        summary: interest?.summary || null,
        purpose: extractFromRawFields(rawFields, ['purpose']),
        destination: extractFromRawFields(rawFields, ['destination', 'country', 'location']),
        donationDescription: extractFromRawFields(rawFields, ['description of donation', 'description']),
        member,
        category,
      }
    })

    return NextResponse.json({ payments: enrichedPayments })
  } catch (error) {
    console.error('Party payments error:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}
