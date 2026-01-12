// Types for UK Parliament API responses

// Members API types
export interface ParliamentMember {
  value: {
    id: number
    nameDisplayAs: string
    nameListAs: string
    gender: string
    thumbnailUrl: string | null
    latestParty: {
      id: number
      name: string
      abbreviation: string
      backgroundColour: string
      foregroundColour: string
    }
    latestHouseMembership: {
      membershipFrom: string
      house: number
      membershipStartDate: string
      membershipEndDate: string | null
    }
  }
}

export interface MembersSearchResponse {
  items: ParliamentMember[]
  totalResults: number
  skip: number
  take: number
  links: Array<{ rel: string; href: string; method: string }>
}

// Register of Interests API types
export interface InterestField {
  name: string
  description: string
  type: string
  typeInfo?: {
    currencyCode?: string
  }
  value?: string | number | boolean
  // values can be either an array of fields or an array of arrays of fields (for nested structures like Donors)
  values?: InterestField[] | InterestField[][]
}

export interface InterestCategory {
  id: number
  name: string
  parentCategory?: InterestCategory
  sortOrder: number
}

export interface InterestMember {
  id: number
  nameDisplayAs: string
  nameListAs: string
  house: string
  memberFrom: string
}

export interface PublishedInterest {
  id: number
  summary: string
  registrationDate: string
  publishedDate: string
  updatedDates: string[]
  rectified: boolean
  rectifiedDetails: string | null
  category: InterestCategory
  member: InterestMember
  fields: InterestField[]
  childInterests: PublishedInterest[]
  parentInterestId: number | null
  links: Array<{ rel: string; href: string; method: string }>
}

export interface InterestsResponse {
  items: PublishedInterest[]
  totalResults: number
  skip: number
  take: number
  links: Array<{ rel: string; href: string; method: string }>
}

export interface CategoriesResponse {
  items: InterestCategory[]
  totalResults: number
  skip: number
  take: number
}
