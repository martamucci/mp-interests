import { createServerClient } from '@/lib/supabase/server'
import { fetchAllCurrentMPs } from '@/lib/parliament-api/members'
import { fetchAllInterests, fetchCategories, fetchInterestsByCategory } from '@/lib/parliament-api/interests'
import { extractPaymentsFromInterest } from './paymentExtractor'
import { getPayerClassifier } from './payerClassifier'
import type { ParliamentMember, PublishedInterest, InterestCategory } from '@/types/parliament'
import type { Member, Category, Interest, Payment, Payer, PayerType } from '@/types/database'
import payerOverridesData from '@/../data/payer-overrides.json'

type PayerOverrideData = {
  overrides: Array<{ pattern: string; type: PayerType; subtype?: string }>
}

// Normalize party names (e.g., merge "Labour (Co-op)" into "Labour")
function normalizePartyName(partyName: string): string {
  const normalized = partyName.toLowerCase().trim()

  // Merge Labour and Labour (Co-op) into Labour
  if (normalized === 'labour (co-op)' || normalized === 'labour/co-operative' || normalized.startsWith('labour')) {
    return 'Labour'
  }

  return partyName
}

interface SyncResult {
  syncId: number
  membersProcessed: number
  interestsProcessed: number
  paymentsCreated: number
  payersCreated: number
  errors: string[]
  duration: number
}

export class SyncService {
  private supabase = createServerClient()
  private classifier = getPayerClassifier()
  private syncId: number = 0
  private errors: string[] = []

  async runSync(): Promise<SyncResult> {
    const startTime = Date.now()

    // Load payer overrides
    this.classifier.loadOverrides((payerOverridesData as PayerOverrideData).overrides)

    // Create sync log entry
    this.syncId = await this.createSyncLog()

    try {
      // Step 1: Sync categories
      console.log('Syncing categories...')
      await this.syncCategories()

      // Step 2: Sync members
      console.log('Syncing members...')
      const members = await this.syncMembers()

      // Step 3: Sync interests
      console.log('Syncing interests...')
      const memberIds = new Set(members.map(m => m.value.id))
      const interests = await this.syncInterests(memberIds)

      // Step 4: Extract and save payments
      console.log('Processing payments...')
      const { paymentsCreated, payersCreated } = await this.processPayments(interests)

      // Step 5: Refresh materialized views
      console.log('Refreshing materialized views...')
      await this.refreshMaterializedViews()

      // Complete sync log
      await this.completeSyncLog('completed')

      const duration = Date.now() - startTime
      console.log(`Sync completed in ${duration}ms`)

      return {
        syncId: this.syncId,
        membersProcessed: members.length,
        interestsProcessed: interests.length,
        paymentsCreated,
        payersCreated,
        errors: this.errors,
        duration,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.completeSyncLog('failed', errorMessage)
      throw error
    }
  }

  private async createSyncLog(): Promise<number> {
    const { data, error } = await this.supabase
      .from('sync_log')
      .insert({
        sync_type: 'full',
        status: 'running',
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  private async completeSyncLog(status: string, errorMessage?: string): Promise<void> {
    await this.supabase
      .from('sync_log')
      .update({
        status,
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq('id', this.syncId)
  }

  private async syncCategories(): Promise<void> {
    const response = await fetchCategories()
    const categories = response.items.map((cat: InterestCategory) => ({
      id: cat.id,
      name: cat.name,
      parent_id: cat.parentCategory?.id || null,
      category_number: cat.sortOrder,
    }))

    const { error } = await this.supabase
      .from('categories')
      .upsert(categories, { onConflict: 'id' })

    if (error) {
      this.errors.push(`Category sync error: ${error.message}`)
    }
  }

  private async syncMembers(): Promise<ParliamentMember[]> {
    const members = await fetchAllCurrentMPs()

    const memberRecords: Omit<Member, 'created_at' | 'updated_at'>[] = members.map(m => ({
      id: m.value.id,
      name_display: m.value.nameDisplayAs,
      name_list_as: m.value.nameListAs,
      constituency: m.value.latestHouseMembership?.membershipFrom || null,
      party_id: m.value.latestParty.id,
      party_name: normalizePartyName(m.value.latestParty.name),
      party_abbreviation: m.value.latestParty.abbreviation,
      party_color: m.value.latestParty.backgroundColour
        ? `#${m.value.latestParty.backgroundColour}`
        : null,
      thumbnail_url: m.value.thumbnailUrl,
      is_current: true,
    }))

    const { error } = await this.supabase
      .from('members')
      .upsert(memberRecords, { onConflict: 'id' })

    if (error) {
      this.errors.push(`Member sync error: ${error.message}`)
    }

    return members
  }

  private async syncInterests(memberIds: Set<number>): Promise<PublishedInterest[]> {
    // Fetch all interests (bulk fetch - childInterests not included)
    const interests = await fetchAllInterests(memberIds)

    // Fetch Employment interests by category to get childInterests with payment amounts
    // The Parliament API only returns childInterests when filtering by CategoryId
    // Category 12 = "Employment and earnings"
    console.log('Fetching Employment interests by category (for childInterests)...')
    const employmentInterests = await fetchInterestsByCategory(12, memberIds)

    // Create a map of employment interests with childInterests
    const employmentMap = new Map<number, PublishedInterest>()
    for (const interest of employmentInterests) {
      employmentMap.set(interest.id, interest)
    }

    // Merge: replace bulk-fetched employment interests with category-fetched ones (which have childInterests)
    const mergedInterests = interests.map(interest => {
      if (interest.category.id === 12 && employmentMap.has(interest.id)) {
        return employmentMap.get(interest.id)!
      }
      return interest
    })

    const interestRecords = mergedInterests.map(i => ({
      id: i.id,
      member_id: i.member.id,
      category_id: i.category.id,
      summary: i.summary,
      registration_date: i.registrationDate,
      published_date: i.publishedDate,
      parent_interest_id: i.parentInterestId,
      raw_fields: i.fields,
    }))

    // Batch insert in chunks to avoid timeout
    const chunks = this.chunk(interestRecords, 100)
    for (const chunk of chunks) {
      const { error } = await this.supabase
        .from('interests')
        .upsert(chunk, { onConflict: 'id' })

      if (error) {
        this.errors.push(`Interest sync error: ${error.message}`)
      }
    }

    return mergedInterests
  }

  private async processPayments(interests: PublishedInterest[]): Promise<{
    paymentsCreated: number
    payersCreated: number
  }> {
    const payments: Omit<Payment, 'id' | 'created_at'>[] = []
    const payerMap = new Map<string, Omit<Payer, 'id' | 'created_at' | 'updated_at'>>()

    for (const interest of interests) {
      // Extract all payments from this interest (may include multiple from childInterests)
      const extractedPayments = extractPaymentsFromInterest(interest)
      if (extractedPayments.length === 0) continue

      for (const extracted of extractedPayments) {
        // Process payer
        if (extracted.payerName) {
          const normalizedName = this.classifier.normalizeName(extracted.payerName)

          if (!payerMap.has(normalizedName)) {
            // Use API-provided status if available, otherwise classify
            let payerType: PayerType
            let payerSubtype: string | null = null

            if (extracted.payerStatus) {
              // Map API status to our PayerType
              const statusLower = extracted.payerStatus.toLowerCase()
              if (statusLower === 'individual' || statusLower === 'private individual') {
                payerType = 'Individual'
              } else if (statusLower === 'company' || statusLower === 'corporate') {
                payerType = 'Company'
              } else if (statusLower.includes('government') || statusLower.includes('public')) {
                payerType = 'Government'
              } else {
                // Fall back to classifier for unknown statuses
                const classification = this.classifier.classify(extracted.payerName)
                payerType = classification.type
                payerSubtype = classification.subtype || null
              }
            } else {
              // No API status, use classifier
              const classification = this.classifier.classify(extracted.payerName)
              payerType = classification.type
              payerSubtype = classification.subtype || null
            }

            payerMap.set(normalizedName, {
              name: extracted.payerName,
              normalized_name: normalizedName,
              payer_type: payerType,
              payer_subtype: payerSubtype,
              address: extracted.payerAddress,
              nature_of_business: extracted.payerNatureOfBusiness,
              country: null,
              is_manual_override: false,
              override_reason: null,
            })
          }
        }

        payments.push({
          interest_id: extracted.interestId,
          member_id: extracted.memberId,
          category_id: extracted.categoryId,
          amount: extracted.amount,
          amount_raw: extracted.amountRaw,
          currency: 'GBP',
          payment_type: extracted.paymentType,
          regularity: extracted.regularity,
          role_description: extracted.roleDescription,
          hours_worked: extracted.hoursWorked,
          hours_period: extracted.hoursPeriod,
          hourly_rate: extracted.hourlyRate,
          payer_id: null, // Will be updated after payer insert
          payer_name: extracted.payerName,
          payer_address: extracted.payerAddress,
          payer_nature_of_business: extracted.payerNatureOfBusiness,
          start_date: extracted.startDate,
          end_date: extracted.endDate,
          received_date: extracted.receivedDate,
          is_donated: extracted.isDonated,
        })
      }
    }

    // Insert payers first
    const payerRecords = Array.from(payerMap.values())
    if (payerRecords.length > 0) {
      const { error } = await this.supabase
        .from('payers')
        .upsert(payerRecords, {
          onConflict: 'normalized_name',
          ignoreDuplicates: false,
        })

      if (error) {
        this.errors.push(`Payer sync error: ${error.message}`)
      }
    }

    // Get payer IDs
    const { data: payers } = await this.supabase
      .from('payers')
      .select('id, normalized_name')

    const payerIdMap = new Map(payers?.map(p => [p.normalized_name, p.id]) || [])

    // Update payments with payer IDs
    for (const payment of payments) {
      if (payment.payer_name) {
        const normalizedName = this.classifier.normalizeName(payment.payer_name)
        payment.payer_id = payerIdMap.get(normalizedName) || null
      }
    }

    // Delete existing payments and insert new ones
    await this.supabase.from('payments').delete().neq('id', 0)

    // Batch insert payments
    const chunks = this.chunk(payments, 100)
    for (const chunk of chunks) {
      const { error } = await this.supabase
        .from('payments')
        .insert(chunk)

      if (error) {
        this.errors.push(`Payment sync error: ${error.message}`)
      }
    }

    return {
      paymentsCreated: payments.length,
      payersCreated: payerRecords.length,
    }
  }

  private async refreshMaterializedViews(): Promise<void> {
    const { error } = await this.supabase.rpc('refresh_all_materialized_views')
    if (error) {
      this.errors.push(`Materialized view refresh error: ${error.message}`)
    }
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

export async function runDataSync(): Promise<SyncResult> {
  const service = new SyncService()
  return service.runSync()
}
