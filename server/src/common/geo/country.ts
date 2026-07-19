import { BadRequestException } from '@nestjs/common';

/**
 * Country helpers: accept ISO alpha-2 codes or English names,
 * always persist as ISO 3166-1 alpha-2 (e.g. "Georgia" → "GE").
 */

const ALIASES: Record<string, string> = {
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  britain: 'GB',
  england: 'GB',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  america: 'US',
  uae: 'AE',
  'united arab emirates': 'AE',
  russia: 'RU',
  'russian federation': 'RU',
  'south korea': 'KR',
  'north korea': 'KP',
  'czech republic': 'CZ',
  czechia: 'CZ',
  holland: 'NL',
  netherlands: 'NL',
  vietnam: 'VN',
  'viet nam': 'VN',
  taiwan: 'TW',
  palestine: 'PS',
  syria: 'SY',
  iran: 'IR',
  bolivia: 'BO',
  venezuela: 'VE',
  tanzania: 'TZ',
  moldova: 'MD',
  'ivory coast': 'CI',
  "cote d'ivoire": 'CI',
  "côte d'ivoire": 'CI',
  turkey: 'TR',
  turkiye: 'TR',
};

/** Common ISO 3166-1 alpha-2 codes used to build the name → code map. */
const ISO_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU',
  'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL',
  'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC',
  'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV',
  'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG',
  'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD',
  'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT',
  'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM',
  'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH',
  'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK',
  'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH',
  'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW',
  'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR',
  'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR',
  'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC',
  'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL',
  'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY',
  'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA',
  'ZM', 'ZW',
] as const;

let nameToCode: Map<string, string> | null = null;
let displayNames: Intl.DisplayNames | null = null;

function getDisplayNames(): Intl.DisplayNames {
  if (!displayNames) {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  }
  return displayNames;
}

function getNameToCodeMap(): Map<string, string> {
  if (nameToCode) return nameToCode;

  const map = new Map<string, string>();
  const dn = getDisplayNames();

  for (const code of ISO_CODES) {
    const name = dn.of(code);
    if (name) {
      map.set(normalizeKey(name), code);
    }
  }

  for (const [alias, code] of Object.entries(ALIASES)) {
    map.set(normalizeKey(alias), code);
  }

  nameToCode = map;
  return map;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCountryCode(value: string): boolean {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && (ISO_CODES as readonly string[]).includes(code);
}

/**
 * Resolves a user-facing country string (name or ISO code) to ISO alpha-2.
 * Returns null for empty input. Throws Error with a clear message when invalid.
 */
export function toCountryCode(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;

  if (/^[a-zA-Z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    if (isCountryCode(code)) return code;
  }

  const mapped = getNameToCodeMap().get(normalizeKey(raw));
  if (mapped) return mapped;

  throw new Error(
    `Unknown country "${raw}". Use a full name or ISO code (e.g. Georgia or GE).`,
  );
}

/** Same as toCountryCode, but raises Nest BadRequestException for API handlers. */
export function parseCountryCode(
  input: string | null | undefined,
): string | null {
  try {
    return toCountryCode(input);
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : 'Invalid country',
    );
  }
}

/** Converts a stored ISO code to an English display name for UI. */
export function toCountryName(
  codeOrName: string | null | undefined,
): string | null {
  if (codeOrName == null) return null;
  const raw = codeOrName.trim();
  if (!raw) return null;

  if (/^[a-zA-Z]{2}$/.test(raw) && isCountryCode(raw.toUpperCase())) {
    return getDisplayNames().of(raw.toUpperCase()) ?? raw.toUpperCase();
  }

  // Already a name (or unknown) — return as-is for display.
  try {
    const code = toCountryCode(raw);
    if (code) return getDisplayNames().of(code) ?? code;
  } catch {
    return raw;
  }
  return raw;
}
