import { NextRequest, NextResponse } from 'next/server'
import { getSearchService, keywordSearch } from '@/lib/search/llmSearch'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query too long' },
        { status: 400 }
      )
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Fall back to keyword search
      const results = await keywordSearch(query)
      return NextResponse.json(results)
    }

    try {
      const searchService = getSearchService()
      const results = await searchService.search(query)

      // If LLM search returned "Unable to parse query", fall back to keyword search
      if (results.interpretation === 'Unable to parse query') {
        const fallbackResults = await keywordSearch(query)
        return NextResponse.json(fallbackResults)
      }

      return NextResponse.json(results)
    } catch {
      // If LLM search fails, fall back to keyword search
      console.log('LLM search failed, falling back to keyword search')
      const fallbackResults = await keywordSearch(query)
      return NextResponse.json(fallbackResults)
    }
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
