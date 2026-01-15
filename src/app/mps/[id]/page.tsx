'use client'

import { use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import MPProfile from '@/components/mps/MPProfile'
import InterestBreakdown from '@/components/mps/InterestBreakdown'
import InterestsList from '@/components/mps/InterestsList'
import Skeleton from '@/components/ui/Skeleton'
import { useMPDetail } from '@/hooks/useMPDetail'

export default function MPDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  // Handle both sync and async params (Next.js 14 client components receive sync params)
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { id } = resolvedParams
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  const getBackInfo = () => {
    switch (from) {
      case 'dashboard':
        return { link: '/', label: '← Back to Dashboard' }
      case 'latest':
        return { link: '/latest', label: '← Back to Latest Interests' }
      default:
        return { link: '/mps', label: '← Back to MPs' }
    }
  }
  const { link: backLink, label: backLabel } = getBackInfo()

  const { data, isLoading, error } = useMPDetail(id)

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-near-black mb-2">Error</h2>
        <p className="text-dark-grey mb-4">{error}</p>
        <Link href={backLink} className="btn-primary">
          {backLabel.replace('← ', '')}
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href={backLink} className="text-violet hover:underline">
          {backLabel}
        </Link>
        <div className="card p-6">
          <div className="flex items-start gap-6">
            <Skeleton variant="rectangular" width={96} height={96} />
            <div className="flex-1 space-y-3">
              <Skeleton width="40%" height={28} />
              <Skeleton width="30%" height={20} />
              <Skeleton width={80} height={24} />
            </div>
          </div>
        </div>
        <Skeleton height={300} />
        <Skeleton height={400} />
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href={backLink} className="text-violet hover:underline inline-block">
        {backLabel}
      </Link>

      {/* Profile */}
      <MPProfile member={data.member} summary={data.summary} />

      {/* Category Breakdown */}
      {data.summary.categoryBreakdown.length > 0 && (
        <Card>
          <InterestBreakdown data={data.summary.categoryBreakdown} />
        </Card>
      )}

      {/* Interests List */}
      <Card title="Registered Interests">
        <InterestsList interests={data.interests} />
      </Card>
    </div>
  )
}
