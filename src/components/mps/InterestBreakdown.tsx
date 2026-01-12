'use client'

import PlotlyWrapper from '@/components/charts/PlotlyWrapper'
import { colors, chartSequentialColors } from '@/lib/theme'
import { formatCurrency } from '@/lib/utils/currency'
import type { CategoryBreakdown } from '@/types/api'

interface InterestBreakdownProps {
  data: CategoryBreakdown[]
}

export default function InterestBreakdown({ data }: InterestBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-dark-grey">
        No category breakdown available.
      </div>
    )
  }

  const chartData: Plotly.Data[] = [
    {
      type: 'pie',
      labels: data.map((d) => d.categoryName),
      values: data.map((d) => d.amount),
      marker: {
        colors: chartSequentialColors.concat(
          chartSequentialColors.map((c) => `${c}80`)
        ),
      },
      hovertemplate: data.map(
        (d) =>
          `<b>${d.categoryName}</b><br>` +
          `Amount: ${formatCurrency(d.amount)}<br>` +
          `Count: ${d.count}<extra></extra>`
      ),
      textinfo: 'percent',
      textposition: 'inside',
    },
  ]

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: 'Interests by Category',
      font: { size: 16, color: colors.nearBlack },
    },
    height: 300,
    margin: { t: 50, b: 20, l: 20, r: 20 },
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.1,
    },
  }

  return <PlotlyWrapper data={chartData} layout={layout} />
}
