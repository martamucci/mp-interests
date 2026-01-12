import { NextRequest, NextResponse } from 'next/server'
import { runDataSync } from '@/lib/sync/syncService'

export const maxDuration = 300 // 5 minutes max for serverless function

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting data sync...')
    const result = await runDataSync()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also allow GET for manual triggering (for testing)
export async function GET(request: NextRequest) {
  return POST(request)
}
