'use client'

import { useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import PayerPaymentsModal from './PayerPaymentsModal'
import type { TopPayer } from '@/types/database'

interface TopPayersTableProps {
  data: TopPayer[]
  payerType: 'Government' | 'Company' | 'Individual'
  isLoading?: boolean
}

const typeLabels: Record<string, { label: string; slug: string }> = {
  Government: { label: 'Governments', slug: 'governments' },
  Company: { label: 'Companies', slug: 'companies' },
  Individual: { label: 'Individuals', slug: 'individuals' },
}

export default function TopPayersTable({ data, payerType, isLoading }: TopPayersTableProps) {
  const [selectedPayer, setSelectedPayer] = useState<TopPayer | null>(null)

  const columns = [
    {
      key: 'rank',
      header: '#',
      className: 'w-12',
      render: (_: TopPayer, index: number) => (
        <span className="font-semibold text-dark-grey">{index + 1}</span>
      ),
    },
    {
      key: 'name',
      header: 'Payer',
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
      header: 'MPs',
      className: 'text-right w-16',
      render: (item: TopPayer) => (
        <span className="text-dark-grey">{item.mp_count}</span>
      ),
    },
  ]

  const handleRowClick = (item: TopPayer) => {
    setSelectedPayer(item)
  }

  const { label, slug } = typeLabels[payerType]

  const titleElement = (
    <Link
      href={`/payers/${slug}`}
      className="hover:text-violet transition-colors flex items-center gap-2"
    >
      Top {label}
      <span className="text-xs text-dark-grey font-normal">View all →</span>
    </Link>
  )

  return (
    <>
      <Card title={titleElement}>
        {isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : (
          <Table
            data={data}
            columns={columns}
            emptyMessage={`No ${label.toLowerCase()} found`}
            onRowClick={handleRowClick}
            rowClassName="table-row-clickable"
          />
        )}
      </Card>

      <PayerPaymentsModal
        payerId={selectedPayer?.payer_id || null}
        payerName={selectedPayer?.name || ''}
        onClose={() => setSelectedPayer(null)}
      />
    </>
  )
}
