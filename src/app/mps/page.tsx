'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import MPList from '@/components/mps/MPList'
import Select from '@/components/ui/Select'
import { useMPList } from '@/hooks/useMPList'

export default function MPsPage() {
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return 1
    try {
      const stored = sessionStorage.getItem('mps:state')
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
      const stored = sessionStorage.getItem('mps:state')
      if (!stored) return ''
      const parsed = JSON.parse(stored) as { party?: string }
      return parsed.party ?? ''
    } catch {
      return ''
    }
  })
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const stored = sessionStorage.getItem('mps:state')
      if (!stored) return ''
      const parsed = JSON.parse(stored) as { search?: string }
      return parsed.search ?? ''
    } catch {
      return ''
    }
  })
  const [searchInput, setSearchInput] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const stored = sessionStorage.getItem('mps:state')
      if (!stored) return ''
      const parsed = JSON.parse(stored) as { searchInput?: string; search?: string }
      return parsed.searchInput ?? parsed.search ?? ''
    } catch {
      return ''
    }
  })
  const [sort, setSort] = useState<'az' | 'high'>(() => {
    if (typeof window === 'undefined') return 'az'
    try {
      const stored = sessionStorage.getItem('mps:state')
      if (!stored) return 'az'
      const parsed = JSON.parse(stored) as { sort?: 'az' | 'high' }
      return parsed.sort ?? 'az'
    } catch {
      return 'az'
    }
  })

  const { data, isLoading, error } = useMPList({ page, party, search, sort })

  const scrollKey = useMemo(() => {
    const searchKey = search || 'all'
    const partyKey = party || 'all'
    return `mps:scroll:${page}:${partyKey}:${searchKey}:${sort}`
  }, [page, party, search, sort])
  const hasRestoredScroll = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('mps:state', JSON.stringify({
      page,
      party,
      search,
      searchInput,
      sort,
    }))
  }, [page, party, search, searchInput, sort])

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

  const handleSortChange = (value: string) => {
    setSort(value as 'az' | 'high')
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
        <Select
          value={sort}
          onChange={handleSortChange}
          options={[
            { value: 'az', label: 'A to Z' },
            { value: 'high', label: 'High to Low' },
          ]}
          placeholder="Sort by"
          className="min-w-[150px]"
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
