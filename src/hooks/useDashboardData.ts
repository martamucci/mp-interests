'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardSummaryResponse } from '@/types/api'
import type { TopPayer } from '@/types/database'

export function useDashboardData() {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/dashboard/summary')

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

export function useTopEarners(filterBy: 'category' | 'party', filterValue: string) {
  const [data, setData] = useState<DashboardSummaryResponse['topEarnersByCategory']>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!filterValue) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          filterBy,
          filterValue,
          limit: '5',
        })
        const response = await fetch(`/api/dashboard/top-earners?${params}`)
        if (response.ok) {
          const result = await response.json()
          setData(result.data)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [filterBy, filterValue])

  return { data, isLoading }
}

export function useTopPayersByType(type: 'Government' | 'Company' | 'Individual') {
  const [data, setData] = useState<TopPayer[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          type,
          page: '1',
          limit: '5',
          sort: 'high',
        })
        const response = await fetch(`/api/payers?${params}`)
        if (response.ok) {
          const result = await response.json()
          setData(result.data || [])
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [type])

  return { data, isLoading }
}
