'use client'

import { useState } from 'react'
import DashboardHero from '@/components/dashboard/DashboardHero'
import TopEarnersCard from '@/components/dashboard/TopEarnersCard'
import TopPayersTable from '@/components/dashboard/TopPayersTable'
import SearchWidget from '@/components/dashboard/SearchWidget'
import { useDashboardData, useTopEarners } from '@/hooks/useDashboardData'

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardData()

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState('')
  const [partyFilter, setPartyFilter] = useState('')

  // Get filtered earners
  const { data: categoryEarners, isLoading: categoryLoading } = useTopEarners('category', categoryFilter)
  const { data: partyEarners, isLoading: partyLoading } = useTopEarners('party', partyFilter)

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Error loading dashboard</h2>
        <p className="text-dark-grey">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero Section with Bubble Chart */}
      <DashboardHero
        lastUpdated={data?.lastUpdated}
        partyTotals={data?.partyTotals}
        isLoading={isLoading}
      />

      {/* Top Earners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopEarnersCard
          data={categoryFilter ? categoryEarners : (data?.topEarnersByCategory || [])}
          filterType="category"
          filterOptions={data?.filterOptions.categories || []}
          selectedFilter={categoryFilter}
          onFilterChange={setCategoryFilter}
          isLoading={isLoading || categoryLoading}
          title="Top 5 Earners by Category"
        />
        <TopEarnersCard
          data={partyFilter ? partyEarners : (data?.topEarnersByParty || [])}
          filterType="party"
          filterOptions={data?.filterOptions.parties || []}
          selectedFilter={partyFilter}
          onFilterChange={setPartyFilter}
          isLoading={isLoading || partyLoading}
          title="Top 5 Earners by Party"
        />
      </div>

      {/* Top Payers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopPayersTable
          data={data?.topPayers.governments || []}
          payerType="Government"
          isLoading={isLoading}
        />
        <TopPayersTable
          data={data?.topPayers.companies || []}
          payerType="Company"
          isLoading={isLoading}
        />
        <TopPayersTable
          data={data?.topPayers.individuals || []}
          payerType="Individual"
          isLoading={isLoading}
        />
      </div>

      {/* Search Widget */}
      <SearchWidget />
    </div>
  )
}
