'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { getPartyColor } from '@/lib/theme'

interface PaymentDetails {
  id: number
  amount: number | null
  amountRaw: string | null
  currency: string
  paymentType: string | null
  regularity: string | null
  roleDescription: string | null
  hoursWorked: number | null
  hoursPeriod: string | null
  hourlyRate: number | null
  payerName: string | null
  payerAddress: string | null
  payerNatureOfBusiness: string | null
  startDate: string | null
  endDate: string | null
  receivedDate: string | null
  registrationDate: string | null
  purpose: string | null
  destination: string | null
  donationDescription: string | null
  summary: string | null
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

interface PaymentDetailsModalProps {
  paymentId: number | null
  onClose: () => void
}

export default function PaymentDetailsModal({ paymentId, onClose }: PaymentDetailsModalProps) {
  const [payment, setPayment] = useState<PaymentDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!paymentId) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/payments/${paymentId}`)
        if (!response.ok) throw new Error('Failed to fetch payment details')
        const result = await response.json()
        setPayment(result.payment)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [paymentId])

  const displayDate = payment?.receivedDate || payment?.startDate || payment?.registrationDate || null

  return (
    <Modal isOpen={!!paymentId} onClose={onClose} title="Payment details">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-dark-grey">{error}</div>
      ) : payment ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-near-black">
                  {payment.member?.name_display || 'Unknown MP'}
                </span>
                {payment.member?.party_name && (
                  <Badge color={getPartyColor(payment.member.party_name)} size="sm">
                    {payment.member.party_name}
                  </Badge>
                )}
              </div>
              {payment.member?.constituency && (
                <div className="text-xs text-dark-grey">{payment.member.constituency}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-near-black">
                {payment.amount ? formatCurrency(payment.amount) : '—'}
              </div>
              <div className="text-xs text-dark-grey mt-1">
                {formatDate(displayDate) || '—'}
              </div>
            </div>
          </div>

          {payment.category?.name && (
            <div className="text-sm">
              <span className="text-dark-grey">Category: </span>
              <span className="text-near-black">{payment.category.name}</span>
            </div>
          )}

          {payment.payerName && (
            <div className="text-sm">
              <span className="text-dark-grey">Payer: </span>
              <span className="text-near-black">{payment.payerName}</span>
            </div>
          )}

          {(() => {
            const payerPrefix = payment.payerName
              ? new RegExp(`^${payment.payerName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*-\\s*£[0-9,\\.]+\\s*`, 'i')
              : null
            const cleanedSummary = payment.summary
              ? payment.summary.replace(payerPrefix || /^$/, '').trim()
              : null
            const detailsText =
              payment.roleDescription ||
              payment.purpose ||
              payment.donationDescription ||
              cleanedSummary

            if (!detailsText) return null

            const payerMatch = payment.payerName
              ? new RegExp(`^${payment.payerName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*(?:-\\s*£[0-9,\\.]+)?\\s*$`, 'i')
              : null

            if (payerMatch && payerMatch.test(detailsText)) {
              return null
            }

            return (
              <div className="text-sm text-dark-grey">
                <span className="text-near-black">Details: </span>
                {detailsText}
              </div>
            )
          })()}

          {payment.purpose && (
            <div className="text-sm">
              <span className="text-dark-grey">Purpose: </span>
              <span className="text-near-black">{payment.purpose}</span>
            </div>
          )}

          {payment.destination && (
            <div className="text-sm">
              <span className="text-dark-grey">Destination: </span>
              <span className="text-near-black">{payment.destination}</span>
            </div>
          )}

          {payment.donationDescription && (
            <div className="text-sm text-dark-grey">{payment.donationDescription}</div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs text-dark-grey">
            {payment.regularity && <div>Regularity: {payment.regularity}</div>}
            {payment.hoursWorked && <div>Hours: {payment.hoursWorked}</div>}
            {payment.hourlyRate && <div>Hourly rate: {formatCurrency(payment.hourlyRate)}</div>}
            {payment.startDate && <div>Start date: {payment.startDate}</div>}
            {payment.endDate && <div>End date: {payment.endDate}</div>}
            {payment.payerNatureOfBusiness && <div>Nature of business: {payment.payerNatureOfBusiness}</div>}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
