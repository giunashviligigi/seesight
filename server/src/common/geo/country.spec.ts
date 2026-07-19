import {
  isCountryCode,
  toCountryCode,
  toCountryName,
} from './country';

describe('country helpers', () => {
  it('maps full names to ISO codes', () => {
    expect(toCountryCode('Georgia')).toBe('GE');
    expect(toCountryCode('germany')).toBe('DE');
    expect(toCountryCode('United States')).toBe('US');
    expect(toCountryCode('USA')).toBe('US');
  });

  it('accepts ISO codes case-insensitively', () => {
    expect(toCountryCode('ge')).toBe('GE');
    expect(toCountryCode('DE')).toBe('DE');
  });

  it('returns null for empty input', () => {
    expect(toCountryCode('')).toBeNull();
    expect(toCountryCode('   ')).toBeNull();
    expect(toCountryCode(null)).toBeNull();
  });

  it('rejects unknown values', () => {
    expect(() => toCountryCode('Narnia')).toThrow(/Unknown country/);
  });

  it('formats codes as English names', () => {
    expect(toCountryName('GE')).toBe('Georgia');
    expect(toCountryName('de')).toBe('Germany');
  });

  it('validates codes', () => {
    expect(isCountryCode('GE')).toBe(true);
    expect(isCountryCode('ZZ')).toBe(false);
  });
});
