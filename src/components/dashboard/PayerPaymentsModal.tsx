'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils/currency'
import { getPartyColor } from '@/lib/theme'

interface PaymentDetail {
  id: number
  amount: number | null
  payment_type: string | null
  role_description: string | null
  date: string | null
  purpose: string | null
  member: {
    id: number
    name_display: string
    party_name: string
    constituency: string | null
  } | null
  category: {
    id: number
    name: string
  } | null
}

interface PayerPaymentsData {
  payer: {
    id: number
    name: string
    payer_type: string
    payer_subtype: string | null
  }
  payments: PaymentDetail[]
  total: number
}

interface PayerPaymentsModalProps {
  payerId: number | null
  payerName: string
  onClose: () => void
}

export default function PayerPaymentsModal({
  payerId,
  payerName,
  onClose,
}: PayerPaymentsModalProps) {
  const [data, setData] = useState<PayerPaymentsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!payerId) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/payers/${payerId}/payments`)
        if (!response.ok) throw new Error('Failed to fetch payments')
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [payerId])

  return (
    <Modal isOpen={!!payerId} onClose={onClose} title={payerName}>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-dark-grey">{error}</div>
      ) : data ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between pb-4 border-b border-rose-quartz/20">
            <div className="text-sm text-dark-grey">
              {data.payments.length} payment{data.payments.length !== 1 ? 's' : ''} to{' '}
              {new Set(data.payments.map(p => p.member?.id)).size} MP
              {new Set(data.payments.map(p => p.member?.id)).size !== 1 ? 's' : ''}
            </div>
            <div className="text-lg font-semibold text-near-black">
              {formatCurrency(data.total)}
            </div>
          </div>

          {/* Payments list */}
          <div className="space-y-3">
            {data.payments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 rounded-lg border border-rose-quartz/20 hover:border-rose-quartz/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* MP Name */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-near-black truncate">
                        {payment.member?.name_display || 'Unknown MP'}
                      </span>
                      {payment.member?.party_name && (
                        <Badge color={getPartyColor(payment.member.party_name)} size="sm">
                          {payment.member.party_name}
                        </Badge>
                      )}
                    </div>

                    {/* Constituency */}
                    {payment.member?.constituency && (
                      <div className="text-xs text-dark-grey mb-2">
                        {payment.member.constituency}
                      </div>
                    )}

                    {/* Category */}
                    {payment.category?.name && (
                      <div className="text-sm text-dark-grey">
                        <span className="inline-block px-2 py-0.5 bg-lavender/50 rounded text-xs">
                          {payment.category.name}
                        </span>
                      </div>
                    )}

                    {/* Purpose of visit */}
                    {payment.purpose && (
                      <div className="text-sm mt-2">
                        <span className="text-dark-grey">Purpose: </span>
                        <span className="text-near-black">{payment.purpose}</span>
                      </div>
                    )}

                    {/* Role/Description */}
                    {payment.role_description && !payment.purpose && (
                      <div className="text-sm text-dark-grey mt-2 line-clamp-2">
                        {payment.role_description}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-near-black">
                      {formatCurrency(payment.amount || 0)}
                    </div>
                    {payment.date && (
                      <div className="text-xs text-dark-grey mt-1">
                        {new Date(payment.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.payments.length === 0 && (
            <div className="text-center py-8 text-dark-grey">
              No payment details available
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
