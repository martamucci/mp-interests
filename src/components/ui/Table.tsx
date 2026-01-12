interface Column<T> {
  key: string
  header: string
  render?: (item: T, index: number) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  className?: string
  emptyMessage?: string
  onRowClick?: (item: T, index: number) => void
  rowClassName?: string
}

export default function Table<T extends object>({
  data,
  columns,
  className = '',
  emptyMessage = 'No data available',
  onRowClick,
  rowClassName = '',
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-dark-grey">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-rose-quartz/20">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`table-header px-4 py-3 ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={index}
              className={`border-b border-rose-quartz/10 transition-colors ${
                onRowClick ? rowClassName : 'hover:bg-lavender/50'
              }`}
              onClick={onRowClick ? () => onRowClick(item, index) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={`table-cell ${column.className || ''}`}>
                  {column.render
                    ? column.render(item, index)
                    : String((item as Record<string, unknown>)[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
