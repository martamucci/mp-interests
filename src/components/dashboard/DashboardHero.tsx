'use client'

import { formatDate } from '@/lib/utils/dates'
import PartyBubbleChart from './PartyBubbleChart'
import type { PartyTotal } from '@/types/database'

interface DashboardHeroProps {
  lastUpdated?: string
  partyTotals?: PartyTotal[]
  isLoading?: boolean
}

export default function DashboardHero({ lastUpdated, partyTotals = [], isLoading }: DashboardHeroProps) {
  return (
    <section className="hero-section px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-8">
      <div className="relative z-10">
        {/* Main layout: Text left, Chart right */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-8">
          {/* Left: Text content */}
          <div className="flex-shrink-0 lg:w-[280px] xl:w-[320px]">
            {/* Title block */}
            <div className="space-y-2">
              <h1 className="hero-title">Dashboard</h1>
              <p className="hero-subtitle">
                UK Parliament Register of Members' Financial Interests
              </p>
            </div>

            {/* Description */}
            <p className="hero-description mt-3">
              Financial interests record outside earnings, gifts, and benefits received by MPs;
              they indicate potential conflicts where private gain could influence parliamentary judgement.
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {lastUpdated && (
                <span className="stat-pill">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Updated {formatDate(lastUpdated)}
                </span>
              )}
              <span className="stat-pill">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                650 MPs
              </span>
              <span className="stat-pill">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Public Record
              </span>
            </div>
          </div>

          {/* Right: Bubble Chart */}
          <div className="flex-1 mt-6 lg:mt-0 min-w-0">
            <div className="h-[220px] sm:h-[260px] lg:h-[280px]">
              <PartyBubbleChart data={partyTotals} isLoading={isLoading} />
            </div>
            <p className="text-xs text-center text-rose-quartz mt-1">
              Total Registered Payments by Party
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
