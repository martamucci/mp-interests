interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string | React.ReactNode
  subtitle?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
}

export default function Card({ children, className = '', title, subtitle, padding = 'lg' }: CardProps) {
  return (
    <div className={`card ${paddingClasses[padding]} ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-near-black">{title}</h3>}
          {subtitle && <p className="text-sm text-dark-grey mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
