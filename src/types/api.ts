// API response types

import type { PartyTotal, TopEarner, TopPayer, HourlyRateRecord, Member, Payment } from './database'

// Dashboard responses
export interface PartyTotalsResponse {
  data: PartyTotal[]
  lastUpdated: string
}

export interface TopEarnersResponse {
  data: TopEarner[]
  filterOptions: {
    categories: string[]
    parties: string[]
  }
}

export interface TopPayersResponse {
  data: TopPayer[]
}

export interface HourlyRatesResponse {
  data: HourlyRateRecord[]
}

export interface DashboardSummaryResponse {
  partyTotals: PartyTotal[]
  topEarnersByCategory: TopEarner[]
  topEarnersByParty: TopEarner[]
  topPayers: {
    governments: TopPayer[]
    companies: TopPayer[]
    individuals: TopPayer[]
  }
  filterOptions: {
    categories: string[]
    parties: string[]
  }
  lastUpdated: string
}

// MP responses
export interface MPSummary {
  id: number
  name: string
  party: string
  partyColor: string
  constituency: string | null
  thumbnailUrl: string | null
  totalInterests: number
  totalAmount: number
}

export interface MPListResponse {
  data: MPSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filterOptions: {
    parties: string[]
  }
}

export interface CategoryBreakdown {
  categoryId: number
  categoryName: string
  amount: number
  count: number
}

export interface MPInterest {
  id: number
  category: string
  categoryId?: number
  summary: string | null
  amount: number | null
  payerName: string | null
  roleDescription: string | null
  registrationDate: string | null
  hoursWorked: number | null
  hourlyRate: number | null
  date: string | null
  destination: string | null
  purpose: string | null
  donationDescription: string | null
}

export interface MPDetailResponse {
  member: {
    id: number
    name: string
    party: string
    partyColor: string
    constituency: string | null
    thumbnailUrl: string | null
  }
  summary: {
    totalAmount: number
    interestCount: number
    categoryBreakdown: CategoryBreakdown[]
  }
  interests: MPInterest[]
}

// Search responses
export interface SearchResult {
  type: 'member' | 'interest' | 'payer'
  data: Record<string, unknown>
  relevanceScore: number
}

export interface SearchQuery {
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

export interface SearchStats {
  totalCount: number
  totalAmount: number
  mpCount: number
}

export interface SearchResponse {
  interpretation: string
  query: SearchQuery
  summary: string
  results: SearchResult[]
  stats: SearchStats
  aggregateSummary?: string
  suggestions?: string[]
  relevance?: 'relevant' | 'irrelevant'
}

// Error response
export interface APIError {
  error: string
  code?: string
}
