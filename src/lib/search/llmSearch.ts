import OpenAI from 'openai'
import { createAPIClient } from '@/lib/supabase/server'
import type { SearchQuery, SearchResponse, SearchResult, SearchStats } from '@/types/api'

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

const DEFAULT_RESULT_LIMIT = 1000
const MAX_RESULT_LIMIT = 1000

const formatCurrency = (value: number) =>
  `£${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`

const buildStats = (results: SearchResult[]): SearchStats => {
  const mpNames = new Set<string>()
  let totalAmount = 0

  for (const result of results) {
    const data = result.data as Record<string, unknown>

    if (result.type === 'interest' && typeof data.mpName === 'string') {
      mpNames.add(data.mpName)
    }
    if (result.type === 'member' && typeof data.name === 'string') {
      mpNames.add(data.name)
    }

    if (result.type === 'interest' && typeof data.amount === 'number') {
      totalAmount += data.amount
    } else if (result.type === 'member' && typeof data.totalAmount === 'number') {
      totalAmount += data.totalAmount
    } else if (result.type === 'payer' && typeof data.totalPaid === 'number') {
      totalAmount += data.totalPaid
    }
  }

  return {
    totalCount: results.length,
    totalAmount,
    mpCount: mpNames.size,
  }
}

const isCountQuestion = (query: string) => {
  const normalized = query.toLowerCase()
  return normalized.includes('how many') || normalized.includes('number of') || normalized.includes('count')
}

const isTopEarnerQuestion = (query: string) => {
  const normalized = query.toLowerCase()
  return (
    normalized.includes('top earner') ||
    normalized.includes('top earners') ||
    normalized.includes('highest earning') ||
    normalized.includes('highest earners')
  )
}

const isAggregateQuestion = (query: string) => {
  const normalized = query.toLowerCase()
  return (
    isCountQuestion(query) ||
    normalized.includes('total') ||
    normalized.includes('totals') ||
    normalized.includes('sum') ||
    normalized.includes('average') ||
    normalized.includes('avg')
  )
}

const formatAggregateSummary = (results: SearchResult[], stats: SearchStats) => {
  if (results.length === 0) return ''

  const allInterestResults = results.every(result => result.type === 'interest')
  const countLabel = allInterestResults ? 'payments' : 'results'
  let summary = `Totals: ${stats.totalCount} ${countLabel}`

  if (stats.mpCount > 0 && allInterestResults) {
    summary += ` across ${stats.mpCount} MP${stats.mpCount === 1 ? '' : 's'}`
  }

  if (stats.totalAmount > 0) {
    summary += ` totalling ${formatCurrency(stats.totalAmount)}`
  }

  return summary + '.'
}

const normalizeParsedQuery = (parsed: ParsedQuery, query: string): ParsedQuery => {
  if (isTopEarnerQuestion(query)) {
    return {
      ...parsed,
      intent: 'aggregate',
      aggregation: {
        type: 'top',
        groupBy: 'mp',
      },
    }
  }
  return parsed
}

const formatInterpretedQuery = (parsed: ParsedQuery): string => {
  const amounts = parsed.entities.amounts
  const amountParts: string[] = []

  if (amounts?.min) {
    amountParts.push(`over ${formatCurrency(amounts.min)}`)
  }
  if (amounts?.max) {
    amountParts.push(`under ${formatCurrency(amounts.max)}`)
  }

  const amountSuffix = amountParts.length ? ` ${amountParts.join(' and ')}` : ''

  switch (parsed.intent) {
    case 'find_interest': {
      if (parsed.entities.mpNames?.length) {
        return `interests registered by ${parsed.entities.mpNames.join(', ')}${amountSuffix}`
      }
      if (parsed.entities.payerNames?.length) {
        return `interests involving ${parsed.entities.payerNames.join(', ')}${amountSuffix}`
      }
      if (parsed.entities.categories?.length) {
        return `interests in ${parsed.entities.categories.join(', ')}${amountSuffix}`
      }
      return `registered interests${amountSuffix}`
    }
    case 'find_mp': {
      if (parsed.entities.parties?.length) {
        return `MPs from ${parsed.entities.parties.join(', ')}${amountSuffix}`
      }
      if (parsed.entities.mpNames?.length) {
        return `MPs named ${parsed.entities.mpNames.join(', ')}${amountSuffix}`
      }
      return `MPs${amountSuffix}`
    }
    case 'find_payer': {
      if (parsed.entities.payerTypes?.length) {
        return `payers of type ${parsed.entities.payerTypes.join(', ')}${amountSuffix}`
      }
      if (parsed.entities.payerNames?.length) {
        return `payers named ${parsed.entities.payerNames.join(', ')}${amountSuffix}`
      }
      return `payers${amountSuffix}`
    }
    case 'aggregate': {
      if (parsed.aggregation?.groupBy) {
        return `totals by ${parsed.aggregation.groupBy}${amountSuffix}`
      }
      return `aggregated results${amountSuffix}`
    }
    default:
      return `your request${amountSuffix}`
  }
}

const buildSummary = (options: {
  interpretedQuery: string
  results: SearchResult[]
  stats: SearchStats
  relevance: 'relevant' | 'irrelevant'
  countQuestion: boolean
  aggregateRequested: boolean
  parsed?: ParsedQuery
}): string => {
  if (options.relevance === 'irrelevant') {
    return 'This question cannot be answered using our database.'
  }

  if (options.results.length === 0) {
    return `There aren't any results for ${options.interpretedQuery}.`
  }

  const interestResults = options.results.filter(result => result.type === 'interest')
  const allInterestResults = interestResults.length === options.results.length
  const mpNames = new Set(
    interestResults
      .map(result => result.data?.mpName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
  )

  if (options.countQuestion && allInterestResults && mpNames.size === 1) {
    const mpName = [...mpNames][0]
    const count = interestResults.length
    return `${mpName} has registered ${count} interest${count === 1 ? '' : 's'} in the register. Here ${count === 1 ? 'it is' : 'they are'}:`
  }

  if (options.aggregateRequested) {
    return `After searching for ${options.interpretedQuery}, here are the results:`
  }

  const verb = options.stats.totalCount === 1 ? 'is' : 'are'
  const resultLabel = allInterestResults ? 'payment' : 'result'
  const plural = options.stats.totalCount === 1 ? '' : 's'
  let detail = `there ${verb} ${options.stats.totalCount} ${resultLabel}${plural}`

  if (options.parsed?.intent === 'find_interest') {
    const hasEntities = Object.values(options.parsed.entities).some(value => {
      if (!value) return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      return Boolean(value)
    })

    if (!hasEntities) {
      detail = `I couldn't match a specific MP, payer, or category in your question, so ${detail}`
    }
  }

  if (allInterestResults && options.stats.mpCount > 0) {
    detail += ` across ${options.stats.mpCount} MP${options.stats.mpCount === 1 ? '' : 's'}`
  }

  if (options.parsed?.intent === 'aggregate' && options.parsed.aggregation?.type === 'top') {
    return `Here ${options.stats.totalCount === 1 ? 'is' : 'are'} the top ${options.stats.totalCount} earner${options.stats.totalCount === 1 ? '' : 's'}:`
  }

  if (options.stats.totalAmount > 0) {
    detail += ` totalling ${formatCurrency(options.stats.totalAmount)}`
  }

  const categories = new Set(
    interestResults
      .map(result => result.data?.category)
      .filter((category): category is string => typeof category === 'string' && category.length > 0)
  )

  if (categories.size > 0 && categories.size <= 3) {
    detail += `. Categories involved: ${[...categories].join(', ')}`
  }

  return `After searching for ${options.interpretedQuery}, ${detail}.`
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
- "Foreign governments" -> intent: find_payer, entities: { payerTypes: ["Government"] }
- "How many interests does Nigel Farage have?" -> intent: find_interest, entities: { mpNames: ["Nigel Farage"] }`

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
      const parsed = normalizeParsedQuery(await this.parseQuery(query), query)
      const relevance = this.isRelevant(parsed)
      const interpretedQuery = formatInterpretedQuery(parsed)
      const aggregateRequested = parsed.intent === 'aggregate' || isAggregateQuestion(query)
      const countQuestion = isCountQuestion(query)
      const topEarnerQuery = isTopEarnerQuestion(query)

      if (!relevance) {
        const stats = buildStats([])
        return {
          interpretation: interpretedQuery,
          query: parsed,
          summary: buildSummary({
            interpretedQuery,
            results: [],
            stats,
            relevance: 'irrelevant',
            countQuestion,
            aggregateRequested,
            parsed,
          }),
          results: [],
          stats,
          suggestions: [],
          relevance: 'irrelevant',
        }
      }

      // Execute database query
      const results = await this.executeQuery(parsed)
      const stats = buildStats(results)

      return {
        interpretation: interpretedQuery,
        query: parsed,
        summary: buildSummary({
          interpretedQuery,
          results,
          stats,
          relevance: 'relevant',
          countQuestion,
          aggregateRequested,
          parsed,
        }),
        results,
        stats,
        aggregateSummary: aggregateRequested && !countQuestion && !topEarnerQuery
          ? formatAggregateSummary(results, stats)
          : undefined,
        suggestions: this.generateSuggestions(parsed),
        relevance: 'relevant',
      }
    } catch (error) {
      console.error('LLM search error:', error)
      const fallbackQuery: SearchQuery = {
        intent: 'general',
        entities: {},
        limit: DEFAULT_RESULT_LIMIT,
      }
      const countQuestion = isCountQuestion(query)
      const interpretedQuery = query.trim() || 'your request'
      const stats = buildStats([])
      return {
        interpretation: interpretedQuery,
        query: fallbackQuery,
        summary: buildSummary({
          interpretedQuery,
          results: [],
          stats,
          relevance: 'relevant',
          countQuestion,
          aggregateRequested: isAggregateQuestion(query),
        }),
        results: [],
        stats,
        suggestions: ['Try asking about MPs, parties, or payments'],
        relevance: 'relevant',
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
    const limit = this.getLimit(parsed)
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

    const { data } = await query.limit(limit)

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

    return results.slice(0, limit)
  }

  private async findInterests(supabase: ReturnType<typeof createAPIClient>, parsed: ParsedQuery): Promise<SearchResult[]> {
    const limit = this.getLimit(parsed)
    const hasFilters = Boolean(
      (parsed.entities.mpNames && parsed.entities.mpNames.length > 0) ||
      (parsed.entities.payerNames && parsed.entities.payerNames.length > 0) ||
      (parsed.entities.categories && parsed.entities.categories.length > 0) ||
      (parsed.entities.parties && parsed.entities.parties.length > 0) ||
      (parsed.entities.amounts && Object.keys(parsed.entities.amounts).length > 0)
    )

    if (!hasFilters) {
      return []
    }

    let query = supabase
      .from('payments')
      .select(`
        *,
        member:members(name_display, party_name),
        category:categories(name),
        interest:interests(summary)
      `)

    if (parsed.entities.mpNames?.length) {
      const { data: members } = await supabase
        .from('members')
        .select('id')
        .or(parsed.entities.mpNames.map(name => `name_display.ilike.%${name}%`).join(','))
        .limit(MAX_RESULT_LIMIT)

      const memberIds = (members || []).map(member => member.id)
      if (memberIds.length === 0) {
        return []
      }
      query = query.in('member_id', memberIds)
    }

    if (parsed.entities.payerNames?.length) {
      const orConditions = parsed.entities.payerNames
        .flatMap(name => [
          `payer_name.ilike.%${name}%`,
          `role_description.ilike.%${name}%`,
          `interest.summary.ilike.%${name}%`,
        ])
        .join(',')
      query = query.or(orConditions)
    }

    if (parsed.entities.categories?.length) {
      const orConditions = parsed.entities.categories
        .map(category => `category.name.ilike.%${category}%`)
        .join(',')
      query = query.or(orConditions)
    }

    if (parsed.entities.parties?.length) {
      query = query.in('member.party_name', parsed.entities.parties)
    }

    const { data } = await query.limit(limit)

    return (data || []).map(payment => ({
      type: 'interest' as const,
      data: {
        paymentId: payment.id,
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
    const limit = this.getLimit(parsed)
    let query = supabase
      .from('mv_top_payers')
      .select('*')
      .order('total_paid', { ascending: false })

    if (parsed.entities.payerTypes?.length) {
      query = query.in('payer_type', parsed.entities.payerTypes)
    }

    const { data } = await query.limit(limit)

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
    const limit = this.getLimit(parsed)
    if (parsed.aggregation?.groupBy === 'party') {
      const { data } = await supabase
        .from('mv_party_totals')
        .select('*')
        .order('total_amount', { ascending: false })
        .limit(limit)

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
        .limit(limit)

      if (!data || data.length === 0) {
        return this.findMPs(supabase, { ...parsed, intent: 'find_mp' })
      }

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

  private isRelevant(parsed: ParsedQuery): boolean {
    if (parsed.intent !== 'general') {
      return true
    }

    const hasEntities = Object.values(parsed.entities).some(value => {
      if (!value) return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      return Boolean(value)
    })

    const hasAggregation = Boolean(parsed.aggregation?.type || parsed.aggregation?.groupBy)

    return hasEntities || hasAggregation
  }

  private getLimit(parsed: ParsedQuery): number {
    if (typeof parsed.limit !== 'number' || Number.isNaN(parsed.limit)) {
      return DEFAULT_RESULT_LIMIT
    }
    return Math.max(1, Math.min(parsed.limit, MAX_RESULT_LIMIT))
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
  const limit = DEFAULT_RESULT_LIMIT
  const interpretedQuery = query.trim() || 'your request'
  const fallbackQuery: SearchQuery = {
    intent: 'general',
    entities: {},
    limit,
  }
  const isTopEarnerQuery =
    searchTerm.includes('top earner') ||
    searchTerm.includes('top earners') ||
    searchTerm.includes('highest earning') ||
    searchTerm.includes('highest earners')
  const looksRelevant = [
    'mp',
    'mps',
    'member',
    'members',
    'parliament',
    'interest',
    'interests',
    'payer',
    'payers',
    'payment',
    'payments',
    'donation',
    'donations',
    'register',
    'party',
    'constituency',
    'earnings',
    'employment',
  ].some(keyword => searchTerm.includes(keyword))

  if (isTopEarnerQuery) {
    fallbackQuery.intent = 'aggregate'
    fallbackQuery.aggregation = { type: 'top', groupBy: 'mp' }

    const { data } = await supabase
      .from('mv_top_earners_by_role')
      .select('*')
      .order('total_amount', { ascending: false })
      .limit(MAX_RESULT_LIMIT)

    const seen = new Set<number>()
    const unique = (data || []).filter(row => {
      if (seen.has(row.member_id)) return false
      seen.add(row.member_id)
      return true
    })

    if (unique.length > 0) {
      results.push(
        ...unique.map(row => ({
          type: 'member' as const,
          data: {
            name: row.name_display,
            party: row.party_name,
            totalAmount: row.total_amount,
          },
          relevanceScore: 1,
        }))
      )
    } else {
      const { data: members } = await supabase
        .from('members')
        .select('id, name_display, party_name, payments(amount)')
        .eq('is_current', true)
        .limit(MAX_RESULT_LIMIT)

      const memberResults = (members || []).map(mp => {
        const totalAmount = mp.payments?.reduce((sum: number, p: { amount: number }) =>
          sum + (p.amount || 0), 0) || 0
        return {
          type: 'member' as const,
          data: {
            id: mp.id,
            name: mp.name_display,
            party: mp.party_name,
            totalAmount,
          },
          relevanceScore: 1,
        }
      }).sort((a, b) =>
        ((b.data as { totalAmount: number }).totalAmount || 0) - ((a.data as { totalAmount: number }).totalAmount || 0)
      )

      results.push(...memberResults.slice(0, MAX_RESULT_LIMIT))
    }
  }

  // Search MPs by name
  const { data: mps } = await supabase
    .from('members')
    .select('id, name_display, party_name, constituency')
    .eq('is_current', true)
    .ilike('name_display', `%${searchTerm}%`)
    .limit(limit)

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

    if (searchTerm.includes('interest')) {
      const memberIds = mps.map(mp => mp.id)
      const { data: memberPayments } = await supabase
        .from('payments')
        .select(`
          *,
          member:members(name_display, party_name),
          category:categories(name)
        `)
        .in('member_id', memberIds)
        .order('amount', { ascending: false })
        .limit(MAX_RESULT_LIMIT)

      if (memberPayments?.length) {
        results.push(
          ...memberPayments.map(payment => ({
            type: 'interest' as const,
            data: {
              paymentId: payment.id,
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
    }
  }

  // Search payers by name
  const { data: payers } = await supabase
    .from('mv_top_payers')
    .select('*')
    .ilike('name', `%${searchTerm}%`)
    .order('total_paid', { ascending: false })
    .limit(limit)

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
      category:categories(name),
      interest:interests(summary)
    `)
    .or([
      `payer_name.ilike.%${searchTerm}%`,
      `role_description.ilike.%${searchTerm}%`,
      `interest.summary.ilike.%${searchTerm}%`,
    ].join(','))
    .order('amount', { ascending: false })
    .limit(limit)

  if (payments?.length) {
    results.push(
      ...payments.map(payment => ({
        type: 'interest' as const,
        data: {
          paymentId: payment.id,
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
    interpretation: interpretedQuery,
    query: fallbackQuery,
    summary: buildSummary({
      interpretedQuery,
      results: results.slice(0, MAX_RESULT_LIMIT),
      stats: buildStats(results.slice(0, MAX_RESULT_LIMIT)),
      relevance: results.length > 0 || looksRelevant ? 'relevant' : 'irrelevant',
      countQuestion: isCountQuestion(query),
      aggregateRequested: isAggregateQuestion(query),
    }),
    results: results.slice(0, MAX_RESULT_LIMIT),
    stats: buildStats(results.slice(0, MAX_RESULT_LIMIT)),
    aggregateSummary: isAggregateQuestion(query) && results.length > 0
      ? formatAggregateSummary(results.slice(0, MAX_RESULT_LIMIT), buildStats(results.slice(0, MAX_RESULT_LIMIT)))
      : undefined,
    suggestions: results.length === 0
      ? ['Try searching for an MP name', 'Try searching for a company or organization']
      : [],
    relevance: results.length > 0 || looksRelevant ? 'relevant' : 'irrelevant',
  }
}
