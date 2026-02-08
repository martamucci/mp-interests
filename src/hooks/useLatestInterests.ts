'use client'

import { useState, useEffect, useCallback } from 'react'

export interface LatestInterest {
  id: number
  paymentId?: number | null
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
  member: {
    id: number
    name: string
    party: string
    partyColor: string
    constituency: string | null
    thumbnailUrl: string | null
  }
}

export interface LatestInterestsResponse {
  data: LatestInterest[]
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

interface UseLatestInterestsOptions {
  page?: number
  limit?: number
  party?: string
}

export function useLatestInterests(options: UseLatestInterestsOptions = {}) {
  const { page = 1, limit = 50, party = '' } = options

  const [data, setData] = useState<LatestInterestsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })

      if (party) params.set('party', party)

      const response = await fetch(`/api/interests/latest?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch latest interests')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, party])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
