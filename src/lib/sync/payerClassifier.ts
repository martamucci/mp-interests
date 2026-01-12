import type { PayerType } from '@/types/database'

interface ClassificationRule {
  pattern: RegExp | string
  type: PayerType
  subtype?: string
  priority: number
}

interface ClassificationResult {
  type: PayerType
  subtype?: string
}

// Default classification rules
const DEFAULT_RULES: ClassificationRule[] = [
  // Governments - High priority (must have explicit government indicators)
  { pattern: /\bgovernment of\b/i, type: 'Government', subtype: 'Foreign Government', priority: 10 },
  { pattern: /\bembassy of\b/i, type: 'Government', subtype: 'Embassy', priority: 10 },
  { pattern: /\broyal embassy\b/i, type: 'Government', subtype: 'Embassy', priority: 10 },
  { pattern: /\b\w+ embassy\b/i, type: 'Government', subtype: 'Embassy', priority: 9 },
  { pattern: /\bconsulate[- ]general\b/i, type: 'Government', subtype: 'Consulate', priority: 10 },
  { pattern: /\bconsulate of\b/i, type: 'Government', subtype: 'Consulate', priority: 10 },
  { pattern: /\bhigh commission\b/i, type: 'Government', subtype: 'Embassy', priority: 10 },
  { pattern: /\bministry of\b/i, type: 'Government', subtype: 'Ministry', priority: 10 },
  { pattern: /\bministerio\b/i, type: 'Government', subtype: 'Ministry', priority: 10 },
  { pattern: /\bforeign (affairs|ministry)\b/i, type: 'Government', subtype: 'Foreign Government', priority: 10 },
  { pattern: /\bmofa\b/i, type: 'Government', subtype: 'Foreign Government', priority: 10 },
  { pattern: /\bfederal department\b/i, type: 'Government', subtype: 'Foreign Government', priority: 10 },
  { pattern: /\bfederal government\b/i, type: 'Government', subtype: 'Foreign Government', priority: 10 },
  { pattern: /\bstate department\b/i, type: 'Government', subtype: 'Foreign Government', priority: 10 },
  { pattern: /\bparliament of\b/i, type: 'Government', subtype: 'Parliament', priority: 10 },
  { pattern: /\bnational assembly\b/i, type: 'Government', subtype: 'Parliament', priority: 10 },
  { pattern: /\b(uk|british|hm) government\b/i, type: 'Government', subtype: 'UK Government', priority: 10 },
  { pattern: /\bdepartment (of|for)\b/i, type: 'Government', subtype: 'UK Government', priority: 9 },
  { pattern: /\bhouse of (commons|lords)\b/i, type: 'Government', subtype: 'UK Parliament', priority: 10 },
  { pattern: /\bEU\b|european (union|commission|parliament)/i, type: 'Government', subtype: 'EU', priority: 9 },
  { pattern: /\bunited nations\b/i, type: 'Government', subtype: 'International', priority: 10 },
  { pattern: /\bNATO\b/i, type: 'Government', subtype: 'International', priority: 10 },
  { pattern: /\bworld bank\b/i, type: 'Government', subtype: 'International', priority: 10 },
  { pattern: /\bIMF\b|\binternational monetary fund\b/i, type: 'Government', subtype: 'International', priority: 10 },
  // Lower priority government patterns (require context)
  { pattern: /\bcouncil\b/i, type: 'Government', subtype: 'Local Government', priority: 6 },
  { pattern: /\bauthority\b/i, type: 'Government', subtype: 'Public Authority', priority: 5 },

  // Companies - Highest priority for legal entity suffixes (must override all other patterns)
  { pattern: /\b(ltd|limited)\.?\s*$/i, type: 'Company', priority: 12 },
  { pattern: /\b(ltd|limited)\b\.?/i, type: 'Company', priority: 12 },
  { pattern: /\bplc\b\.?/i, type: 'Company', subtype: 'Public Company', priority: 12 },
  { pattern: /\bfriends of\b/i, type: 'Company', subtype: 'Advocacy Group', priority: 11 },
  { pattern: /\bllp\b\.?$/i, type: 'Company', subtype: 'Partnership', priority: 8 },
  { pattern: /\binc\.?\b$/i, type: 'Company', priority: 8 },
  { pattern: /\bcorp(oration)?\.?\b$/i, type: 'Company', priority: 8 },
  { pattern: /\bGmbH\b/i, type: 'Company', subtype: 'German Company', priority: 8 },
  { pattern: /\b(SA|AG)\b$/i, type: 'Company', priority: 7 },
  { pattern: /\bholdings\b/i, type: 'Company', subtype: 'Holding Company', priority: 6 },
  { pattern: /\bgroup\b$/i, type: 'Company', priority: 5 },
  { pattern: /\bpartners\b/i, type: 'Company', subtype: 'Partnership', priority: 5 },
  { pattern: /\bfoundation\b/i, type: 'Company', subtype: 'Foundation', priority: 5 },
  { pattern: /\btrust\b/i, type: 'Company', subtype: 'Trust', priority: 5 },
  { pattern: /\bcharity\b/i, type: 'Company', subtype: 'Charity', priority: 5 },

  // Media companies
  { pattern: /\b(bbc|itv|sky|channel\s*4)\b/i, type: 'Company', subtype: 'Media', priority: 8 },
  { pattern: /\b(times|guardian|telegraph|mail|sun|mirror)\b/i, type: 'Company', subtype: 'Media', priority: 7 },
  { pattern: /\b(news|media|broadcasting|radio)\b/i, type: 'Company', subtype: 'Media', priority: 5 },

  // Universities and institutions
  { pattern: /\buniversity\b/i, type: 'Company', subtype: 'Education', priority: 7 },
  { pattern: /\bcollege\b/i, type: 'Company', subtype: 'Education', priority: 6 },
  { pattern: /\binstitute\b/i, type: 'Company', subtype: 'Institution', priority: 5 },

  // Trade unions
  { pattern: /\bunion\b/i, type: 'Company', subtype: 'Trade Union', priority: 6 },
  { pattern: /\bGMB\b|\bUnite\b|\bUnison\b/i, type: 'Company', subtype: 'Trade Union', priority: 8 },

  // Individuals - Lower priority (catch titles)
  { pattern: /^(mr|mrs|ms|miss|dr|sir|dame|lord|lady|baron|baroness|viscount|earl|duke|duchess)\s+/i, type: 'Individual', priority: 6 },
  { pattern: /^(professor|prof\.?)\s+/i, type: 'Individual', priority: 6 },
  { pattern: /^(the\s+)?(rt\s+)?hon(ourable)?\.?\s+/i, type: 'Individual', priority: 6 },
]

// Common first names to help identify individuals without titles
const COMMON_FIRST_NAMES = new Set([
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles',
  'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'kenneth', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan',
  'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen',
  'nancy', 'lisa', 'margaret', 'betty', 'sandra', 'ashley', 'dorothy', 'kimberly', 'emily', 'donna',
  'michelle', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
  'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen',
  'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather',
  'peter', 'simon', 'ian', 'stuart', 'alan', 'martin', 'graham', 'colin', 'philip', 'keith',
  'barry', 'trevor', 'derek', 'roger', 'neil', 'adrian', 'gerald', 'carl', 'roy', 'wayne',
  'adam', 'harry', 'joe', 'luke', 'oliver', 'oscar', 'charlie', 'jake', 'max', 'alex',
  'kate', 'jane', 'anne', 'claire', 'clare', 'julia', 'victoria', 'sophie', 'charlotte', 'lucy',
  'grace', 'hannah', 'olivia', 'chloe', 'megan', 'natalie', 'louise', 'holly', 'joanne', 'marie',
  'mohammed', 'muhammad', 'ahmed', 'ali', 'omar', 'hassan', 'hussein', 'abdul', 'syed', 'tariq',
  'raj', 'ravi', 'anil', 'sunil', 'vijay', 'amit', 'ashok', 'rajesh', 'sanjay', 'vikram',
  'priya', 'sunita', 'anita', 'neha', 'pooja', 'deepa', 'kavita', 'rekha', 'meera', 'anjali',
])

function looksLikeIndividualName(name: string): boolean {
  const normalized = name.toLowerCase().trim()

  // Skip if it contains company-like words
  if (/\b(ltd|limited|plc|llp|inc|corp|gmbh|foundation|trust|charity|council|authority|university|college|institute|union|media|news|group|holdings|partners|association|society|organisation|organization|committee|board|agency|service|services|centre|center|hospital|school|company|companies|enterprises|international|global|uk|british)\b/i.test(normalized)) {
    return false
  }

  // Split into words
  const words = normalized.split(/\s+/).filter(w => w.length > 0)

  // Most individual names have 2-4 words
  if (words.length < 2 || words.length > 4) {
    return false
  }

  // Check if the first word is a common first name
  const firstName = words[0].replace(/[^a-z]/g, '')
  if (COMMON_FIRST_NAMES.has(firstName)) {
    return true
  }

  // Check for patterns like "A. Smith" or "J. Brown" (initial + surname)
  if (/^[a-z]\.?\s+[a-z]+$/i.test(normalized)) {
    return true
  }

  return false
}

export class PayerClassifier {
  private rules: ClassificationRule[]
  private overrides: Map<string, ClassificationResult>

  constructor() {
    this.rules = [...DEFAULT_RULES]
    this.overrides = new Map()
  }

  clearOverrides() {
    this.overrides.clear()
  }

  loadOverrides(overrides: Array<{ pattern: string; type: PayerType; subtype?: string }>) {
    // Clear existing overrides first to ensure fresh state
    this.overrides.clear()
    for (const override of overrides) {
      this.overrides.set(override.pattern.toLowerCase(), {
        type: override.type,
        subtype: override.subtype,
      })
    }
  }

  classify(payerName: string): ClassificationResult {
    const normalized = payerName.toLowerCase().trim()

    // Check exact match overrides first
    if (this.overrides.has(normalized)) {
      return this.overrides.get(normalized)!
    }

    // Check partial match overrides
    for (const [pattern, result] of this.overrides) {
      if (normalized.includes(pattern)) {
        return result
      }
    }

    // Apply rules in priority order
    const matches = this.rules
      .filter(rule => {
        if (typeof rule.pattern === 'string') {
          return normalized.includes(rule.pattern.toLowerCase())
        }
        return rule.pattern.test(payerName)
      })
      .sort((a, b) => b.priority - a.priority)

    if (matches.length > 0) {
      return {
        type: matches[0].type,
        subtype: matches[0].subtype,
      }
    }

    // Check if the name looks like an individual (person's name without title)
    if (looksLikeIndividualName(payerName)) {
      return { type: 'Individual' }
    }

    // Default to Company (anything that's not Government or Individual is assumed to be a Company)
    return { type: 'Company' }
  }

  normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
  }
}

// Singleton instance
let classifierInstance: PayerClassifier | null = null

export function getPayerClassifier(): PayerClassifier {
  if (!classifierInstance) {
    classifierInstance = new PayerClassifier()
  }
  return classifierInstance
}
