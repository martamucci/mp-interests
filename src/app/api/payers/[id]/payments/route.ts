import { NextRequest, NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'

// Extract purpose from raw_fields
function extractPurpose(rawFields: Record<string, unknown> | null): string | null {
  if (!rawFields) return null

  // Check for Purpose field directly
  if (Array.isArray(rawFields)) {
    for (const field of rawFields) {
      if (typeof field === 'object' && field !== null) {
        const f = field as { name?: string; value?: string }
        if (f.name?.toLowerCase() === 'purpose' && f.value) {
          return f.value
        }
        // Also check for "Purpose of visit"
        if (f.name?.toLowerCase().includes('purpose') && f.value) {
          return f.value
        }
      }
    }
  }

  return null
}

// Extract date from raw_fields
function extractDate(rawFields: Record<string, unknown> | null): string | null {
  if (!rawFields) return null

  if (Array.isArray(rawFields)) {
    for (const field of rawFields) {
      if (typeof field === 'object' && field !== null) {
        const f = field as { name?: string; value?: string }
        const fieldName = f.name?.toLowerCase() || ''
        if ((fieldName.includes('date') || fieldName === 'from' || fieldName === 'start') && f.value) {
          const parsed = new Date(f.value)
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0]
          }
        }
      }
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
    const payerId = parseInt(id)
    if (isNaN(payerId)) {
      return NextResponse.json({ error: 'Invalid payer ID' }, { status: 400 })
    }

    const supabase = createAPIClient()

    // Get payer info
    const { data: payer, error: payerError } = await supabase
      .from('payers')
      .select('id, name, payer_type, payer_subtype')
      .eq('id', payerId)
      .single()

    if (payerError || !payer) {
      return NextResponse.json({ error: 'Payer not found' }, { status: 404 })
    }

    // Get payments for this payer with MP and category details
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        payment_type,
        role_description,
        received_date,
        start_date,
        member_id,
        category_id,
        interest_id
      `)
      .eq('payer_id', payerId)
      .not('amount', 'is', null)
      .order('amount', { ascending: false })
      .limit(1000)

    if (paymentsError) throw paymentsError

    // Get member, category, and interest details
    const memberIds = [...new Set(payments?.map(p => p.member_id) || [])]
    const categoryIds = [...new Set(payments?.map(p => p.category_id) || [])]
    const interestIds = [...new Set(payments?.map(p => p.interest_id) || [])]

    const [membersResult, categoriesResult, interestsResult] = await Promise.all([
      supabase
        .from('members')
        .select('id, name_display, party_name, constituency')
        .in('id', memberIds),
      supabase
        .from('categories')
        .select('id, name')
        .in('id', categoryIds),
      supabase
        .from('interests')
        .select('id, raw_fields')
        .in('id', interestIds),
    ])

    const membersMap = new Map(
      membersResult.data?.map(m => [m.id, m]) || []
    )
    const categoriesMap = new Map(
      categoriesResult.data?.map(c => [c.id, c]) || []
    )
    const interestsMap = new Map(
      interestsResult.data?.map(i => [i.id, i]) || []
    )

    // Combine payment data with member, category, and purpose info
    const enrichedPayments = (payments || []).map(p => {
      const interest = interestsMap.get(p.interest_id)
      const rawFields = interest?.raw_fields as Record<string, unknown> | null
      const purpose = extractPurpose(rawFields)
      // Use received_date or start_date from payment, or extract from raw_fields
      const date = p.received_date || p.start_date || extractDate(rawFields)

      return {
        id: p.id,
        amount: p.amount,
        payment_type: p.payment_type,
        role_description: p.role_description,
        date,
        purpose,
        member: membersMap.get(p.member_id) || null,
        category: categoriesMap.get(p.category_id) || null,
      }
    })

    return NextResponse.json({
      payer,
      payments: enrichedPayments,
      total: enrichedPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    })
  } catch (error) {
    console.error('Payer payments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payer payments' },
      { status: 500 }
    )
  }
}
