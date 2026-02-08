'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { getPartyColor } from '@/lib/theme'
import InterestDetailsModal from '@/components/dashboard/InterestDetailsModal'

interface PartySummary {
  party_name: string
  party_color: string | null
  total_amount: number
  payment_count: number
  mp_count: number
}

interface PartySummaryResponse {
  party: PartySummary
}

interface PaymentRow {
  id: number
  interestId: number | null
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
    party_color?: string | null
    thumbnail_url?: string | null
  } | null
  category: {
    id: number
    name: string
  } | null
}

export default function PartyDetailPage({ params }: { params: { party: string } }) {
  const partyName = decodeURIComponent(params.party)
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category') || ''
  const [data, setData] = useState<PartySummaryResponse | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState(categoryParam)
  const [amountSort, setAmountSort] = useState<'high' | 'low' | 'none'>('none')
  const [dateSort, setDateSort] = useState<'recent' | 'old' | 'none'>('none')
  const [selectedInterestId, setSelectedInterestId] = useState<number | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [summaryResponse, paymentsResponse] = await Promise.all([
          fetch(`/api/parties/${encodeURIComponent(partyName)}/summary`),
          fetch(`/api/parties/${encodeURIComponent(partyName)}/payments`),
        ])
        if (!summaryResponse.ok) throw new Error('Failed to fetch party data')
        if (!paymentsResponse.ok) throw new Error('Failed to fetch party payments')
        const summaryResult = await summaryResponse.json()
        const paymentsResult = await paymentsResponse.json()
        setData(summaryResult)
        setPayments(paymentsResult.payments || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [partyName])

  useEffect(() => {
    setCategoryFilter(categoryParam)
  }, [categoryParam])

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(
      payments.map(payment => payment.category?.name).filter(Boolean)
    )) as string[]
    return categories.sort()
  }, [payments])

  const filteredPayments = useMemo(() => {
    let next = categoryFilter
      ? payments.filter(payment => payment.category?.name === categoryFilter)
      : payments

    if (dateSort !== 'none') {
      next = [...next].sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0
        const bTime = b.date ? new Date(b.date).getTime() : 0
        return dateSort === 'recent' ? bTime - aTime : aTime - bTime
      })
    }

    if (amountSort !== 'none') {
      next = [...next].sort((a, b) => {
        const aAmount = a.amount || 0
        const bAmount = b.amount || 0
        return amountSort === 'high' ? bAmount - aAmount : aAmount - bAmount
      })
    }

    return next
  }, [payments, categoryFilter, amountSort, dateSort])

  const filteredSummary = useMemo(() => {
    const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
    const mpIds = new Set(filteredPayments.map(payment => payment.member?.id).filter(Boolean) as number[])
    return {
      totalAmount,
      paymentCount: filteredPayments.length,
      mpCount: mpIds.size,
    }
  }, [filteredPayments])

  const columns = [
    {
      key: 'date',
      header: (
        <div className="flex flex-col items-start gap-1">
          <span>Date Registered</span>
          <select
            value={dateSort}
            onChange={(e) => setDateSort(e.target.value as 'recent' | 'old' | 'none')}
            className="px-2 py-1 rounded border border-rose-quartz/30 bg-white text-near-black text-xs focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet"
          >
            <option value="none">Default</option>
            <option value="recent">Most recent</option>
            <option value="old">Oldest</option>
          </select>
        </div>
      ),
      className: 'whitespace-nowrap',
      render: (item: PaymentRow) => (
        <span className="text-sm text-dark-grey whitespace-nowrap">
          {formatDate(item.date) || '—'}
        </span>
      ),
    },
    {
      key: 'mp',
      header: 'MP',
      className: 'min-w-[220px]',
      render: (item: PaymentRow) => (
        <div className="flex items-center gap-3">
          {item.member?.thumbnail_url ? (
            <img
              src={item.member.thumbnail_url}
              alt={item.member.name_display}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: item.member?.party_color || '#B18FCF' }}
            >
              {(item.member?.name_display || 'MP').split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          )}
          <div>
            <span className="font-medium text-near-black">{item.member?.name_display || 'Unknown MP'}</span>
            {item.member?.constituency && (
              <span className="block text-xs text-dark-grey">{item.member.constituency}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      className: 'min-w-[180px]',
      render: (item: PaymentRow) => (
        <span className="inline-block px-2 py-0.5 bg-lavender/50 rounded text-sm">
          {item.category?.name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'payer',
      header: 'Payer/Donor',
      className: 'min-w-[200px]',
      render: (item: PaymentRow) => (
        <span className="text-sm font-medium">{item.payerName || '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: (
        <div className="flex flex-col items-end gap-1">
          <span>Amount</span>
          <select
            value={amountSort}
            onChange={(e) => setAmountSort(e.target.value as 'high' | 'low' | 'none')}
            className="px-2 py-1 rounded border border-rose-quartz/30 bg-white text-near-black text-xs focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet"
          >
            <option value="none">Default</option>
            <option value="high">High to low</option>
            <option value="low">Low to high</option>
          </select>
        </div>
      ),
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
      key: 'details',
      header: 'Details',
      className: 'min-w-[240px]',
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
        <h2 className="text-xl font-semibold text-near-black mb-2">Error loading party</h2>
        <p className="text-dark-grey">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/parties" className="text-violet hover:underline inline-block">
        ← Back to Parties
      </Link>

      <Card>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton height={28} />
            <Skeleton height={20} />
          </div>
        ) : data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: data.party.party_color || getPartyColor(data.party.party_name) }}
              />
              <h1 className="text-xl font-semibold text-near-black">
                {data.party.party_name === 'Conservative'
                  ? 'Conservative Party'
                  : data.party.party_name === 'Labour'
                    ? 'Labour Party'
                    : data.party.party_name}
              </h1>
            </div>
            <div className="text-xl font-semibold text-near-black whitespace-nowrap">
              {formatCurrency(data.party.total_amount)} • {data.party.payment_count} payments • {data.party.mp_count} MPs
            </div>
          </div>
        ) : null}
      </Card>

      <Card title="Payments">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-6 mb-4">
              <div className="min-w-[220px]">
                <label className="text-sm text-dark-grey block mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-quartz/30 bg-white text-near-black text-sm focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet"
                >
                  <option value="">All categories</option>
                  {categoryOptions.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                {categoryFilter && (
                  <div className="text-sm font-medium text-near-black whitespace-nowrap">
                    {formatCurrency(filteredSummary.totalAmount)} • {filteredSummary.paymentCount} payments • {filteredSummary.mpCount} MPs
                  </div>
                )}
              </div>
            </div>
            <Table
              data={filteredPayments}
              columns={columns}
              emptyMessage="No payments found."
              onRowClick={(item) => {
                if (item.interestId) setSelectedInterestId(item.interestId)
              }}
              rowClassName="table-row-clickable"
            />
          </>
        )}
      </Card>
      <InterestDetailsModal
        interestId={selectedInterestId}
        onClose={() => setSelectedInterestId(null)}
      />
    </div>
  )
}
