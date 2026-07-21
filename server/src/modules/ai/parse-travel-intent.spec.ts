import {
  applyClarificationAnswer,
  finalizeTravelIntent,
  heuristicParseTravelIntent,
} from './parse-travel-intent';
import { resolvePlaceQuery } from './city-airports';

describe('resolvePlaceQuery (global airports)', () => {
  it('resolves cyprus country to Larnaca hub', () => {
    const hit = resolvePlaceQuery('cyprus');
    expect(hit?.iata).toBe('LCA');
    expect(hit?.city).toBe('Larnaca');
  });

  it('resolves bali alias to Denpasar', () => {
    const hit = resolvePlaceQuery('bali');
    expect(hit?.iata).toBe('DPS');
  });

  it('resolves cape town city', () => {
    const hit = resolvePlaceQuery('cape town');
    expect(hit?.iata).toBe('CPT');
  });

  it('resolves IATA codes directly', () => {
    expect(resolvePlaceQuery('KUT')?.city).toBe('Kutaisi');
    expect(resolvePlaceQuery('BUD')?.city).toBe('Budapest');
  });
});

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

  it('parses round trip from kutaisi to cyprus with date range', () => {
    const result = heuristicParseTravelIntent(
      'i want round trip from kutaisi to cyprus from 20 august to 25 august',
      reference,
    );

    expect(result.originIata).toBe('KUT');
    expect(result.destinationIata).toBe('LCA');
    expect(result.departureDate).toBe('2026-08-20');
    expect(result.returnDate).toBe('2026-08-25');
    expect(result.tripType).toBe('round_trip');
  });

  it('parses tbilisi to bali', () => {
    const result = heuristicParseTravelIntent(
      'from tbilisi to bali from 1 september to 10 september',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('DPS');
    expect(result.departureDate).toBe('2026-09-01');
    expect(result.returnDate).toBe('2026-09-10');
  });

  it('parses batumi to cape town', () => {
    const result = heuristicParseTravelIntent(
      'round trip from batumi to cape town from 5 october to 12 october',
      reference,
    );

    expect(result.originIata).toBe('BUS');
    expect(result.destinationIata).toBe('CPT');
    expect(result.tripType).toBe('round_trip');
  });

  it('parses US month-first date range with in-city destination', () => {
    const result = heuristicParseTravelIntent(
      'I need flights and a hotel in Barcelona from October 5 to October 12',
      reference,
    );

    expect(result.originIata).toBeNull();
    expect(result.destinationIata).toBe('BCN');
    expect(result.departureDate).toBe('2026-10-05');
    expect(result.returnDate).toBe('2026-10-12');
    expect(result.tripType).toBe('round_trip');
  });

  it('parses relative next Monday', () => {
    // reference is Sunday 2026-07-19 → next Monday = 2026-07-20
    const result = heuristicParseTravelIntent(
      'Book me a flight from Batumi to Rome next Monday.',
      reference,
    );

    expect(result.originIata).toBe('BUS');
    expect(result.destinationIata).toBe('FCO');
    expect(result.departureDate).toBe('2026-07-20');
    expect(result.tripType).toBe('one_way');
  });

  it('parses US month-first single date with one-way', () => {
    const result = heuristicParseTravelIntent(
      'Need a one-way flight from Tbilisi to Paris on September 15',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('CDG');
    expect(result.departureDate).toBe('2026-09-15');
    expect(result.tripType).toBe('one_way');
    expect(result.clarifyingQuestion).toBeNull();
  });

  it('asks for departure city when destination and stay nights exist without origin/date', () => {
    const result = heuristicParseTravelIntent(
      'My budget is around €500. I need flights for 2 adults and a hotel in Dubai for five nights',
      reference,
    );

    expect(result.originIata).toBeNull();
    expect(result.destinationIata).toBe('DXB');
    expect(result.adults).toBe(2);
    expect(result.departureDate).toBeNull();
    expect(result.tripType).toBe('one_way');
    expect(result.clarifyingQuestion).toMatch(/departing from/i);
  });

  it('treats a single calendar date as one-way and asks for origin when missing', () => {
    const result = heuristicParseTravelIntent(
      'flight to berlin on 25 january',
      reference,
    );

    expect(result.destinationIata).toBe('BER');
    expect(result.departureDate).toBe('2027-01-25');
    expect(result.returnDate).toBeNull();
    expect(result.tripType).toBe('one_way');
    expect(result.clarifyingQuestion).toMatch(/departing from/i);
  });

  it('infers hotel checkout from nights once departure is known', () => {
    const result = heuristicParseTravelIntent(
      'flights from tbilisi to dubai on 10 march for five nights',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('DXB');
    expect(result.departureDate).toBe('2027-03-10');
    expect(result.returnDate).toBe('2027-03-15');
    expect(result.tripType).toBe('one_way');
    expect(result.clarifyingQuestion).toBeNull();
  });

  it('asks for departure city when dates exist but origin does not (no DXB→DXB)', () => {
    const result = heuristicParseTravelIntent(
      'I need flights for 2 adults and a hotel in Dubai for five nights. from  20august to 26 august',
      reference,
    );

    expect(result.originIata).toBeNull();
    expect(result.destinationIata).toBe('DXB');
    expect(result.departureDate).toBe('2026-08-20');
    expect(result.returnDate).toBe('2026-08-26');
    expect(result.adults).toBe(2);
    expect(result.tripType).toBe('round_trip');
    expect(result.clarifyingQuestion).toMatch(/departing from/i);
  });

  it('clears invented same-city origin and asks for departure', () => {
    const result = finalizeTravelIntent({
      originIata: 'DXB',
      destinationIata: 'DXB',
      originCity: 'Dubai',
      destinationCity: 'Dubai',
      departureDate: '2026-08-20',
      returnDate: '2026-08-26',
      tripType: 'round_trip',
      adults: 2,
      source: 'gemini',
      notes: [],
      clarifyingQuestion: null,
    });

    expect(result.originIata).toBeNull();
    expect(result.destinationIata).toBe('DXB');
    expect(result.clarifyingQuestion).toMatch(/departing from/i);
  });

  it('applies bare clarification answer "Tbilisi" as origin then asks for date', () => {
    const partial = heuristicParseTravelIntent(
      'My budget is around €500. I need flights for 2 adults and a hotel in Dubai for five nights.',
      reference,
    );
    expect(partial.originIata).toBeNull();
    expect(partial.destinationIata).toBe('DXB');
    expect(partial.clarifyingQuestion).toMatch(/departing from/i);

    const withOrigin = applyClarificationAnswer(
      partial,
      'Tbilisi',
      'origin',
      reference,
      'My budget is around €500. I need flights for 2 adults and a hotel in Dubai for five nights.',
    );

    expect(withOrigin.originIata).toBe('TBS');
    expect(withOrigin.destinationIata).toBe('DXB');
    expect(withOrigin.departureDate).toBeNull();
    expect(withOrigin.clarifyingQuestion).toMatch(/departure date/i);

    const withDate = applyClarificationAnswer(
      withOrigin,
      '20 august',
      'departureDate',
      reference,
      'My budget is around €500. I need flights for 2 adults and a hotel in Dubai for five nights.',
    );

    expect(withDate.originIata).toBe('TBS');
    expect(withDate.departureDate).toBe('2026-08-20');
    expect(withDate.returnDate).toBe('2026-08-25');
    expect(withDate.clarifyingQuestion).toBeNull();
  });
});
