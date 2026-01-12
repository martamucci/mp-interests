'use client'

import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils/currency'
import type { MPDetailResponse } from '@/types/api'

interface MPProfileProps {
  member: MPDetailResponse['member']
  summary: MPDetailResponse['summary']
}

export default function MPProfile({ member, summary }: MPProfileProps) {
  return (
    <div className="card p-6">
      <div className="flex items-start gap-6">
        {member.thumbnailUrl && (
          <img
            src={member.thumbnailUrl}
            alt={member.name}
            className="w-24 h-24 rounded-lg object-cover bg-lavender"
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-near-black">{member.name}</h1>
          {member.constituency && (
            <p className="text-dark-grey mt-1">{member.constituency}</p>
          )}
          <div className="mt-2">
            <Badge color={member.partyColor}>{member.party}</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-dark-grey">Total Registered</p>
          <p className="text-2xl font-bold text-near-black">
            {formatCurrency(summary.totalAmount)}
          </p>
          <p className="text-sm text-dark-grey mt-2">
            {summary.interestCount} registered interest{summary.interestCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
