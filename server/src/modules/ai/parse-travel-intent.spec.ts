import { heuristicParseTravelIntent } from './parse-travel-intent';

describe('heuristicParseTravelIntent', () => {
  const reference = new Date('2026-07-19T12:00:00.000Z');

  it('parses to-destination from-origin with glued month names and one-way', () => {
    const result = heuristicParseTravelIntent(
      'i want one way trip to budapest from 21 november to 29november from kutaisi',
      reference,
    );

    expect(result.originIata).toBe('KUT');
    expect(result.destinationIata).toBe('BUD');
    expect(result.originCity).toBe('Kutaisi');
    expect(result.destinationCity).toBe('Budapest');
    expect(result.departureDate).toBe('2026-11-21');
    expect(result.returnDate).toBe('2026-11-29');
    expect(result.tripType).toBe('one_way');
    expect(result.source).toBe('heuristic');
  });

  it('parses classic from-to with shared month range', () => {
    const result = heuristicParseTravelIntent(
      'from 1 august to 6 august from tbilisi to berlin',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('BER');
    expect(result.departureDate).toBe('2026-08-01');
    expect(result.returnDate).toBe('2026-08-06');
    expect(result.tripType).toBe('round_trip');
  });
});
