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
    const paymentId = Number(context.params.id)
    if (!Number.isFinite(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment id' }, { status: 400 })
    }

    const supabase = createAPIClient()
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        id,
        interest_id,
        member_id,
        category_id,
        amount,
        amount_raw,
        currency,
        payment_type,
        regularity,
        role_description,
        hours_worked,
        hours_period,
        hourly_rate,
        payer_name,
        payer_address,
        payer_nature_of_business,
        start_date,
        end_date,
        received_date,
        member:members(id, name_display, party_name, constituency),
        category:categories(id, name),
        interest:interests(id, summary, raw_fields, registration_date)
      `)
      .eq('id', paymentId)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const interest = Array.isArray(payment.interest) ? payment.interest[0] : payment.interest
    const rawFields = interest?.raw_fields as Array<{ name?: string; value?: string }> | null

    return NextResponse.json({
      payment: {
        id: payment.id,
        amount: payment.amount,
        amountRaw: payment.amount_raw,
        currency: payment.currency,
        paymentType: payment.payment_type,
        regularity: payment.regularity,
        roleDescription: payment.role_description,
        hoursWorked: payment.hours_worked,
        hoursPeriod: payment.hours_period,
        hourlyRate: payment.hourly_rate,
        payerName: payment.payer_name,
        payerAddress: payment.payer_address,
        payerNatureOfBusiness: payment.payer_nature_of_business,
        startDate: payment.start_date,
        endDate: payment.end_date,
        receivedDate: payment.received_date,
        registrationDate: interest?.registration_date || null,
        purpose: extractFromRawFields(rawFields, ['purpose']),
        destination: extractFromRawFields(rawFields, ['destination', 'country', 'location']),
        donationDescription: extractFromRawFields(rawFields, ['description of donation', 'description']),
        summary: interest?.summary || null,
        member: payment.member,
        category: payment.category,
      },
    })
  } catch (error) {
    console.error('Payment details error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment details' },
      { status: 500 }
    )
  }
}
