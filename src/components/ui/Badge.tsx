interface BadgeProps {
  children: React.ReactNode
  color?: string
  className?: string
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
}

export default function Badge({ children, color, className = '', size = 'md' }: BadgeProps) {
  const style = color ? { backgroundColor: color } : undefined

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${sizeClasses[size]}
        ${color ? 'text-white' : 'bg-violet/20 text-violet'}
        ${className}
      `}
      style={style}
    >
      {children}
    </span>
  )
}
