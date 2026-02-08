'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Table from '@/components/ui/Table'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { useLatestInterests, type LatestInterest } from '@/hooks/useLatestInterests'
import InterestDetailsModal from '@/components/dashboard/InterestDetailsModal'

// Check if category is employment related
function isEmploymentCategory(category: string): boolean {
  const lower = category.toLowerCase()
  return lower.includes('employment') || lower.includes('earnings')
}

// Check if category is visits related
function isVisitsCategory(category: string): boolean {
  const lower = category.toLowerCase()
  return lower.includes('visit') || lower.includes('overseas') || lower.includes('travel')
}

// Check if category is donations/gifts related
function isDonationOrGiftCategory(category: string): boolean {
  const lower = category.toLowerCase()
  return lower.includes('donation') || lower.includes('gifts') || lower.includes('hospitality')
}

export default function LatestInterestsPage() {
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return 1
    try {
      const stored = sessionStorage.getItem('latest:state')
      if (!stored) return 1
      const parsed = JSON.parse(stored) as { page?: number }
      return parsed.page ?? 1
    } catch {
      return 1
    }
  })
  const [party, setParty] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const stored = sessionStorage.getItem('latest:state')
      if (!stored) return ''
      const parsed = JSON.parse(stored) as { party?: string }
      return parsed.party ?? ''
    } catch {
      return ''
    }
  })
  const [selectedInterestId, setSelectedInterestId] = useState<number | null>(null)

  const { data, isLoading, error } = useLatestInterests({ page, limit: 50, party })

  const handlePartyChange = (value: string) => {
    setParty(value)
    setPage(1) // Reset to first page when filter changes
  }

  const scrollKey = useMemo(() => `latest:scroll:${page}:${party || 'all'}`, [page, party])
  const hasRestoredScroll = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('latest:state', JSON.stringify({ page, party }))
  }, [page, party])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = sessionStorage.getItem(scrollKey)
    if (!saved || hasRestoredScroll.current) return
    if (isLoading) return
    const y = Number(saved)
    if (Number.isFinite(y)) {
      window.scrollTo(0, y)
      hasRestoredScroll.current = true
    }
  }, [scrollKey, isLoading])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const save = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY))
    }
    return () => save()
  }, [scrollKey])

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Error loading latest interests</h2>
        <p className="text-dark-grey">{error}</p>
      </div>
    )
  }

  const columns = [
    {
      key: 'dateRegistered',
      header: 'Date Registered',
      render: (item: LatestInterest) => (
        <span className="text-sm text-dark-grey whitespace-nowrap">
          {formatDate(item.registrationDate) || '—'}
        </span>
      ),
    },
    {
      key: 'dateReceived',
      header: 'Date Received',
      render: (item: LatestInterest) => (
        <span className="text-sm text-dark-grey whitespace-nowrap">
          {formatDate(item.date) || '—'}
        </span>
      ),
    },
    {
      key: 'member',
      header: 'MP',
      className: 'min-w-[260px]',
      render: (item: LatestInterest) => (
        <Link
          href={`/mps/${item.member.id}?from=latest`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          onClick={(event) => event.stopPropagation()}
        >
          {item.member.thumbnailUrl ? (
            <img
              src={item.member.thumbnailUrl}
              alt={item.member.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: item.member.partyColor }}
            >
              {item.member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-near-black block">{item.member.name}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${item.member.partyColor}20`,
                color: item.member.partyColor,
              }}
            >
              {item.member.party}
            </span>
          </div>
        </Link>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      className: 'min-w-[200px]',
      render: (item: LatestInterest) => (
        <span className="inline-block px-2 py-0.5 bg-lavender/50 rounded text-sm">
          {item.category}
        </span>
      ),
    },
    {
      key: 'payer',
      header: 'Payer/Donor',
      render: (item: LatestInterest) => (
        <div className="max-w-xs">
          <span className="text-sm font-medium">{item.payerName || '—'}</span>
          {isEmploymentCategory(item.category) && item.roleDescription && (
            <span className="block text-xs text-dark-grey mt-1">
              Role: {item.roleDescription}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (item: LatestInterest) => (
        <div className="text-right">
          <span className="font-semibold">
            {item.amount ? formatCurrency(item.amount) : '—'}
          </span>
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
      className: 'w-[320px]',
      render: (item: LatestInterest) => (
        <div className="text-sm line-clamp-3">
          {isVisitsCategory(item.category) && (
            <>
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
              {!item.destination && !item.purpose && item.summary && (
                <span className="text-dark-grey">{item.summary}</span>
              )}
            </>
          )}
          {isDonationOrGiftCategory(item.category) && (
            <>
              {item.donationDescription && (
                <span className="text-dark-grey">{item.donationDescription}</span>
              )}
              {!item.donationDescription && item.summary && (
                <span className="text-dark-grey">{item.summary}</span>
              )}
              {!item.donationDescription && !item.summary && (
                <span className="text-dark-grey">—</span>
              )}
            </>
          )}
          {!isVisitsCategory(item.category) && !isDonationOrGiftCategory(item.category) && (
            <span className="text-dark-grey">
              {item.summary || '—'}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-near-black">Latest Interests</h1>
        <p className="text-dark-grey">
          Recently registered interests from the past month, newest first
        </p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select
          value={party}
          onChange={handlePartyChange}
          options={(data?.filterOptions?.parties || []).map((p) => ({ value: p, label: p }))}
          placeholder="All parties"
          className="min-w-[200px]"
        />
        {party && (
          <button
            onClick={() => handlePartyChange('')}
            className="text-sm text-violet hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-dark-grey">
          Showing {data.data.length} of {data.pagination.total} interests from the past month
          {party && ` for ${party}`}
        </p>
      )}

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} height={60} />
            ))}
          </div>
        ) : (
          <Table
            data={data?.data || []}
            columns={columns}
            emptyMessage="No interests registered in the past month."
            onRowClick={(item) => {
              setSelectedInterestId(item.id)
            }}
            rowClassName="hover:bg-lavender/50 cursor-pointer"
          />
        )}
      </Card>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 text-dark-grey">
            Page {page} of {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            className="btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <InterestDetailsModal
        interestId={selectedInterestId}
        onClose={() => setSelectedInterestId(null)}
      />
    </div>
  )
}
