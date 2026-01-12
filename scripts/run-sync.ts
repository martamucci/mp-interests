import { config } from 'dotenv'
config({ path: '.env.local' })

import { runDataSync } from '../src/lib/sync/syncService'

async function main() {
  console.log('Starting data sync...')
  const result = await runDataSync()
  console.log('Sync result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
