// Color palette
export const colors = {
  lavender: '#D8D8F6',
  violet: '#B18FCF',
  roseQuartz: '#978897',
  darkGrey: '#494850',
  nearBlack: '#2C2C34',
} as const

// Party colors for charts
export const partyColors: Record<string, string> = {
  'Labour': '#DC241f',
  'Conservative': '#0087DC',
  'Liberal Democrats': '#FDBB30',
  'Liberal Democrat': '#FDBB30',
  'Scottish National Party': '#FFF95D',
  'SNP': '#FFF95D',
  'Green Party': '#6AB023',
  'Green': '#6AB023',
  'Plaid Cymru': '#005B54',
  'Democratic Unionist Party': '#D46A4C',
  'DUP': '#D46A4C',
  'Sinn Féin': '#326760',
  'Alba Party': '#005EB8',
  'Reform UK': '#12B6CF',
  'Independent': colors.roseQuartz,
  'Speaker': colors.darkGrey,
  'default': colors.violet,
}

// Get party color with fallback
export function getPartyColor(party: string): string {
  return partyColors[party] || partyColors.default
}

// Sequential color palette for charts
export const chartSequentialColors: string[] = [
  colors.violet,
  colors.lavender,
  colors.roseQuartz,
  colors.darkGrey,
  colors.nearBlack,
]

// Plotly layout configuration
export const plotlyLayoutDefaults: Partial<Plotly.Layout> = {
  font: {
    family: 'Inter, system-ui, sans-serif',
    color: colors.nearBlack,
  },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  margin: { t: 40, r: 20, b: 40, l: 60 },
  xaxis: {
    gridcolor: `${colors.darkGrey}20`,
    linecolor: colors.roseQuartz,
  },
  yaxis: {
    gridcolor: `${colors.darkGrey}20`,
    linecolor: colors.roseQuartz,
  },
}

// Plotly config
export const plotlyConfig: Partial<Plotly.Config> = {
  displayModeBar: false,
  responsive: true,
}
