export class RCLookupError extends Error {
  constructor(message: string, public readonly code: string = 'RC_LOOKUP_FAILED', public readonly statusCode: number = 400) {
    super(message);
    this.name = 'RCLookupError';
  }
}

export class InvalidRCNumberError extends RCLookupError {
  constructor(rcNumber: string) {
    super(`Invalid Indian Vehicle Registration Number format: "${rcNumber}"`, 'INVALID_RC_FORMAT', 422);
  }
}

export class ProviderUnavailableError extends RCLookupError {
  constructor(providerName: string, reason?: string) {
    super(`Provider ${providerName} is unavailable${reason ? `: ${reason}` : ''}`, 'PROVIDER_UNAVAILABLE', 503);
  }
}

/**
 * Normalizes Indian Vehicle Numbers
 * Examples:
 * "hr-26-fv-5656" -> "HR26FV5656"
 * "DL 01 AB 1234" -> "DL01AB1234"
 * "dl1ab1234" -> "DL01AB1234"
 */
export function normalizeRCNumber(input: string): string {
  if (!input) return '';
  let cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

  // Handle single digit district codes e.g. DL1AB1234 -> DL01AB1234
  const singleDigitMatch = cleaned.match(/^([A-Z]{2})([0-9])([A-Z]{1,3}[0-9]{1,4})$/);
  if (singleDigitMatch) {
    cleaned = `${singleDigitMatch[1]}0${singleDigitMatch[2]}${singleDigitMatch[3]}`;
  }

  return cleaned;
}

/**
 * Validates if the string adheres to Indian Vehicle Registration syntax:
 * Standard: 2 Letters (State) + 2 Digits (RTO) + 0-3 Letters (Series) + 1-4 Digits (Number)
 * Bharat Series: 2 Digits (Year) + "BH" + 4 Digits + 2 Letters
 */
export function isValidRCNumber(rcNumber: string): boolean {
  const normalized = normalizeRCNumber(rcNumber);
  const standardPattern = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{1,4}$/;
  const bhSeriesPattern = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  return standardPattern.test(normalized) || bhSeriesPattern.test(normalized);
}
