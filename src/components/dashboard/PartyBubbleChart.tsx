'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import PlotlyWrapper from '@/components/charts/PlotlyWrapper'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { getPartyColor } from '@/lib/theme'
import type { PartyTotal } from '@/types/database'

interface PartyBubbleChartProps {
  data: PartyTotal[]
  isLoading?: boolean
}

function formatCurrencyLabel(amount: number): string {
  if (amount >= 1000000) {
    return '£' + (amount / 1000000).toFixed(1) + 'M'
  }
  if (amount >= 1000) {
    return '£' + (amount / 1000).toFixed(0) + 'K'
  }
  return '£' + amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function formatFullCurrency(amount: number): string {
  return '£' + amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

interface TooltipData {
  party: PartyTotal
  percentage: number
  x: number
  y: number
}

export default function PartyBubbleChart({ data, isLoading }: PartyBubbleChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleHover = useCallback((event: Plotly.PlotHoverEvent) => {
    if (event.points && event.points[0] && containerRef.current) {
      const point = event.points[0]
      const customdata = point.customdata as unknown as PartyTotal & { percentage: number }
      const rect = containerRef.current.getBoundingClientRect()

      setTooltip({
        party: customdata,
        percentage: customdata.percentage,
        x: (event.event as MouseEvent).clientX - rect.left,
        y: (event.event as MouseEvent).clientY - rect.top,
      })
    }
  }, [])

  const handleUnhover = useCallback(() => {
    setTooltip(null)
  }, [])

  const chartData = useMemo(() => {
    if (!data.length) return null

    // Sort by total_amount descending and filter out zero amounts
    const sortedData = [...data]
      .filter((d) => d.total_amount > 0)
      .sort((a, b) => b.total_amount - a.total_amount)

    const grandTotal = sortedData.reduce((sum, d) => sum + d.total_amount, 0)
    const maxAmount = sortedData[0]?.total_amount || 1

    // Calculate positions for bubble packing
    // Use a simple grid-like layout with larger bubbles in the center
    const positions: { x: number; y: number; size: number; party: PartyTotal; percentage: number }[] = []

    sortedData.forEach((d, index) => {
      const percentage = (d.total_amount / grandTotal) * 100
      // Scale bubble size based on amount (min 20, max 80)
      const normalizedSize = Math.sqrt(d.total_amount / maxAmount)
      const size = 20 + normalizedSize * 60

      // Position bubbles in a cluster pattern (rotated 90 degrees)
      let x: number, y: number

      if (index === 0) {
        // Largest bubble in center
        x = 0.5
        y = 0.35
      } else if (index === 1) {
        // Second largest below
        x = 0.45
        y = 0.7
      } else if (index === 2) {
        // Third to the right
        x = 0.75
        y = 0.55
      } else if (index === 3) {
        // Fourth bottom right
        x = 0.25
        y = 0.8
      } else if (index === 4) {
        // Fifth top
        x = 0.35
        y = 0.15
      } else if (index === 5) {
        // Sixth top right
        x = 0.8
        y = 0.25
      } else {
        // Remaining bubbles scattered
        const angle = (index - 6) * (Math.PI / 4) + Math.PI / 8
        const radius = 0.3 + (index % 3) * 0.1
        x = 0.5 + Math.sin(angle) * radius
        y = 0.5 + Math.cos(angle) * radius
      }

      positions.push({ x, y, size, party: d, percentage })
    })

    return positions
  }, [data])

  if (isLoading || !chartData) {
    return <ChartSkeleton height={280} />
  }

  const traces: Plotly.Data[] = chartData.map((item) => {
    const partyColor = item.party.party_color || getPartyColor(item.party.party_name)
    const showLabel = item.size > 35

    return {
      type: 'scatter' as const,
      mode: 'text+markers' as const,
      x: [item.x],
      y: [item.y],
      text: showLabel ? [item.party.party_name.split(' ')[0]] : [''],
      textposition: 'middle center' as const,
      textfont: {
        color: '#ffffff',
        size: Math.max(9, item.size / 6),
        family: 'Inter, system-ui, sans-serif',
        weight: 600,
      },
      marker: {
        size: [item.size],
        color: partyColor,
        opacity: 0.9,
        line: {
          color: 'rgba(255,255,255,0.4)',
          width: 2,
        },
      },
      hoverinfo: 'none' as const,
      showlegend: false,
      customdata: [{ ...item.party, percentage: item.percentage }] as unknown as Plotly.Datum[],
    }
  })

  const layout: Partial<Plotly.Layout> = {
    xaxis: {
      range: [0, 1],
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      showline: false,
      fixedrange: true,
    },
    yaxis: {
      range: [0, 1],
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      showline: false,
      fixedrange: true,
      scaleanchor: 'x',
      scaleratio: 1,
    },
    height: 280,
    margin: { t: 10, b: 10, l: 10, r: 10 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    hovermode: 'closest' as const,
  }

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: false,
    staticPlot: false,
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <PlotlyWrapper
        data={traces}
        layout={layout}
        config={config}
        onHover={handleHover}
        onUnhover={handleUnhover}
      />

      {/* Custom Tooltip */}
      {tooltip && (
        <div
          className="party-tooltip"
          style={{
            left: Math.min(Math.max(tooltip.x - 70, 10), (containerRef.current?.offsetWidth || 300) - 160),
            top: Math.max(tooltip.y - 100, 10),
          }}
        >
          <div className="party-tooltip-title">{tooltip.party.party_name}</div>
          <div className="party-tooltip-grid">
            <span className="party-tooltip-label">Total</span>
            <span className="party-tooltip-value">{formatFullCurrency(tooltip.party.total_amount)}</span>
            <span className="party-tooltip-label">MPs</span>
            <span className="party-tooltip-value">{tooltip.party.mp_count}</span>
            <span className="party-tooltip-label">Payments</span>
            <span className="party-tooltip-value">{tooltip.party.payment_count}</span>
            <span className="party-tooltip-label">Share</span>
            <span className="party-tooltip-value">{tooltip.percentage.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
