import type { ParliamentMember, MembersSearchResponse } from '@/types/parliament'

const MEMBERS_API_BASE = 'https://members-api.parliament.uk/api'

interface FetchMembersOptions {
  isCurrentMember?: boolean
  house?: 1 | 2 // 1 = Commons, 2 = Lords
  skip?: number
  take?: number
}

export async function fetchMembers(options: FetchMembersOptions = {}): Promise<MembersSearchResponse> {
  const {
    isCurrentMember = true,
    house = 1, // Commons
    skip = 0,
    take = 20,
  } = options

  const params = new URLSearchParams({
    IsCurrentMember: String(isCurrentMember),
    House: String(house),
    skip: String(skip),
    take: String(take),
  })

  const response = await fetch(`${MEMBERS_API_BASE}/Members/Search?${params}`, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Members API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function fetchMemberById(id: number): Promise<ParliamentMember | null> {
  const response = await fetch(`${MEMBERS_API_BASE}/Members/${id}`, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Members API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Fetch all current MPs (handles pagination)
export async function fetchAllCurrentMPs(): Promise<ParliamentMember[]> {
  const allMembers: ParliamentMember[] = []
  let skip = 0
  const take = 20

  while (true) {
    const response = await fetchMembers({
      isCurrentMember: true,
      house: 1, // Commons only
      skip,
      take,
    })

    if (!response.items || response.items.length === 0) {
      break
    }

    allMembers.push(...response.items)
    skip += take

    if (skip >= response.totalResults) {
      break
    }

    // Rate limiting - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allMembers
}
