// Database types for Supabase

export interface Member {
  id: number
  name_display: string
  name_list_as: string
  constituency: string | null
  party_id: number
  party_name: string
  party_abbreviation: string | null
  party_color: string | null
  thumbnail_url: string | null
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
  category_number: number | null
  created_at: string
}

export interface Interest {
  id: number
  member_id: number
  category_id: number
  summary: string | null
  registration_date: string | null
  published_date: string | null
  parent_interest_id: number | null
  raw_fields: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: number
  interest_id: number
  member_id: number
  category_id: number
  amount: number | null
  amount_raw: string | null
  currency: string
  payment_type: string | null
  regularity: string | null
  role_description: string | null
  hours_worked: number | null
  hours_period: string | null
  hourly_rate: number | null
  payer_id: number | null
  payer_name: string | null
  payer_address: string | null
  payer_nature_of_business: string | null
  start_date: string | null
  end_date: string | null
  received_date: string | null
  is_donated: boolean
  created_at: string
}

export type PayerType = 'Government' | 'Company' | 'Individual' | 'Other'

export interface Payer {
  id: number
  name: string
  normalized_name: string | null
  payer_type: PayerType
  payer_subtype: string | null
  address: string | null
  nature_of_business: string | null
  country: string | null
  is_manual_override: boolean
  override_reason: string | null
  created_at: string
  updated_at: string
}

export interface PayerOverride {
  id: number
  payer_name_pattern: string
  payer_type: PayerType
  payer_subtype: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface SyncLog {
  id: number
  sync_type: 'full' | 'incremental'
  started_at: string
  completed_at: string | null
  status: 'running' | 'completed' | 'failed'
  records_processed: number
  records_created: number
  records_updated: number
  error_message: string | null
  metadata: Record<string, unknown> | null
}

// Materialized view types
export interface PartyTotal {
  party_name: string
  party_color: string | null
  mp_count: number
  total_amount: number
  avg_amount: number
  payment_count: number
}

export interface TopEarner {
  member_id: number
  name_display: string
  party_name: string
  constituency: string | null
  category_id: number | null
  category_name: string | null
  total_amount: number
  payment_count: number
}

export interface TopPayer {
  payer_id: number
  name: string
  payer_type: PayerType
  payer_subtype: string | null
  total_paid: number
  mp_count: number
  payment_count: number
  latest_date?: string | null
}

export interface HourlyRateRecord {
  member_id: number
  name_display: string
  party_name: string
  role_description: string | null
  amount: number
  hours_worked: number
  hours_period: string | null
  hourly_rate: number
  payer_name: string | null
}
