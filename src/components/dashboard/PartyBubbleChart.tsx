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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleHover = useCallback((event: Plotly.PlotHoverEvent) => {
    if (event.points && event.points[0] && containerRef.current) {
      const point = event.points[0]
      const customdata = point.customdata as unknown as PartyTotal & { percentage: number }
      const rect = containerRef.current.getBoundingClientRect()

      // Get the trace index for hover animation
      const traceIndex = point.curveNumber

      setHoveredIndex(traceIndex)
      setTooltip({
        party: customdata,
        percentage: customdata.percentage,
        x: (event.event as MouseEvent).clientX - rect.left,
        y: (event.event as MouseEvent).clientY - rect.top,
      })
    }
  }, [])

  const handleUnhover = useCallback(() => {
    setHoveredIndex(null)
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
      // Scale bubble size based on amount (min 42, max 144) - increased by 20%
      const normalizedSize = Math.sqrt(d.total_amount / maxAmount)
      const size = 42 + normalizedSize * 102

      // Position bubbles in a spread-out pattern - keep away from top (title) and bottom (tooltip)
      // Y range constrained to 0.15-0.85 to avoid title/tooltip overlap
      let x: number, y: number

      if (index === 0) {
        // Largest bubble in center
        x = 0.4
        y = 0.5
      } else if (index === 1) {
        // Second largest to the right
        x = 0.75
        y = 0.45
      } else if (index === 2) {
        // Third upper left
        x = 0.18
        y = 0.3
      } else if (index === 3) {
        // Fourth lower right
        x = 0.85
        y = 0.75
      } else if (index === 4) {
        // Fifth lower left
        x = 0.2
        y = 0.72
      } else if (index === 5) {
        // Sixth upper right
        x = 0.9
        y = 0.22
      } else if (index === 6) {
        // Seventh middle left edge
        x = 0.08
        y = 0.5
      } else if (index === 7) {
        // Eighth upper center
        x = 0.55
        y = 0.18
      } else if (index === 8) {
        // Ninth lower center
        x = 0.5
        y = 0.82
      } else if (index === 9) {
        // Tenth right edge
        x = 0.95
        y = 0.55
      } else {
        // Remaining bubbles spread in available gaps
        const extraPositions = [
          { x: 0.35, y: 0.2 },
          { x: 0.65, y: 0.78 },
          { x: 0.12, y: 0.82 },
          { x: 0.92, y: 0.4 },
        ]
        const pos = extraPositions[(index - 10) % extraPositions.length]
        x = pos.x
        y = pos.y
      }

      positions.push({ x, y, size, party: d, percentage })
    })

    return positions
  }, [data])

  if (isLoading || !chartData) {
    return <ChartSkeleton height={280} />
  }

  const traces: Plotly.Data[] = chartData.map((item, index) => {
    const partyColor = item.party.party_color || getPartyColor(item.party.party_name)
    const showLabel = item.size > 60
    const isHovered = hoveredIndex === index

    // Apply hover scaling effect
    const hoverScale = isHovered ? 1.15 : 1
    const animatedSize = item.size * hoverScale

    return {
      type: 'scatter' as const,
      mode: 'text+markers' as const,
      x: [item.x],
      y: [item.y],
      text: showLabel ? [item.party.party_name.split(' ')[0]] : [''],
      textposition: 'middle center' as const,
      textfont: {
        color: '#ffffff',
        size: Math.max(9, animatedSize / 6),
        family: 'Inter, system-ui, sans-serif',
        weight: 600,
      },
      marker: {
        size: [animatedSize],
        color: partyColor,
        opacity: isHovered ? 1 : 0.85,
        line: {
          color: isHovered ? '#ffffff' : 'rgba(255,255,255,0.4)',
          width: isHovered ? 3 : 2,
        },
      },
      hoverinfo: 'none' as const,
      showlegend: false,
      customdata: [{ ...item.party, percentage: item.percentage }] as unknown as Plotly.Datum[],
    }
  })

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    xaxis: {
      range: [-0.05, 1.05],
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      showline: false,
      fixedrange: true,
    },
    yaxis: {
      range: [-0.05, 1.05],
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      showline: false,
      fixedrange: true,
      // Removed scaleanchor and scaleratio to allow horizontal stretching
    },
    height: 280,
    margin: { t: 5, b: 5, l: 5, r: 5 },
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
    <div ref={containerRef} className="flex flex-col w-full bubble-chart-wrapper">
      {/* Chart area */}
      <div className="relative w-full bubble-chart-container" style={{ height: 280 }}>
        <PlotlyWrapper
          data={traces}
          layout={layout}
          config={config}
          onHover={handleHover}
          onUnhover={handleUnhover}
        />
      </div>

      {/* Tooltip - positioned below chart to avoid covering bubbles */}
      <div className="bubble-tooltip-area">
        {tooltip && (
          <div className="party-tooltip bubble-tooltip-below">
            <div className="party-tooltip-title">{tooltip.party.party_name}</div>
            <div className="party-tooltip-grid-horizontal">
              <div className="party-tooltip-item">
                <span className="party-tooltip-label">Total</span>
                <span className="party-tooltip-value">{formatFullCurrency(tooltip.party.total_amount)}</span>
              </div>
              <div className="party-tooltip-item">
                <span className="party-tooltip-label">MPs</span>
                <span className="party-tooltip-value">{tooltip.party.mp_count}</span>
              </div>
              <div className="party-tooltip-item">
                <span className="party-tooltip-label">Payments</span>
                <span className="party-tooltip-value">{tooltip.party.payment_count}</span>
              </div>
              <div className="party-tooltip-item">
                <span className="party-tooltip-label">Share</span>
                <span className="party-tooltip-value">{tooltip.percentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
