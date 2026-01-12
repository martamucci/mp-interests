'use client'

import PlotlyWrapper from '@/components/charts/PlotlyWrapper'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { colors } from '@/lib/theme'
import { formatCurrency } from '@/lib/utils/currency'
import type { HourlyRateRecord } from '@/types/database'

interface HourlyRatesChartProps {
  data: HourlyRateRecord[]
  isLoading?: boolean
}

export default function HourlyRatesChart({ data, isLoading }: HourlyRatesChartProps) {
  if (isLoading) {
    return <ChartSkeleton height={400} />
  }

  // Create labels combining MP name and role
  const labels = data.map((d, i) => `${i + 1}. ${d.name_display}`)

  const chartData: Plotly.Data[] = [
    {
      type: 'scatter',
      mode: 'lines+markers',
      x: labels,
      y: data.map((d) => d.hourly_rate),
      marker: {
        color: colors.violet,
        size: 10,
      },
      line: {
        color: colors.violet,
        width: 2,
      },
      hovertemplate: data.map(
        (d) =>
          `<b>${d.name_display}</b><br>` +
          `${d.role_description || 'N/A'}<br>` +
          `Hourly rate: ${formatCurrency(d.hourly_rate, true)}<br>` +
          `Amount: ${formatCurrency(d.amount)}<br>` +
          `Hours: ${d.hours_worked}<br>` +
          `Payer: ${d.payer_name || 'N/A'}<extra></extra>`
      ),
    },
  ]

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: 'Top Hourly Rates',
      font: { size: 16, color: colors.nearBlack },
    },
    xaxis: {
      title: { text: '' },
      tickangle: -45,
      tickfont: { size: 10 },
    },
    yaxis: {
      title: { text: 'Hourly Rate (£)' },
      tickformat: ',.0f',
      tickprefix: '£',
    },
    height: 400,
    margin: { t: 50, b: 150, l: 80, r: 20 },
  }

  return <PlotlyWrapper data={chartData} layout={layout} />
}
