'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'

interface PaymentRow {
  id: number
  amount: number | null
  payerName: string | null
  roleDescription: string | null
  hoursWorked: number | null
  hourlyRate: number | null
  date: string | null
  summary: string | null
  purpose: string | null
  destination: string | null
  donationDescription: string | null
  member: {
    id: number
    name_display: string
    party_name: string
    constituency: string | null
  } | null
}

export default function PartyCategoryPage({ params }: { params: { party: string; category: string } }) {
  const partyName = decodeURIComponent(params.party)
  const categoryName = decodeURIComponent(params.category)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/parties/${encodeURIComponent(partyName)}/categories/${encodeURIComponent(categoryName)}/payments`)
        if (!response.ok) throw new Error('Failed to fetch payments')
        const result = await response.json()
        setPayments(result.payments || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [partyName, categoryName])

  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  const columns = [
    {
      key: 'mp',
      header: 'MP',
      render: (item: PaymentRow) => (
        <div>
          <span className="font-medium text-near-black">{item.member?.name_display || 'Unknown MP'}</span>
          {item.member?.constituency && (
            <span className="block text-xs text-dark-grey">{item.member.constituency}</span>
          )}
        </div>
      ),
    },
    {
      key: 'payer',
      header: 'Payer',
      render: (item: PaymentRow) => (
        <span className="text-sm font-medium">{item.payerName || '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (item: PaymentRow) => (
        <div className="text-right">
          <span className="font-semibold">{item.amount ? formatCurrency(item.amount) : '—'}</span>
          {item.hoursWorked && (
            <span className="block text-xs text-dark-grey mt-0.5">
              {item.hoursWorked}h worked
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (item: PaymentRow) => (
        <span className="text-sm text-dark-grey whitespace-nowrap">
          {formatDate(item.date) || '—'}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (item: PaymentRow) => (
        <div className="max-w-sm text-sm">
          {item.destination && (
            <div className="mb-1">
              <span className="text-dark-grey">Destination: </span>
              <span className="text-near-black">{item.destination}</span>
            </div>
          )}
          {item.purpose && (
            <div>
              <span className="text-dark-grey">Purpose: </span>
              <span className="text-near-black">{item.purpose}</span>
            </div>
          )}
          {item.donationDescription && (
            <span className="text-dark-grey line-clamp-2">{item.donationDescription}</span>
          )}
          {!item.destination && !item.purpose && !item.donationDescription && (
            <span className="text-dark-grey line-clamp-2">
              {item.roleDescription || item.summary || '—'}
            </span>
          )}
        </div>
      ),
    },
  ]

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Error loading payments</h2>
        <p className="text-dark-grey">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/parties/${encodeURIComponent(partyName)}`} className="text-violet hover:underline inline-block">
        ← Back to {partyName}
      </Link>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-xl font-semibold text-near-black">{partyName}</h1>
            <p className="text-dark-grey">{categoryName}</p>
          </div>
          <div className="text-sm font-medium text-near-black">
            {formatCurrency(totalAmount)} • {payments.length} payments
          </div>
        </div>
      </Card>

      <Card title="Payments">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        ) : (
          <Table
            data={payments}
            columns={columns}
            emptyMessage="No payments found."
          />
        )}
      </Card>
    </div>
  )
}
