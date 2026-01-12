'use client'

import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils/currency'
import type { MPSummary } from '@/types/api'

interface MPCardProps {
  mp: MPSummary
}

export default function MPCard({ mp }: MPCardProps) {
  return (
    <Link href={`/mps/${mp.id}`}>
      <div className="card p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center gap-4">
          {mp.thumbnailUrl && (
            <img
              src={mp.thumbnailUrl}
              alt={mp.name}
              className="w-16 h-16 rounded-full object-cover bg-lavender"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-near-black truncate">{mp.name}</h3>
            {mp.constituency && (
              <p className="text-sm text-dark-grey truncate">{mp.constituency}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge color={mp.partyColor}>{mp.party}</Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-near-black">
              {formatCurrency(mp.totalAmount)}
            </p>
            <p className="text-xs text-dark-grey">
              {mp.totalInterests} interest{mp.totalInterests !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
