'use client'

import MPCard from './MPCard'
import Skeleton from '@/components/ui/Skeleton'
import type { MPSummary } from '@/types/api'

interface MPListProps {
  data: MPSummary[]
  isLoading?: boolean
}

export default function MPList({ data, isLoading }: MPListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center gap-4">
              <Skeleton variant="circular" width={64} height={64} />
              <div className="flex-1 space-y-2">
                <Skeleton width="60%" height={20} />
                <Skeleton width="40%" height={16} />
              </div>
              <div className="text-right space-y-2">
                <Skeleton width={80} height={20} />
                <Skeleton width={60} height={14} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-dark-grey">
        No MPs found matching your criteria.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((mp) => (
        <MPCard key={mp.id} mp={mp} />
      ))}
    </div>
  )
}
