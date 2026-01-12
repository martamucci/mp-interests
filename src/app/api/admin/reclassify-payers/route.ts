import { NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'
import { PayerClassifier } from '@/lib/sync/payerClassifier'
import payerOverridesData from '@/../data/payer-overrides.json'
import type { PayerType } from '@/types/database'

type PayerOverrideData = {
  overrides: Array<{ pattern: string; type: PayerType; subtype?: string }>
}

export async function POST() {
  try {
    const supabase = createAPIClient()

    // Create a fresh classifier instance to ensure we use the latest rules
    const classifier = new PayerClassifier()

    // Load overrides (this clears any existing overrides first)
    classifier.loadOverrides((payerOverridesData as PayerOverrideData).overrides)

    // Fetch all payers
    const { data: payers, error: fetchError } = await supabase
      .from('payers')
      .select('id, name, normalized_name, payer_type, payer_subtype, is_manual_override')

    if (fetchError) throw fetchError

    if (!payers || payers.length === 0) {
      return NextResponse.json({ message: 'No payers found', updated: 0 })
    }

    let updatedCount = 0
    const updates: Array<{ id: number; payer_type: PayerType; payer_subtype: string | null }> = []

    for (const payer of payers) {
      // Skip manually overridden payers
      if (payer.is_manual_override) continue

      // Reclassify
      const classification = classifier.classify(payer.name)

      // Only update if classification changed
      if (classification.type !== payer.payer_type || classification.subtype !== payer.payer_subtype) {
        updates.push({
          id: payer.id,
          payer_type: classification.type,
          payer_subtype: classification.subtype || null,
        })
      }
    }

    // Batch update
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('payers')
        .update({
          payer_type: update.payer_type,
          payer_subtype: update.payer_subtype,
        })
        .eq('id', update.id)

      if (!updateError) {
        updatedCount++
      }
    }

    // Try to refresh materialized views, ignore errors
    let refreshError: string | null = null
    try {
      await supabase.rpc('refresh_all_materialized_views')
    } catch (e) {
      refreshError = e instanceof Error ? e.message : 'Refresh failed'
    }

    // Verify a sample update
    const { data: sampleCheck } = await supabase
      .from('payers')
      .select('id, name, payer_type, payer_subtype')
      .ilike('name', '%friends of israel%')
      .limit(5)

    return NextResponse.json({
      message: 'Payers reclassified successfully',
      totalPayers: payers.length,
      updated: updatedCount,
      skippedManual: payers.filter(p => p.is_manual_override).length,
      sampleCheck,
      refreshError,
    })
  } catch (error) {
    console.error('Reclassify error:', error)
    return NextResponse.json(
      { error: 'Failed to reclassify payers' },
      { status: 500 }
    )
  }
}
