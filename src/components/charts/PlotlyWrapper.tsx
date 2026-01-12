'use client'

import dynamic from 'next/dynamic'
import { plotlyLayoutDefaults, plotlyConfig } from '@/lib/theme'

// Dynamic import to avoid SSR issues with Plotly
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface PlotlyWrapperProps {
  data: Plotly.Data[]
  layout?: Partial<Plotly.Layout>
  config?: Partial<Plotly.Config>
  className?: string
  style?: React.CSSProperties
  onHover?: (event: Plotly.PlotHoverEvent) => void
  onUnhover?: (event: Plotly.PlotMouseEvent) => void
}

export default function PlotlyWrapper({
  data,
  layout = {},
  config = {},
  className = '',
  style,
  onHover,
  onUnhover,
}: PlotlyWrapperProps) {
  const mergedLayout: Partial<Plotly.Layout> = {
    ...plotlyLayoutDefaults,
    ...layout,
    font: {
      ...plotlyLayoutDefaults.font,
      ...layout.font,
    },
    margin: {
      ...plotlyLayoutDefaults.margin,
      ...layout.margin,
    },
    autosize: true,
  }

  const mergedConfig: Partial<Plotly.Config> = {
    ...plotlyConfig,
    ...config,
  }

  return (
    <div className={`chart-container ${className}`} style={style}>
      <Plot
        data={data}
        layout={mergedLayout}
        config={mergedConfig}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
        onHover={onHover}
        onUnhover={onUnhover}
      />
    </div>
  )
}
