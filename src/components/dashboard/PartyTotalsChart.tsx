'use client'

import { useState, useCallback, useRef } from 'react'
import PlotlyWrapper from '@/components/charts/PlotlyWrapper'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { colors, getPartyColor } from '@/lib/theme'
import type { PartyTotal } from '@/types/database'

interface PartyTotalsChartProps {
  data: PartyTotal[]
  isLoading?: boolean
}

// Format currency with £ prefix and thousands separators
function formatCurrencyLabel(amount: number): string {
  return '£' + amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

// Determine if text should be light or dark based on background color
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff'
}

interface TooltipData {
  party: PartyTotal
  percentage: number
  x: number
  y: number
}

export default function PartyTotalsChart({ data, isLoading }: PartyTotalsChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleHover = useCallback((event: Plotly.PlotHoverEvent) => {
    if (event.points && event.points[0] && containerRef.current) {
      const point = event.points[0]
      const customdata = point.customdata as unknown as PartyTotal & { percentage: number; index: number }
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

  if (isLoading) {
    return <ChartSkeleton height={150} />
  }

  // Sort by total_amount descending (left to right) and filter out zero amounts
  const sortedData = [...data]
    .filter((d) => d.total_amount > 0)
    .sort((a, b) => b.total_amount - a.total_amount)

  // Calculate total for percentage-based sizing
  const grandTotal = sortedData.reduce((sum, d) => sum + d.total_amount, 0)

  // Create stacked bar traces - each party is a segment on the same bar
  const chartData = sortedData.map((d, index) => {
    const partyColor = d.party_color || getPartyColor(d.party_name)
    const percentage = (d.total_amount / grandTotal) * 100

    // Only show label if segment is wide enough (> 5%)
    const showLabel = percentage > 5
    const labelText = showLabel
      ? `<b>${d.party_name}</b><br>${formatCurrencyLabel(d.total_amount)}`
      : ''

    return {
      type: 'bar' as const,
      orientation: 'h' as const,
      name: d.party_name,
      x: [d.total_amount],
      y: [''],
      text: [labelText],
      textposition: 'inside' as const,
      insidetextanchor: 'middle' as const,
      textfont: {
        color: getContrastColor(partyColor),
        size: 12,
        family: 'Inter, system-ui, sans-serif',
      },
      marker: {
        color: partyColor,
        line: {
          color: 'rgba(255,255,255,0.3)',
          width: 1,
        },
      },
      hoverinfo: 'none' as const,
      showlegend: false,
      customdata: [{ ...d, percentage, index }] as unknown as Plotly.Datum[],
    }
  }) as Plotly.Data[]

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: 'Total Registered Payments by Party',
      font: { size: 16, color: colors.nearBlack, family: 'Inter, system-ui, sans-serif' },
      x: 0.01,
      xanchor: 'left',
      y: 0.92,
    },
    xaxis: {
      title: { text: '' },
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      showline: false,
      fixedrange: true,
    },
    yaxis: {
      title: { text: '' },
      showticklabels: false,
      showgrid: false,
      showline: false,
      fixedrange: true,
    },
    barmode: 'stack',
    height: 150,
    margin: { t: 40, b: 30, l: 0, r: 0 },
    bargap: 0,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
  }

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: false,
    staticPlot: false,
  }

  return (
    <div ref={containerRef} className="party-chart-container relative">
      <PlotlyWrapper
        data={chartData}
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
            left: Math.min(tooltip.x + 12, (containerRef.current?.offsetWidth || 300) - 180),
            top: tooltip.y - 60,
          }}
        >
          <div className="party-tooltip-title">{tooltip.party.party_name}</div>
          <div className="party-tooltip-grid">
            <span className="party-tooltip-label">Total</span>
            <span className="party-tooltip-value">{formatCurrencyLabel(tooltip.party.total_amount)}</span>
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
