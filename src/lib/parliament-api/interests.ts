import type { PublishedInterest, InterestsResponse, CategoriesResponse, InterestCategory } from '@/types/parliament'

const INTERESTS_API_BASE = 'https://interests-api.parliament.uk/api/v1'

interface FetchInterestsOptions {
  memberId?: number
  categoryId?: number
  publishedFrom?: string
  publishedTo?: string
  registeredFrom?: string
  registeredTo?: string
  expandChildInterests?: boolean
  skip?: number
  take?: number
}

export async function fetchInterests(options: FetchInterestsOptions = {}): Promise<InterestsResponse> {
  const {
    memberId,
    categoryId,
    publishedFrom,
    publishedTo,
    registeredFrom,
    registeredTo,
    expandChildInterests = true,
    skip = 0,
    take = 20,
  } = options

  const params = new URLSearchParams({
    skip: String(skip),
    take: String(take),
    ExpandChildInterests: String(expandChildInterests),
  })

  if (memberId) params.set('MemberId', String(memberId))
  if (categoryId) params.set('CategoryId', String(categoryId))
  if (publishedFrom) params.set('PublishedFrom', publishedFrom)
  if (publishedTo) params.set('PublishedTo', publishedTo)
  if (registeredFrom) params.set('RegisteredFrom', registeredFrom)
  if (registeredTo) params.set('RegisteredTo', registeredTo)

  const response = await fetch(`${INTERESTS_API_BASE}/Interests?${params}`, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Interests API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function fetchInterestById(id: number): Promise<PublishedInterest | null> {
  const response = await fetch(`${INTERESTS_API_BASE}/Interests/${id}`, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Interests API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function fetchCategories(): Promise<CategoriesResponse> {
  const response = await fetch(`${INTERESTS_API_BASE}/Categories?take=50`, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Categories API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Fetch all interests (handles pagination)
export async function fetchAllInterests(memberIds?: Set<number>): Promise<PublishedInterest[]> {
  const allInterests: PublishedInterest[] = []
  let skip = 0
  const take = 20

  while (true) {
    const response = await fetchInterests({
      skip,
      take,
      expandChildInterests: true,
    })

    if (!response.items || response.items.length === 0) {
      break
    }

    // Filter to specified member IDs if provided
    const relevantInterests = memberIds
      ? response.items.filter(i => memberIds.has(i.member.id))
      : response.items

    allInterests.push(...relevantInterests)
    skip += take

    if (skip >= response.totalResults) {
      break
    }

    // Rate limiting - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allInterests
}

// Fetch interests for a specific MP
export async function fetchMPInterests(memberId: number): Promise<PublishedInterest[]> {
  const allInterests: PublishedInterest[] = []
  let skip = 0
  const take = 20

  while (true) {
    const response = await fetchInterests({
      memberId,
      skip,
      take,
      expandChildInterests: true,
    })

    if (!response.items || response.items.length === 0) {
      break
    }

    allInterests.push(...response.items)
    skip += take

    if (skip >= response.totalResults) {
      break
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allInterests
}

// Fetch interests by category (needed to get childInterests with payment amounts)
// The Parliament API only returns childInterests when filtering by CategoryId
export async function fetchInterestsByCategory(
  categoryId: number,
  memberIds?: Set<number>
): Promise<PublishedInterest[]> {
  const allInterests: PublishedInterest[] = []
  let skip = 0
  const take = 20

  while (true) {
    const response = await fetchInterests({
      categoryId,
      skip,
      take,
      expandChildInterests: true,
    })

    if (!response.items || response.items.length === 0) {
      break
    }

    // Filter to specified member IDs if provided
    const relevantInterests = memberIds
      ? response.items.filter(i => memberIds.has(i.member.id))
      : response.items

    allInterests.push(...relevantInterests)
    skip += take

    if (skip >= response.totalResults) {
      break
    }

    // Rate limiting - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allInterests
}
