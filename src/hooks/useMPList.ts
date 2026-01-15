'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MPListResponse } from '@/types/api'

interface UseMPListOptions {
  page?: number
  limit?: number
  party?: string
  search?: string
  sort?: 'az' | 'high'
}

export function useMPList(options: UseMPListOptions = {}) {
  const { page = 1, limit = 50, party = '', search = '', sort = 'az' } = options

  const [data, setData] = useState<MPListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
      })

      if (party) params.set('party', party)
      if (search) params.set('search', search)

      const response = await fetch(`/api/mps?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch MPs')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, party, search, sort])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
