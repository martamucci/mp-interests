import { NextResponse } from 'next/server'
import { createAPIClient } from '@/lib/supabase/server'

export const revalidate = 0

interface PartySummary {
  party_name: string
  party_color: string | null
  total_amount: number
  payment_count: number
  mp_count: number
}

interface CategorySummary {
  category_name: string
  total_amount: number
  payment_count: number
}

interface PartyCategoriesSummary {
  party_name: string
  party_color: string | null
  categories: CategorySummary[]
}

export async function GET() {
  try {
    const supabase = createAPIClient(true)

    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, party_name, party_color')
      .eq('is_current', true)

    if (membersError) throw membersError

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')

    if (categoriesError) throw categoriesError

    const memberMap = new Map<number, { party_name: string; party_color: string | null }>(
      (members || []).map(member => [
        member.id,
        { party_name: member.party_name, party_color: member.party_color },
      ])
    )
    const partyMemberMap = new Map<string, { party_color: string | null; mp_ids: Set<number> }>()
    for (const member of members || []) {
      if (!partyMemberMap.has(member.party_name)) {
        partyMemberMap.set(member.party_name, {
          party_color: member.party_color,
          mp_ids: new Set(),
        })
      }
      partyMemberMap.get(member.party_name)!.mp_ids.add(member.id)
    }
    const categoryNameMap = new Map<number, string>(
      (categories || []).map(category => [category.id, category.name])
    )

    const payments: Array<{ amount: number | null; member_id: number; category_id: number }> = []
    const limit = 1000
    let offset = 0
    const memberIds = (members || []).map(member => member.id)

    while (true) {
      const { data: chunk, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, member_id, category_id')
        .in('member_id', memberIds)
        .not('amount', 'is', null)
        .range(offset, offset + limit - 1)

      if (paymentsError) throw paymentsError
      payments.push(...(chunk || []))
      if (!chunk || chunk.length < limit) break
      offset += limit
    }

    const partyMap = new Map<string, {
      party_name: string
      party_color: string | null
      total_amount: number
      payment_count: number
      mp_ids: Set<number>
    }>()

    const partyCategoryMap = new Map<string, Map<string, {
      category_name: string
      total_amount: number
      payment_count: number
    }>>()

    for (const payment of payments || []) {
      const amount = payment.amount || 0
      const member = memberMap.get(payment.member_id)
      const partyName = member?.party_name || 'Unknown'
      const partyColor = member?.party_color || null
      const memberId = payment.member_id
      const categoryName = categoryNameMap.get(payment.category_id) || 'Unknown'

      if (!partyMap.has(partyName)) {
        partyMap.set(partyName, {
          party_name: partyName,
          party_color: partyColor,
          total_amount: 0,
          payment_count: 0,
          mp_ids: new Set(),
        })
      }
      const partyEntry = partyMap.get(partyName)!
      partyEntry.total_amount += amount
      partyEntry.payment_count += 1
      if (memberId) {
        partyEntry.mp_ids.add(memberId)
      }

      if (!partyCategoryMap.has(partyName)) {
        partyCategoryMap.set(partyName, new Map())
      }
      const categoryMap = partyCategoryMap.get(partyName)!
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category_name: categoryName,
          total_amount: 0,
          payment_count: 0,
        })
      }
      const categoryEntry = categoryMap.get(categoryName)!
      categoryEntry.total_amount += amount
      categoryEntry.payment_count += 1
    }

    const parties: PartySummary[] = Array.from(partyMemberMap.entries())
      .map(([partyName, partyInfo]) => {
        const totals = partyMap.get(partyName)
        return {
          party_name: partyName,
          party_color: partyInfo.party_color,
          total_amount: totals?.total_amount || 0,
          payment_count: totals?.payment_count || 0,
          mp_count: partyInfo.mp_ids.size,
        }
      })
      .sort((a, b) => b.total_amount - a.total_amount)

    const categoriesByParty: PartyCategoriesSummary[] = parties.map((party) => {
      const categories = Array.from(partyCategoryMap.get(party.party_name)?.values() || [])
        .sort((a, b) => b.total_amount - a.total_amount)
      return {
        party_name: party.party_name,
        party_color: party.party_color,
        categories,
      }
    })

    return NextResponse.json({ parties, categoriesByParty })
  } catch (error) {
    console.error('Parties summary error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch party summary' },
      { status: 500 }
    )
  }
}
