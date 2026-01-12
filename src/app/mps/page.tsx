'use client'

import { useState } from 'react'
import MPList from '@/components/mps/MPList'
import Select from '@/components/ui/Select'
import { useMPList } from '@/hooks/useMPList'

export default function MPsPage() {
  const [page, setPage] = useState(1)
  const [party, setParty] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data, isLoading, error } = useMPList({ page, party, search })

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handlePartyChange = (value: string) => {
    setParty(value)
    setPage(1)
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Error loading MPs</h2>
        <p className="text-dark-grey">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-near-black">Members of Parliament</h1>
        <p className="text-dark-grey">
          Browse current MPs and their registered interests
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name..."
            className="w-full px-4 py-2 rounded-lg border border-rose-quartz/30 bg-white text-near-black
              focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet"
          />
        </div>
        <Select
          value={party}
          onChange={handlePartyChange}
          options={(data?.filterOptions.parties || []).map((p) => ({ value: p, label: p }))}
          placeholder="All parties"
          className="min-w-[200px]"
        />
        <button onClick={handleSearch} className="btn-primary">
          Search
        </button>
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-dark-grey">
          Showing {data.data.length} of {data.pagination.total} MPs
        </p>
      )}

      {/* MP List */}
      <MPList data={data?.data || []} isLoading={isLoading} />

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
    </div>
  )
}
