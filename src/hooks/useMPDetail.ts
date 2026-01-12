'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MPDetailResponse } from '@/types/api'

export function useMPDetail(id: number | string) {
  const [data, setData] = useState<MPDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)

      const response = await fetch(`/api/mps/${id}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('MP not found')
        }
        throw new Error('Failed to fetch MP details')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [fetchData, id])

  return { data, isLoading, error, refetch: fetchData }
}
