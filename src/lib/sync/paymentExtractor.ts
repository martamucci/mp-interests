import type { PublishedInterest, InterestField } from '@/types/parliament'
import { parseCurrencyAmount } from '@/lib/utils/currency'

interface ExtractedPayment {
  interestId: number
  memberId: number
  categoryId: number
  amount: number | null
  amountRaw: string | null
  paymentType: string | null
  regularity: string | null
  roleDescription: string | null
  hoursWorked: number | null
  hoursPeriod: string | null
  hourlyRate: number | null
  payerName: string | null
  payerAddress: string | null
  payerNatureOfBusiness: string | null
  payerStatus: string | null  // "Individual", "Company", etc. from API
  startDate: string | null
  endDate: string | null
  receivedDate: string | null
  isDonated: boolean
}

// Field name variations to look for
const FIELD_MAPPINGS = {
  amount: [
    'Payment',
    'Amount, or estimate of the probable value',
    'Estimated value',
    'Value',
    'Amount',
    'Sum',
    'Total',
  ],
  payer: ['Payer', 'Donor', 'Source', 'Name of donor', 'Name of payer', 'Organisation', 'Company'],
  role: ['Job title', 'Role', 'Position', 'Work', 'Service', 'Description', 'Nature of work'],
  hours: ['Hours worked', 'Hours', 'Time spent', 'Duration'],
  hoursPeriod: ['Period for hours worked', 'Period', 'Frequency'],
  address: ['Address', 'Address of payer', 'Address of donor', 'Registered address'],
  nature: ['Nature of business', 'Business', 'Sector'],
  startDate: ['Start date', 'From', 'Date started', 'Commencement date'],
  endDate: ['End date', 'To', 'Date ended', 'Completion date'],
  receivedDate: ['Date received', 'Received', 'Date of receipt', 'Date of donation'],
  regularity: ['Regularity of payment', 'Regularity', 'Payment frequency'],
  paymentType: ['Payment type', 'Type', 'Kind'],
  donorStatus: ['DonorStatus', 'Donor status', 'Status'],
  donorName: ['DonorName', 'Donor name', 'Name of donor', 'Name'],
}

function findField(fields: InterestField[], fieldNames: string[]): InterestField | undefined {
  for (const name of fieldNames) {
    // First try exact match (case insensitive)
    const exactMatch = fields.find(f => f.name.toLowerCase() === name.toLowerCase())
    if (exactMatch) return exactMatch
  }

  // Then try partial matches, but be more careful to avoid false positives
  for (const name of fieldNames) {
    const field = fields.find(f => {
      const fieldLower = f.name.toLowerCase()
      const nameLower = name.toLowerCase()

      // Skip if field name contains 'type' and we're not looking for 'type'
      // This prevents "PaymentType" matching "Payment"
      if (fieldLower.includes('type') && !nameLower.includes('type')) {
        return false
      }

      // Skip if field name contains 'description' and we're not looking for description
      if (fieldLower.includes('description') && !nameLower.includes('description')) {
        return false
      }

      return fieldLower.includes(nameLower) || nameLower.includes(fieldLower)
    })
    if (field) return field
  }
  return undefined
}

function getFieldValue(field: InterestField | undefined): string | number | null {
  if (!field) return null

  // Handle nested values array
  if (field.values && Array.isArray(field.values) && field.values.length > 0) {
    // For nested structures, try to find a value field within
    // Check if first element is an array (nested donor structure) or a field object
    const firstElem = field.values[0]
    if (!Array.isArray(firstElem) && 'value' in firstElem) {
      // It's InterestField[] - find one with a value
      const nestedValue = (field.values as InterestField[]).find(v => v.value !== undefined)
      if (nestedValue?.value !== undefined) {
        const val = nestedValue.value
        // Reject boolean values
        if (typeof val === 'boolean') return null
        return val as string | number
      }
    }
  }

  if (field.value !== undefined) {
    const val = field.value
    // Reject boolean values
    if (typeof val === 'boolean') return null
    return val as string | number
  }

  return null
}

// Extract data from nested Donors/Payers arrays (used in Visits, Gifts, etc.)
interface DonorData {
  name: string | null
  address: string | null
  value: number | null
  valueRaw: string | null
  paymentType: string | null
}

function extractFromDonorsArray(fields: InterestField[]): DonorData | null {
  // Look for Donors or similar nested arrays
  const donorsField = fields.find(f =>
    f.name === 'Donors' ||
    f.name === 'Payers' ||
    f.name === 'Sources' ||
    f.name === 'Funders'
  )

  if (!donorsField?.values || !Array.isArray(donorsField.values) || donorsField.values.length === 0) {
    return null
  }

  // Each donor is an array of fields inside values
  // Sum up all donor values for this interest
  let totalValue = 0
  let hasValue = false
  let firstName: string | null = null
  let firstAddress: string | null = null
  let firstPaymentType: string | null = null
  let valueRaw: string | null = null

  for (const donorFields of donorsField.values) {
    if (!Array.isArray(donorFields)) continue

    for (const field of donorFields as InterestField[]) {
      const fieldName = (field.name || '').toLowerCase()

      if (fieldName === 'value' && field.value !== undefined && field.value !== null) {
        const parsed = parseCurrencyAmount(field.value as string | number)
        if (parsed !== null) {
          totalValue += parsed
          hasValue = true
          if (!valueRaw) valueRaw = String(field.value)
        }
      }

      if ((fieldName === 'name' || fieldName === 'donorname') && !firstName && field.value) {
        firstName = String(field.value)
      }

      if ((fieldName === 'publicaddress' || fieldName === 'address') && !firstAddress && field.value) {
        firstAddress = String(field.value)
      }

      if (fieldName === 'paymenttype' && !firstPaymentType && field.value) {
        firstPaymentType = String(field.value)
      }
    }
  }

  if (!hasValue) return null

  return {
    name: firstName,
    address: firstAddress,
    value: totalValue,
    valueRaw,
    paymentType: firstPaymentType,
  }
}

function parseHours(value: string | number | null): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') return value

  // Handle various hour formats
  const cleaned = value.replace(/[^\d.]/g, '')
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? null : parsed
}

function parseDateField(value: string | number | null): string | null {
  if (value === null || value === undefined) return null

  // Reject boolean values (API sometimes returns false for empty dates)
  if (typeof value === 'boolean') return null
  if (value === 'false' || value === 'true') return null

  if (typeof value === 'number') return null

  // Check if it looks like a valid date string (contains digits and separators)
  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}|^\d{1,2}\s+\w+\s+\d{4}/
  if (!datePattern.test(value)) return null

  // Try to parse and validate
  const parsed = new Date(value)
  if (isNaN(parsed.getTime())) return null

  // Return ISO date string
  return parsed.toISOString().split('T')[0]
}

function calculateHourlyRate(
  amount: number | null,
  hours: number | null,
  period: string | null
): number | null {
  if (!amount || !hours || hours <= 0) return null

  // Normalize based on period if needed
  // For now, assume amount and hours are for the same period
  return amount / hours
}

export function extractPaymentFromInterest(interest: PublishedInterest): ExtractedPayment | null {
  const fields = interest.fields || []

  // Also check child interests for nested payment data
  const allFields = [...fields]
  for (const child of interest.childInterests || []) {
    allFields.push(...(child.fields || []))
  }

  if (allFields.length === 0) {
    return null
  }

  // First, try to extract from nested Donors/Payers arrays (common in Visits, Gifts, etc.)
  const donorData = extractFromDonorsArray(allFields)

  // Extract amount - try direct field first, then fall back to donor data
  const amountField = findField(allFields, FIELD_MAPPINGS.amount)
  let amountRaw = getFieldValue(amountField)
  let amount = parseCurrencyAmount(amountRaw)

  // If no direct amount found, use donor data
  if (amount === null && donorData && donorData.value !== null) {
    amount = donorData.value
    amountRaw = donorData.valueRaw
  }

  // Extract payer info - try direct field first, then fall back to donor data
  const payerField = findField(allFields, FIELD_MAPPINGS.payer)
  let payerName = getFieldValue(payerField) as string | null
  if (!payerName && donorData?.name) {
    payerName = donorData.name
  }

  // Extract role/work description
  const roleField = findField(allFields, FIELD_MAPPINGS.role)
  let roleDescription = getFieldValue(roleField) as string | null

  // Fallback to summary if no role found
  if (!roleDescription && interest.summary) {
    roleDescription = interest.summary
  }

  // Extract hours
  const hoursField = findField(allFields, FIELD_MAPPINGS.hours)
  const hoursWorked = parseHours(getFieldValue(hoursField))

  const hoursPeriodField = findField(allFields, FIELD_MAPPINGS.hoursPeriod)
  const hoursPeriod = getFieldValue(hoursPeriodField) as string | null

  // Calculate hourly rate
  const hourlyRate = calculateHourlyRate(amount, hoursWorked, hoursPeriod)

  // Extract other fields - try direct field first, then fall back to donor data
  const addressField = findField(allFields, FIELD_MAPPINGS.address)
  let payerAddress = getFieldValue(addressField) as string | null
  if (!payerAddress && donorData?.address) {
    payerAddress = donorData.address
  }

  const natureField = findField(allFields, FIELD_MAPPINGS.nature)
  const payerNatureOfBusiness = getFieldValue(natureField) as string | null

  const regularityField = findField(allFields, FIELD_MAPPINGS.regularity)
  const regularity = getFieldValue(regularityField) as string | null

  const paymentTypeField = findField(allFields, FIELD_MAPPINGS.paymentType)
  let paymentType = getFieldValue(paymentTypeField) as string | null
  if (!paymentType && donorData?.paymentType) {
    paymentType = donorData.paymentType
  }

  const startDateField = findField(allFields, FIELD_MAPPINGS.startDate)
  const startDate = parseDateField(getFieldValue(startDateField))

  const endDateField = findField(allFields, FIELD_MAPPINGS.endDate)
  const endDate = parseDateField(getFieldValue(endDateField))

  const receivedDateField = findField(allFields, FIELD_MAPPINGS.receivedDate)
  const receivedDate = parseDateField(getFieldValue(receivedDateField))

  // Extract donor status (Individual, Company, etc.) from API
  const donorStatusField = findField(allFields, FIELD_MAPPINGS.donorStatus)
  const payerStatus = getFieldValue(donorStatusField) as string | null

  // Try to get payer name from DonorName field if not found
  if (!payerName) {
    const donorNameField = findField(allFields, FIELD_MAPPINGS.donorName)
    payerName = getFieldValue(donorNameField) as string | null
  }

  // Determine if this is a donation
  const categoryName = interest.category?.name?.toLowerCase() || ''
  const isDonated = categoryName.includes('donation') || categoryName.includes('gift')

  return {
    interestId: interest.id,
    memberId: interest.member.id,
    categoryId: interest.category.id,
    amount,
    amountRaw: amountRaw?.toString() || null,
    paymentType,
    regularity,
    roleDescription,
    hoursWorked,
    hoursPeriod,
    hourlyRate,
    payerName,
    payerAddress,
    payerNatureOfBusiness,
    payerStatus,
    startDate,
    endDate,
    receivedDate,
    isDonated,
  }
}

export function extractAllPayments(interests: PublishedInterest[]): ExtractedPayment[] {
  const payments: ExtractedPayment[] = []

  for (const interest of interests) {
    const payment = extractPaymentFromInterest(interest)
    if (payment) {
      payments.push(payment)
    }
  }

  return payments
}
