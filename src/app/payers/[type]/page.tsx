'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Select from '@/components/ui/Select'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import PayerPaymentsModal from '@/components/dashboard/PayerPaymentsModal'
import type { TopPayer } from '@/types/database'

interface PayersResponse {
  data: TopPayer[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  subtypes: string[]
}

const typeConfig: Record<string, { label: string; singular: string; dbType: string }> = {
  governments: { label: 'Governments', singular: 'Government', dbType: 'Government' },
  companies: { label: 'Companies', singular: 'Company', dbType: 'Company' },
  individuals: { label: 'Individuals', singular: 'Individual', dbType: 'Individual' },
}

export default function PayersListPage({ params }: { params: { type: string } | Promise<{ type: string }> }) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { type } = resolvedParams

  const [data, setData] = useState<PayersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedPayer, setSelectedPayer] = useState<TopPayer | null>(null)

  // Search and filter state
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState<'high' | 'low'>('high')
  const [subtype, setSubtype] = useState('')

  const config = typeConfig[type]

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchData = useCallback(async () => {
    if (!config) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        type: config.dbType,
        page: page.toString(),
        limit: '50',
        sort,
      })
      if (search) params.set('search', search)
      if (subtype) params.set('subtype', subtype)

      const response = await fetch(`/api/payers?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching payers:', error)
    } finally {
      setIsLoading(false)
    }
  }, [config, page, search, sort, subtype])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset filters when type changes
  useEffect(() => {
    setSearch('')
    setSearchInput('')
    setSort('high')
    setSubtype('')
    setPage(1)
  }, [type])

  if (!config) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Invalid payer type</h2>
        <p className="text-dark-grey mb-4">Please select a valid payer type.</p>
        <Link href="/" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const columns = [
    {
      key: 'rank',
      header: '#',
      className: 'w-16',
      render: (_: TopPayer, index: number) => (
        <span className="font-semibold text-dark-grey">{(page - 1) * 50 + index + 1}</span>
      ),
    },
    {
      key: 'name',
      header: config.singular,
      render: (item: TopPayer) => (
        <div>
          <span className="font-medium text-violet hover:text-violet/80 transition-colors">
            {item.name}
          </span>
          {item.payer_subtype && (
            <span className="block text-xs text-dark-grey">{item.payer_subtype}</span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Total Paid',
      className: 'text-right',
      render: (item: TopPayer) => (
        <span className="font-semibold">{formatCurrency(item.total_paid)}</span>
      ),
    },
    {
      key: 'mps',
      header: 'MPs Paid',
      className: 'text-right w-24',
      render: (item: TopPayer) => (
        <span className="text-dark-grey">{item.mp_count}</span>
      ),
    },
    {
      key: 'payments',
      header: 'Payments',
      className: 'text-right w-24',
      render: (item: TopPayer) => (
        <span className="text-dark-grey">{item.payment_count}</span>
      ),
    },
  ]

  const handleRowClick = (item: TopPayer) => {
    setSelectedPayer(item)
  }

  const handleSortChange = (value: string) => {
    setSort(value as 'high' | 'low')
    setPage(1)
  }

  const handleSubtypeChange = (value: string) => {
    setSubtype(value)
    setPage(1)
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setSort('high')
    setSubtype('')
    setPage(1)
  }

  const hasActiveFilters = search || sort !== 'high' || subtype

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/" className="text-violet hover:underline inline-block">
        ← Back to Dashboard
      </Link>

      <Card title={`All ${config.label}`}>
        {/* Search and Filters */}
        <div className="mb-4 pb-4 border-b border-rose-quartz/20">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={`Search ${config.label.toLowerCase()}...`}
                className="w-full px-3 py-2 rounded-lg border border-rose-quartz/30 bg-white text-near-black text-sm focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet"
              />
            </div>

            {/* Sort dropdown */}
            <Select
              value={sort}
              onChange={handleSortChange}
              options={[
                { value: 'high', label: 'Total Paid: High to Low' },
                { value: 'low', label: 'Total Paid: Low to High' },
              ]}
              placeholder="Sort by..."
              className="sm:w-52"
            />

            {/* Category/Subtype filter - hide for governments */}
            {type !== 'governments' && data?.subtypes && data.subtypes.length > 0 && (
              <Select
                value={subtype}
                onChange={handleSubtypeChange}
                options={data.subtypes.map(s => ({ value: s, label: s }))}
                placeholder="All Categories"
                className="sm:w-48"
              />
            )}
          </div>

          {/* Active filters summary and clear */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-dark-grey text-sm">
              {isLoading ? (
                'Loading...'
              ) : (
                <>Showing {data?.data.length || 0} of {data?.pagination.total || 0} {config.label.toLowerCase()}</>
              )}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-violet hover:text-violet/80 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : data?.data.length === 0 ? (
          <div className="text-center py-8 text-dark-grey">
            No {config.label.toLowerCase()} found
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="block mx-auto mt-2 text-violet hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <Table
              data={data?.data || []}
              columns={columns}
              onRowClick={handleRowClick}
              rowClassName="table-row-clickable"
            />

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-rose-quartz/20">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-dark-grey">
                  Page {page} of {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      <PayerPaymentsModal
        payerId={selectedPayer?.payer_id || null}
        payerName={selectedPayer?.name || ''}
        onClose={() => setSelectedPayer(null)}
      />
    </div>
  )
}
