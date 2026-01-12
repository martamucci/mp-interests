import OpenAI from 'openai'
import { createAPIClient } from '@/lib/supabase/server'
import type { SearchResponse, SearchResult } from '@/types/api'

interface ParsedQuery {
  intent: 'find_mp' | 'find_interest' | 'find_payer' | 'aggregate' | 'compare' | 'general'
  entities: {
    mpNames?: string[]
    parties?: string[]
    categories?: string[]
    payerNames?: string[]
    payerTypes?: string[]
    amounts?: { min?: number; max?: number }
    dateRange?: { from?: string; to?: string }
  }
  aggregation?: {
    type: 'sum' | 'count' | 'average' | 'max' | 'top'
    groupBy?: string
  }
  limit?: number
}

const SYSTEM_PROMPT = `You are a search query parser for the UK Parliament Register of Interests database.

Parse natural language queries and extract structured search parameters.

Available data:
- Members (MPs) with: name, party (Labour, Conservative, Liberal Democrats, SNP, etc.), constituency
- Interests with categories:
  - Employment and earnings
  - Donations and support
  - Gifts and hospitality
  - Visits outside UK
  - Land and property
  - Shareholdings
- Payments with: amounts (GBP), payers, hours worked, hourly rates
- Payer types: Government, Company, Individual

Return JSON with:
{
  "intent": "find_mp" | "find_interest" | "find_payer" | "aggregate" | "compare" | "general",
  "entities": {
    "mpNames": ["..."],
    "parties": ["Labour", "Conservative", ...],
    "categories": ["..."],
    "payerNames": ["..."],
    "payerTypes": ["Government", "Company", "Individual"],
    "amounts": { "min": number, "max": number }
  },
  "aggregation": {
    "type": "sum" | "count" | "top",
    "groupBy": "party" | "category" | "payer" | "mp"
  },
  "limit": number
}

Examples:
- "Which MPs received the most?" -> intent: aggregate, aggregation: { type: "top", groupBy: "mp" }
- "Conservative MPs" -> intent: find_mp, entities: { parties: ["Conservative"] }
- "Payments from BBC" -> intent: find_interest, entities: { payerNames: ["BBC"] }
- "Top earners over 50000" -> intent: find_mp, entities: { amounts: { min: 50000 } }
- "Foreign governments" -> intent: find_payer, entities: { payerTypes: ["Government"] }`

export class LLMSearchService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async search(query: string): Promise<SearchResponse> {
    try {
      // Parse query with GPT-4
      const parsed = await this.parseQuery(query)

      // Execute database query
      const results = await this.executeQuery(parsed)

      return {
        interpretation: this.formatInterpretation(parsed),
        results,
        suggestions: this.generateSuggestions(parsed),
      }
    } catch (error) {
      console.error('LLM search error:', error)
      return {
        interpretation: 'Unable to parse query',
        results: [],
        suggestions: ['Try asking about MPs, parties, or payments'],
      }
    }
  }

  private async parseQuery(query: string): Promise<ParsedQuery> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('Empty response from LLM')
    }

    return JSON.parse(content) as ParsedQuery
  }

  private async executeQuery(parsed: ParsedQuery): Promise<SearchResult[]> {
    const supabase = createAPIClient()

    switch (parsed.intent) {
      case 'find_mp':
        return this.findMPs(supabase, parsed)
      case 'find_interest':
        return this.findInterests(supabase, parsed)
      case 'find_payer':
        return this.findPayers(supabase, parsed)
      case 'aggregate':
        return this.aggregate(supabase, parsed)
      default:
        return this.generalSearch(supabase, parsed)
    }
  }

  private async findMPs(supabase: ReturnType<typeof createAPIClient>, parsed: ParsedQuery): Promise<SearchResult[]> {
    let query = supabase
      .from('members')
      .select('*, payments(amount)')
      .eq('is_current', true)

    if (parsed.entities.parties?.length) {
      query = query.in('party_name', parsed.entities.parties)
    }

    if (parsed.entities.mpNames?.length) {
      const orConditions = parsed.entities.mpNames
        .map(name => `name_display.ilike.%${name}%`)
        .join(',')
      query = query.or(orConditions)
    }

    const { data } = await query.limit(parsed.limit || 20)

    // Calculate totals and filter by amount if needed
    let results = (data || []).map(mp => {
      const totalAmount = mp.payments?.reduce((sum: number, p: { amount: number }) =>
        sum + (p.amount || 0), 0) || 0
      return {
        type: 'member' as const,
        data: {
          id: mp.id,
          name: mp.name_display,
          party: mp.party_name,
          constituency: mp.constituency,
          totalAmount,
        },
        relevanceScore: 1,
      }
    })

    if (parsed.entities.amounts?.min) {
      results = results.filter(r => (r.data as { totalAmount: number }).totalAmount >= parsed.entities.amounts!.min!)
    }
    if (parsed.entities.amounts?.max) {
      results = results.filter(r => (r.data as { totalAmount: number }).totalAmount <= parsed.entities.amounts!.max!)
    }

    // Sort by total amount
    results.sort((a, b) =>
      ((b.data as { totalAmount: number }).totalAmount || 0) - ((a.data as { totalAmount: number }).totalAmount || 0)
    )

    return results.slice(0, parsed.limit || 10)
  }

  private async findInterests(supabase: ReturnType<typeof createAPIClient>, parsed: ParsedQuery): Promise<SearchResult[]> {
    let query = supabase
      .from('payments')
      .select(`
        *,
        member:members(name_display, party_name),
        category:categories(name)
      `)

    if (parsed.entities.payerNames?.length) {
      const orConditions = parsed.entities.payerNames
        .map(name => `payer_name.ilike.%${name}%`)
        .join(',')
      query = query.or(orConditions)
    }

    const { data } = await query.limit(parsed.limit || 20)

    return (data || []).map(payment => ({
      type: 'interest' as const,
      data: {
        mpName: payment.member?.name_display,
        party: payment.member?.party_name,
        category: payment.category?.name,
        amount: payment.amount,
        payer: payment.payer_name,
        role: payment.role_description,
      },
      relevanceScore: 1,
    }))
  }

  private async findPayers(supabase: ReturnType<typeof createAPIClient>, parsed: ParsedQuery): Promise<SearchResult[]> {
    let query = supabase
      .from('mv_top_payers')
      .select('*')
      .order('total_paid', { ascending: false })

    if (parsed.entities.payerTypes?.length) {
      query = query.in('payer_type', parsed.entities.payerTypes)
    }

    const { data } = await query.limit(parsed.limit || 20)

    return (data || []).map(payer => ({
      type: 'payer' as const,
      data: {
        name: payer.name,
        type: payer.payer_type,
        subtype: payer.payer_subtype,
        totalPaid: payer.total_paid,
        mpCount: payer.mp_count,
      },
      relevanceScore: 1,
    }))
  }

  private async aggregate(supabase: ReturnType<typeof createAPIClient>, parsed: ParsedQuery): Promise<SearchResult[]> {
    if (parsed.aggregation?.groupBy === 'party') {
      const { data } = await supabase
        .from('mv_party_totals')
        .select('*')
        .order('total_amount', { ascending: false })
        .limit(parsed.limit || 10)

      return (data || []).map(row => ({
        type: 'interest' as const,
        data: {
          party: row.party_name,
          totalAmount: row.total_amount,
          mpCount: row.mp_count,
        },
        relevanceScore: 1,
      }))
    }

    if (parsed.aggregation?.groupBy === 'mp' || parsed.aggregation?.type === 'top') {
      const { data } = await supabase
        .from('mv_top_earners_by_role')
        .select('*')
        .order('total_amount', { ascending: false })
        .limit(parsed.limit || 10)

      // Deduplicate by member
      const seen = new Set<number>()
      const unique = (data || []).filter(row => {
        if (seen.has(row.member_id)) return false
        seen.add(row.member_id)
        return true
      })

      return unique.map(row => ({
        type: 'member' as const,
        data: {
          name: row.name_display,
          party: row.party_name,
          totalAmount: row.total_amount,
        },
        relevanceScore: 1,
      }))
    }

    return []
  }

  private async generalSearch(supabase: ReturnType<typeof createAPIClient>, parsed: ParsedQuery): Promise<SearchResult[]> {
    // Default to finding MPs
    return this.findMPs(supabase, { ...parsed, intent: 'find_mp' })
  }

  private formatInterpretation(parsed: ParsedQuery): string {
    const parts: string[] = []

    switch (parsed.intent) {
      case 'find_mp':
        parts.push('Finding MPs')
        break
      case 'find_interest':
        parts.push('Finding registered interests')
        break
      case 'find_payer':
        parts.push('Finding payers')
        break
      case 'aggregate':
        parts.push('Aggregating data')
        if (parsed.aggregation?.groupBy) {
          parts.push(`by ${parsed.aggregation.groupBy}`)
        }
        break
      default:
        parts.push('Searching')
    }

    if (parsed.entities.parties?.length) {
      parts.push(`for ${parsed.entities.parties.join(', ')}`)
    }

    if (parsed.entities.payerNames?.length) {
      parts.push(`involving ${parsed.entities.payerNames.join(', ')}`)
    }

    if (parsed.entities.amounts?.min) {
      parts.push(`over £${parsed.entities.amounts.min.toLocaleString()}`)
    }

    return parts.join(' ')
  }

  private generateSuggestions(parsed: ParsedQuery): string[] {
    const suggestions: string[] = []

    if (parsed.intent === 'find_mp') {
      suggestions.push('What are the top payments?')
      suggestions.push('Show by party')
    } else if (parsed.intent === 'find_payer') {
      suggestions.push('Which MPs received from them?')
    }

    suggestions.push('Top earners this year')
    suggestions.push('Foreign government payments')

    return suggestions.slice(0, 3)
  }
}

let searchInstance: LLMSearchService | null = null

export function getSearchService(): LLMSearchService {
  if (!searchInstance) {
    searchInstance = new LLMSearchService()
  }
  return searchInstance
}

// Simple keyword-based search fallback when OpenAI is unavailable
export async function keywordSearch(query: string): Promise<SearchResponse> {
  const supabase = createAPIClient()
  const results: SearchResult[] = []
  const searchTerm = query.trim().toLowerCase()

  // Search MPs by name
  const { data: mps } = await supabase
    .from('members')
    .select('id, name_display, party_name, constituency')
    .eq('is_current', true)
    .ilike('name_display', `%${searchTerm}%`)
    .limit(5)

  if (mps?.length) {
    for (const mp of mps) {
      // Get total for each MP
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('member_id', mp.id)

      const totalAmount = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

      results.push({
        type: 'member',
        data: {
          id: mp.id,
          name: mp.name_display,
          party: mp.party_name,
          constituency: mp.constituency,
          totalAmount,
        },
        relevanceScore: 1,
      })
    }
  }

  // Search payers by name
  const { data: payers } = await supabase
    .from('mv_top_payers')
    .select('*')
    .ilike('name', `%${searchTerm}%`)
    .order('total_paid', { ascending: false })
    .limit(5)

  if (payers?.length) {
    results.push(
      ...payers.map(payer => ({
        type: 'payer' as const,
        data: {
          name: payer.name,
          type: payer.payer_type,
          subtype: payer.payer_subtype,
          totalPaid: payer.total_paid,
          mpCount: payer.mp_count,
        },
        relevanceScore: 1,
      }))
    )
  }

  // Search payments by payer name
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      member:members(name_display, party_name),
      category:categories(name)
    `)
    .ilike('payer_name', `%${searchTerm}%`)
    .order('amount', { ascending: false })
    .limit(5)

  if (payments?.length) {
    results.push(
      ...payments.map(payment => ({
        type: 'interest' as const,
        data: {
          mpName: payment.member?.name_display,
          party: payment.member?.party_name,
          category: payment.category?.name,
          amount: payment.amount,
          payer: payment.payer_name,
          role: payment.role_description,
        },
        relevanceScore: 1,
      }))
    )
  }

  return {
    interpretation: `Searching for "${query}"`,
    results: results.slice(0, 10),
    suggestions: results.length === 0
      ? ['Try searching for an MP name', 'Try searching for a company or organization']
      : [],
  }
}
