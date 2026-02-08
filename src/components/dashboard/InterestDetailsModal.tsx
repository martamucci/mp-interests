'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { getPartyColor } from '@/lib/theme'

interface InterestPayment {
  id: number
  amount: number | null
  payer_name: string | null
  role_description: string | null
  hours_worked: number | null
  hourly_rate: number | null
  start_date: string | null
  received_date: string | null
}

interface InterestDetails {
  id: number
  summary: string | null
  registrationDate: string | null
  purpose: string | null
  destination: string | null
  donationDescription: string | null
  member: {
    id: number
    name_display: string
    party_name: string
    party_color: string | null
    constituency: string | null
    thumbnail_url: string | null
  } | null
  category: {
    id: number
    name: string
  } | null
}

interface InterestDetailsModalProps {
  interestId: number | null
  onClose: () => void
}

export default function InterestDetailsModal({ interestId, onClose }: InterestDetailsModalProps) {
  const [interest, setInterest] = useState<InterestDetails | null>(null)
  const [payments, setPayments] = useState<InterestPayment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!interestId) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/interests/${interestId}`)
        if (!response.ok) throw new Error('Failed to fetch interest details')
        const result = await response.json()
        setInterest(result.interest)
        setPayments(result.payments || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [interestId])

  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  return (
    <Modal isOpen={!!interestId} onClose={onClose} title="Interest details">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-dark-grey">{error}</div>
      ) : interest ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-near-black">
                  {interest.member?.name_display || 'Unknown MP'}
                </span>
                {interest.member?.party_name && (
                  <Badge color={getPartyColor(interest.member.party_name)} size="sm">
                    {interest.member.party_name}
                  </Badge>
                )}
              </div>
              {interest.member?.constituency && (
                <div className="text-xs text-dark-grey">{interest.member.constituency}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-near-black">
                {totalAmount > 0 ? formatCurrency(totalAmount) : '—'}
              </div>
              <div className="text-xs text-dark-grey mt-1">
                Registered {formatDate(interest.registrationDate) || '—'}
              </div>
            </div>
          </div>

          {interest.category?.name && (
            <div className="text-sm">
              <span className="text-dark-grey">Category: </span>
              <span className="text-near-black">{interest.category.name}</span>
            </div>
          )}

          {interest.purpose && (
            <div className="text-sm">
              <span className="text-dark-grey">Purpose: </span>
              <span className="text-near-black">{interest.purpose}</span>
            </div>
          )}

          {interest.destination && (
            <div className="text-sm">
              <span className="text-dark-grey">Destination: </span>
              <span className="text-near-black">{interest.destination}</span>
            </div>
          )}

          {interest.donationDescription && (
            <div className="text-sm text-dark-grey">{interest.donationDescription}</div>
          )}

          {interest.summary && !interest.donationDescription && !interest.purpose && !interest.destination && (
            <div className="text-sm text-dark-grey">{interest.summary}</div>
          )}

          <div className="border-t border-rose-quartz/20 pt-3">
            <div className="text-xs text-dark-grey mb-2">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
            </div>
            <div className="space-y-2">
              {payments.map(payment => (
                <div
                  key={payment.id}
                  className="p-3 rounded-lg border border-rose-quartz/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-near-black truncate">
                        {payment.payer_name || 'Unknown payer'}
                      </div>
                      {payment.role_description && (
                        <div className="text-xs text-dark-grey mt-1 line-clamp-2">
                          {payment.role_description}
                        </div>
                      )}
                      {payment.hours_worked && (
                        <div className="text-xs text-dark-grey mt-1">
                          {payment.hours_worked}h worked
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-near-black">
                        {payment.amount ? formatCurrency(payment.amount) : '—'}
                      </div>
                      <div className="text-xs text-dark-grey mt-1">
                        {formatDate(payment.received_date || payment.start_date) || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="text-sm text-dark-grey">No payment details available.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
