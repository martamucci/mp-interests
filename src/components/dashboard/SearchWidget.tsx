'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import type { SearchResponse, SearchResult } from '@/types/api'
import { formatCurrency } from '@/lib/utils/currency'

export default function SearchWidget() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError('Failed to search. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const renderResult = (item: SearchResult, index: number) => {
    const data = item.data as Record<string, unknown>

    return (
      <div
        key={index}
        className="p-3 bg-lavender/50 rounded-lg border border-rose-quartz/20"
      >
        {item.type === 'member' && (
          <div>
            <span className="font-medium">{String(data.name || '')}</span>
            <span className="text-dark-grey text-sm ml-2">({String(data.party || '')})</span>
            {typeof data.totalAmount === 'number' && (
              <span className="block text-sm">
                Total: {formatCurrency(data.totalAmount)}
              </span>
            )}
          </div>
        )}
        {item.type === 'interest' && (
          <div>
            <span className="font-medium">{String(data.mpName || '')}</span>
            <span className="text-dark-grey text-sm ml-2">({String(data.party || '')})</span>
            {typeof data.amount === 'number' && (
              <span className="block text-sm">
                {formatCurrency(data.amount)} from {String(data.payer || '')}
              </span>
            )}
            {typeof data.role === 'string' && data.role && (
              <span className="block text-xs text-dark-grey">{data.role}</span>
            )}
          </div>
        )}
        {item.type === 'payer' && (
          <div>
            <span className="font-medium">{String(data.name || '')}</span>
            <span className="text-dark-grey text-sm ml-2">({String(data.type || '')})</span>
            {typeof data.totalPaid === 'number' && (
              <span className="block text-sm">
                Total paid: {formatCurrency(data.totalPaid)} to {String(data.mpCount || 0)} MPs
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card title="Search" subtitle="Ask questions about the register data">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., 'Which MPs received the most?' or 'Payments from BBC'"
            className="flex-1 px-4 py-2 rounded-lg border border-rose-quartz/30 bg-white text-near-black
              focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-dark-grey italic">{result.interpretation}</p>

            {result.results.length > 0 ? (
              <div className="space-y-2">
                {result.results.slice(0, 5).map(renderResult)}
              </div>
            ) : (
              <p className="text-dark-grey">No results found.</p>
            )}

            {result.suggestions && result.suggestions.length > 0 && (
              <div className="pt-2 border-t border-rose-quartz/20">
                <p className="text-xs text-dark-grey mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {result.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(suggestion)}
                      className="text-xs px-2 py-1 rounded bg-violet/10 text-violet hover:bg-violet/20"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
