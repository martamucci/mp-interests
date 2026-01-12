'use client'

import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { getPartyColor } from '@/lib/theme'
import type { TopEarner } from '@/types/database'

interface TopEarnersCardProps {
  data: TopEarner[]
  filterType: 'category' | 'party'
  filterOptions: string[]
  selectedFilter: string
  onFilterChange: (value: string) => void
  isLoading?: boolean
  title?: string
}

export default function TopEarnersCard({
  data,
  filterType,
  filterOptions,
  selectedFilter,
  onFilterChange,
  isLoading,
  title,
}: TopEarnersCardProps) {
  const router = useRouter()

  const handleRowClick = (item: TopEarner) => {
    router.push(`/mps/${item.member_id}?from=dashboard`)
  }

  const columns = [
    {
      key: 'rank',
      header: '#',
      className: 'w-12',
      render: (_: TopEarner, index: number) => (
        <span className="font-semibold text-dark-grey">{index + 1}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: TopEarner) => (
        <div>
          <span className="font-medium text-violet hover:text-violet/70 transition-colors">
            {item.name_display}
          </span>
          {item.constituency && (
            <span className="block text-xs text-dark-grey">{item.constituency}</span>
          )}
        </div>
      ),
    },
    {
      key: 'party',
      header: 'Party',
      render: (item: TopEarner) => (
        <Badge color={getPartyColor(item.party_name)}>{item.party_name}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Total',
      className: 'text-right',
      render: (item: TopEarner) => (
        <span className="font-semibold">{formatCurrency(item.total_amount)}</span>
      ),
    },
  ]

  const filterLabel = filterType === 'category' ? 'Category' : 'Party'
  const cardTitle = title || `Top 5 Earners by ${filterLabel}`

  return (
    <Card title={cardTitle}>
      <div className="mb-4">
        <Select
          value={selectedFilter}
          onChange={onFilterChange}
          options={filterOptions.map((opt) => ({ value: opt, label: opt }))}
          placeholder={`Filter by ${filterLabel.toLowerCase()}...`}
          className="w-full"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : (
        <Table
          data={data}
          columns={columns}
          emptyMessage="No earners found"
          onRowClick={handleRowClick}
          rowClassName="table-row-clickable"
        />
      )}
    </Card>
  )
}
