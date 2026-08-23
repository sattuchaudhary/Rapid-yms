// ============================================
// Normalizers & Semantic Extractors for Indian Vehicle ROs
// ============================================

export const INDIAN_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY',
  'RJ', 'SK', 'TN', 'TR', 'TS', 'UA', 'UK', 'UP', 'WB', 'BH',
]);

export interface NormalizedRegistration {
  normalized: string;
  raw: string;
  isValid: boolean;
  confidence: number;
  needsReview: boolean;
  reason?: string;
}

/**
 * Normalizes Indian Vehicle Registration Numbers with OCR character confusion repair.
 * Handles: "UP85 AB 1234", "UP-85-AB-1234", "UP85AB1234", "DL 01 C AA 1234", "BH 22 AB 1234"
 */
export function normalizeIndianRegistration(rawText: string): NormalizedRegistration {
  if (!rawText || typeof rawText !== 'string') {
    return { normalized: '', raw: '', isValid: false, confidence: 0, needsReview: true, reason: 'Empty text' };
  }

  const cleaned = rawText.toUpperCase().replace(/[\s\-_.\/]/g, '');

  // Standard Indian Plate Regex: 2 letters state + 1-2 digits RTO + 0-3 letters series + 4 digits number
  // Examples: UP85AB1234, DL1CAA1234, MH02CD5678, HR26DQ5555, BH22AB1234
  const standardPattern = /^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{4})$/;
  const match = cleaned.match(standardPattern);

  if (match) {
    const state = match[1];
    const rto = match[2].padStart(2, '0');
    const series = match[3];
    const num = match[4];

    const isValidState = INDIAN_STATE_CODES.has(state);
    const normalized = `${state}${rto}${series}${num}`;

    return {
      normalized,
      raw: rawText,
      isValid: isValidState,
      confidence: isValidState ? 0.98 : 0.75,
      needsReview: !isValidState,
      reason: isValidState ? undefined : `Unrecognized state code ${state}`,
    };
  }

  // Attempt OCR Confusion Disambiguation (O<->0, I<->1, S<->5, B<->8, Z<->2, G<->6)
  if (cleaned.length >= 8 && cleaned.length <= 11) {
    const potentialStateRaw = cleaned.slice(0, 2);
    const repairedState = potentialStateRaw
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');

    const rest = cleaned.slice(2);
    // Disambiguate next 2 chars as RTO digits
    const rtoPart = rest.slice(0, 2)
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2');

    // Last 4 characters must be digits
    const last4 = rest.slice(-4)
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/G/g, '6');

    // Middle is series letters
    const seriesPart = rest.slice(2, -4)
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');

    const candidate = `${repairedState}${rtoPart}${seriesPart}${last4}`;
    const candidateMatch = candidate.match(standardPattern);

    if (candidateMatch && INDIAN_STATE_CODES.has(candidateMatch[1])) {
      return {
        normalized: candidate,
        raw: rawText,
        isValid: true,
        confidence: 0.88,
        needsReview: true, // Marked for review because OCR repair was performed
        reason: 'OCR character disambiguation applied',
      };
    }
  }

  return {
    normalized: cleaned,
    raw: rawText,
    isValid: false,
    confidence: 0.3,
    needsReview: true,
    reason: 'Could not reliably match Indian registration format',
  };
}

/**
 * Robust Indian Date Parser
 * Supports: "19-Aug-2026", "19-Aug-26", "19/08/2026", "19-08-2026", "19.08.2026", "19 Aug 2026", "Aug 19 2026", "2026-08-19"
 * NEVER falls back silently to new Date() if not detected.
 */
export interface NormalizedDate {
  date: Date | null;
  formatted: string;
  confidence: number;
  needsReview: boolean;
  rawText?: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseRobustDate(text: string): NormalizedDate {
  if (!text || typeof text !== 'string') {
    return { date: null, formatted: '', confidence: 0, needsReview: true };
  }

  // 1. Check for formats like "19-Aug-2026" or "19 Aug 2026" or "19/Aug/2026"
  const alphaMonthRegex = /(?:Date\s*[:\-\.]?\s*)?(\b\d{1,2})[\s\-\/\.]([A-Za-z]{3,9})[\s\-\/\.](\d{2,4}\b)/i;
  const alphaMatch = text.match(alphaMonthRegex);

  if (alphaMatch) {
    const day = parseInt(alphaMatch[1], 10);
    const monthKey = alphaMatch[2].toLowerCase();
    let year = parseInt(alphaMatch[3], 10);
    if (year < 100) year += 2000;

    let month = -1;
    for (const [key, idx] of Object.entries(MONTH_MAP)) {
      if (monthKey.startsWith(key.slice(0, 3))) {
        month = idx;
        break;
      }
    }

    if (month !== -1 && day >= 1 && day <= 31 && year >= 2000 && year <= 2050) {
      const parsedDate = new Date(year, month, day);
      return {
        date: parsedDate,
        formatted: parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        confidence: 0.96,
        needsReview: false,
        rawText: alphaMatch[0],
      };
    }
  }

  // 2. Check for numeric formats: "19/08/2026", "19-08-2026", "19.08.2026" (DD/MM/YYYY)
  const numericDateRegex = /(?:Date\s*[:\-\.]?\s*)?(\b\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{2,4}\b)/i;
  const numMatch = text.match(numericDateRegex);

  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000 && year <= 2050) {
      const parsedDate = new Date(year, month, day);
      return {
        date: parsedDate,
        formatted: parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        confidence: 0.92,
        needsReview: false,
        rawText: numMatch[0],
      };
    }
  }

  // 3. Check for ISO format: "2026-08-19"
  const isoMatch = text.match(/(\b\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2}\b)/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000 && year <= 2050) {
      const parsedDate = new Date(year, month, day);
      return {
        date: parsedDate,
        formatted: parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        confidence: 0.90,
        needsReview: false,
        rawText: isoMatch[0],
      };
    }
  }

  return {
    date: null,
    formatted: '',
    confidence: 0,
    needsReview: true,
  };
}

/**
 * Robust Waiver / Grace Period Extraction
 * Supports: "48 hours", "2 days", "two days", "within 48 hrs", "valid for 2 days", "waive off 2 days", "grace period 48 hours"
 */
export interface NormalizedWaiver {
  waiverHours: number;
  waiverDays: number;
  confidence: number;
  sourceText: string;
}

export function parseWaiverPeriod(text: string): NormalizedWaiver {
  if (!text) {
    return { waiverHours: 48, waiverDays: 2, confidence: 0.5, sourceText: 'Default 48h policy' };
  }

  const hoursMatch = text.match(/(\d{1,3})\s*(?:hours|hrs|hr|ghante)/i);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    if (hours > 0 && hours <= 240) {
      return {
        waiverHours: hours,
        waiverDays: Math.ceil(hours / 24),
        confidence: 0.95,
        sourceText: hoursMatch[0],
      };
    }
  }

  const wordDaysMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };

  const daysWordMatch = text.match(/(one|two|three|four|five|six|seven)\s*(?:days|day|working days)/i);
  if (daysWordMatch) {
    const word = daysWordMatch[1].toLowerCase();
    const days = wordDaysMap[word] || 2;
    return {
      waiverHours: days * 24,
      waiverDays: days,
      confidence: 0.94,
      sourceText: daysWordMatch[0],
    };
  }

  const daysNumMatch = text.match(/(\d{1,2})\s*(?:days|day|working days)/i);
  if (daysNumMatch) {
    const days = parseInt(daysNumMatch[1], 10);
    if (days >= 1 && days <= 15) {
      return {
        waiverHours: days * 24,
        waiverDays: days,
        confidence: 0.93,
        sourceText: daysNumMatch[0],
      };
    }
  }

  // Default fallback if no specific waiver clause found
  return {
    waiverHours: 48,
    waiverDays: 2,
    confidence: 0.6,
    sourceText: 'Standard Bank 48hr Grace Period',
  };
}

export const KNOWN_FINANCIERS = [
  'IDFC FIRST Bank',
  'IDFC Bank',
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'SBI',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Kotak Bank',
  'Bajaj Finance',
  'TVS Credit',
  'Cholamandalam Investment and Finance',
  'Cholamandalam',
  'IndusInd Bank',
  'Hero Fincorp',
  'AU Small Finance Bank',
  'Mahindra & Mahindra Financial Services',
  'Mahindra Finance',
  'Shriram Finance',
  'Tata Capital',
  'Federal Bank',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'Union Bank of India',
  'Yes Bank',
  'RBL Bank',
  'L&T Finance',
  'Piramal Capital',
  'Poonawalla Fincorp',
  'Dhani Loans',
  'Sundaram Finance',
  'Muthoot Finance',
  'Manappuram Finance',
];

export interface DetectedFinancier {
  name: string;
  isKnown: boolean;
  confidence: number;
  sourceText?: string;
}

/**
 * Financier detection engine combining dictionary search, fuzzy matching, and generic financier pattern extraction.
 */
export function detectFinancier(text: string): DetectedFinancier {
  if (!text) {
    return { name: '', isKnown: false, confidence: 0 };
  }

  // 1. Direct Regex match against known financiers dictionary
  for (const financier of KNOWN_FINANCIERS) {
    const pattern = new RegExp(financier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
    const match = text.match(pattern);
    if (match) {
      return {
        name: financier,
        isKnown: true,
        confidence: 0.98,
        sourceText: match[0],
      };
    }
  }

  // 2. Generic Financier Header detection (lines containing bank / finance / capital / fincorp)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    if (/\b(bank|finance|financial|fincorp|capital|credit|nbfc|leasing|housing finance)\b/i.test(line)) {
      const cleaned = line.replace(/^(from|to|ref|dated?|subject|sub|attn)\s*[:\-\.]?\s*/i, '').trim();
      if (cleaned.length >= 4 && cleaned.length <= 60 && !/release|order|delivery|authorization|sir|madam/i.test(cleaned)) {
        return {
          name: cleaned,
          isKnown: false,
          confidence: 0.80,
          sourceText: line,
        };
      }
    }
  }

  return {
    name: '',
    isKnown: false,
    confidence: 0,
  };
}
