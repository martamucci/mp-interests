'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { getPartyColor } from '@/lib/theme'

interface PartySummary {
  party_name: string
  party_color: string | null
  total_amount: number
  payment_count: number
  mp_count: number
}

interface CategorySummary {
  category_name: string
  total_amount: number
  payment_count: number
}

interface PartiesSummaryResponse {
  parties: PartySummary[]
  categoriesByParty: Array<{
    party_name: string
    party_color: string | null
    categories: CategorySummary[]
  }>
}

function PartyCategoryBreakdown({
  partyName,
  categories,
}: {
  partyName: string
  categories: CategorySummary[]
}) {
  const categoryColumns = useMemo(() => ([
    {
      key: 'category',
      header: 'Category',
      render: (item: CategorySummary) => (
        <Link
          href={`/parties/${encodeURIComponent(partyName)}?category=${encodeURIComponent(item.category_name)}`}
          className="font-medium text-violet hover:text-violet/80 transition-colors"
        >
          {item.category_name}
        </Link>
      ),
    },
    {
      key: 'total',
      header: 'Total Paid',
      className: 'text-right',
      render: (item: CategorySummary) => (
        <span className="font-semibold">{formatCurrency(item.total_amount)}</span>
      ),
    },
    {
      key: 'payments',
      header: 'Payments',
      className: 'text-right w-24',
      render: (item: CategorySummary) => (
        <span className="text-dark-grey">{item.payment_count}</span>
      ),
    },
  ]), [partyName])

  return (
    <Table
      data={categories}
      columns={categoryColumns}
      emptyMessage="No category data available."
    />
  )
}

export default function PartiesPage() {
  const [data, setData] = useState<PartiesSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/parties/summary')
        if (!response.ok) throw new Error('Failed to fetch party summary')
        const result = await response.json()
        setData(result)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Error loading parties</h2>
        <p className="text-dark-grey">{error}</p>
      </div>
    )
  }

  const partyTotalsMap = useMemo(() => {
    const map = new Map<string, PartySummary>()
    for (const party of data?.parties || []) {
      map.set(party.party_name, party)
    }
    return map
  }, [data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-near-black">Parties</h1>
        <p className="text-dark-grey">
          Breakdown of payments by party and by category
        </p>
      </div>

      <Card title="Party Category Breakdown">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {(data?.categoriesByParty || []).map((party) => (
              <details key={party.party_name} className="group rounded-lg border border-rose-quartz/20">
                <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-dark-grey transition-transform group-open:rotate-90">▸</span>
                    <span
                      className="inline-flex w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: party.party_color || getPartyColor(party.party_name) }}
                    />
                    <Link
                      href={`/parties/${encodeURIComponent(party.party_name)}`}
                      className="font-medium text-near-black hover:text-violet transition-colors"
                    >
                      {party.party_name === 'Conservative'
                        ? 'Conservative Party'
                        : party.party_name === 'Labour'
                          ? 'Labour Party'
                          : party.party_name}
                    </Link>
                  </div>
                  <div className="text-sm font-medium text-near-black">
                    {formatCurrency(partyTotalsMap.get(party.party_name)?.total_amount || 0)} •{' '}
                    {partyTotalsMap.get(party.party_name)?.payment_count || 0} payments •{' '}
                    {partyTotalsMap.get(party.party_name)?.mp_count || 0} MPs
                  </div>
                </summary>
                <div className="px-3 pb-3">
                  <PartyCategoryBreakdown
                    partyName={party.party_name}
                    categories={party.categories}
                  />
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
