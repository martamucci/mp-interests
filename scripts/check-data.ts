import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('Checking database tables...\n')

  // Check members
  const { count: membersCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
  console.log(`Members: ${membersCount}`)

  // Check interests
  const { count: interestsCount } = await supabase
    .from('interests')
    .select('*', { count: 'exact', head: true })
  console.log(`Interests: ${interestsCount}`)

  // Check payments
  const { count: paymentsCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
  console.log(`Payments: ${paymentsCount}`)

  // Check payments with amounts
  const { count: paymentsWithAmounts } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .not('amount', 'is', null)
  console.log(`Payments with amounts: ${paymentsWithAmounts}`)

  // Check payers
  const { count: payersCount } = await supabase
    .from('payers')
    .select('*', { count: 'exact', head: true })
  console.log(`Payers: ${payersCount}`)

  // Sample payments data
  console.log('\nSample payments with amounts:')
  const { data: samplePayments } = await supabase
    .from('payments')
    .select('member_id, amount, payer_name, role_description')
    .not('amount', 'is', null)
    .limit(5)
  console.log(samplePayments)
}

main().catch(console.error)
