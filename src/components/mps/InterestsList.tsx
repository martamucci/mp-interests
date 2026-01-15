'use client'

import Table from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import type { MPInterest } from '@/types/api'

interface InterestsListProps {
  interests: MPInterest[]
}

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

export default function InterestsList({ interests }: InterestsListProps) {
  const columns = [
    {
      key: 'category',
      header: 'Category',
      render: (item: MPInterest) => (
        <span className="inline-block px-2 py-0.5 bg-lavender/50 rounded text-sm">
          {item.category}
        </span>
      ),
    },
    {
      key: 'payer',
      header: 'Payer/Donor',
      render: (item: MPInterest) => (
        <div className="max-w-xs">
          <span className="text-sm font-medium">{item.payerName || '—'}</span>
          {/* Show job role for employment category */}
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
      render: (item: MPInterest) => (
        <div className="text-right">
          <span className="font-semibold">
            {item.amount ? formatCurrency(item.amount) : '—'}
          </span>
          {/* Show hours for employment if available */}
          {item.hoursWorked && (
            <span className="block text-xs text-dark-grey mt-0.5">
              {item.hoursWorked}h worked
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'dateReceived',
      header: 'Date Received',
      render: (item: MPInterest) => (
        <span className="text-sm text-dark-grey whitespace-nowrap">
          {formatDate(item.date) || '—'}
        </span>
      ),
    },
    {
      key: 'dateRegistered',
      header: 'Date Registered',
      render: (item: MPInterest) => (
        <span className="text-sm text-dark-grey whitespace-nowrap">
          {formatDate(item.registrationDate) || '—'}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (item: MPInterest) => (
        <div className="max-w-sm text-sm">
          {/* Show destination and purpose for visits */}
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
                <span className="text-dark-grey line-clamp-2">{item.summary}</span>
              )}
            </>
          )}
          {/* Show donation description for donations/gifts categories */}
          {isDonationOrGiftCategory(item.category) && (
            <>
              {item.donationDescription && (
                <span className="text-dark-grey line-clamp-2">{item.donationDescription}</span>
              )}
              {!item.donationDescription && item.summary && (
                <span className="text-dark-grey line-clamp-2">{item.summary}</span>
              )}
              {!item.donationDescription && !item.summary && (
                <span className="text-dark-grey">—</span>
              )}
            </>
          )}
          {/* For other categories, show summary */}
          {!isVisitsCategory(item.category) && !isDonationOrGiftCategory(item.category) && (
            <span className="text-dark-grey line-clamp-2">
              {item.summary || '—'}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <Table
      data={interests}
      columns={columns}
      emptyMessage="No registered interests found."
    />
  )
}
