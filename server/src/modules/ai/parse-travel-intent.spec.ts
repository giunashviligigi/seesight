import {
  applyClarificationAnswer,
  finalizeTravelIntent,
  heuristicParseTravelIntent,
  preferConfirmedDraft,
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
    expect(result.hotelNights).toBe(8);
    expect(result.clarifyingQuestion).toBeNull();
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
    expect(result.clarifyingQuestion).toMatch(/hotel nights/i);
  });

  it('parses US month-first single date with one-way and asks for hotel nights', () => {
    const result = heuristicParseTravelIntent(
      'Need a one-way flight from Tbilisi to Paris on September 15',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('CDG');
    expect(result.departureDate).toBe('2026-09-15');
    expect(result.tripType).toBe('one_way');
    expect(result.hotelNights).toBeNull();
    expect(result.clarifyingQuestion).toMatch(/hotel nights/i);
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
    expect(result.hotelNights).toBe(5);
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

  it('infers hotel nights from stay phrase and is ready when complete', () => {
    const result = heuristicParseTravelIntent(
      'flights from tbilisi to dubai on 10 march for five nights',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('DXB');
    expect(result.departureDate).toBe('2027-03-10');
    expect(result.returnDate).toBe('2027-03-15');
    expect(result.tripType).toBe('one_way');
    expect(result.hotelNights).toBe(5);
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
    expect(result.hotelNights).toBeNull();
    expect(result.clarifyingQuestion).toMatch(/departing from/i);
  });

  it('asks for hotel nights on one-way with date but no stay length', () => {
    const result = heuristicParseTravelIntent(
      'Book me a flight from Batumi to Rome next Monday.',
      reference,
    );

    expect(result.originIata).toBe('BUS');
    expect(result.destinationIata).toBe('FCO');
    expect(result.departureDate).toBe('2026-07-20');
    expect(result.tripType).toBe('one_way');
    expect(result.hotelNights).toBeNull();
    expect(result.clarifyingQuestion).toMatch(/hotel nights/i);
  });

  it('clears invented same-city origin and asks for departure', () => {
    const result = finalizeTravelIntent({
      isTravelRequest: true,
      originIata: 'DXB',
      destinationIata: 'DXB',
      originCity: 'Dubai',
      destinationCity: 'Dubai',
      departureDate: '2026-08-20',
      returnDate: '2026-08-26',
      tripType: 'round_trip',
      hotelNights: null,
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
    expect(partial.hotelNights).toBe(5);
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
    expect(withDate.hotelNights).toBe(5);
    expect(withDate.clarifyingQuestion).toBeNull();
  });

  it('rejects non-travel prompts and asks for destination (not origin)', () => {
    const result = heuristicParseTravelIntent(
      'what color is my dog',
      reference,
    );

    expect(result.isTravelRequest).toBe(false);
    expect(result.originIata).toBeNull();
    expect(result.destinationIata).toBeNull();
    expect(result.departureDate).toBeNull();
    expect(result.tripType).toBeNull();
    expect(result.clarifyingQuestion).toMatch(/doesn.t look like a trip/i);
    expect(result.clarifyingQuestion).toMatch(/want to go/i);
    expect(result.clarificationFocus).toBe('destination');
  });

  it('does not accept a spoofed origin clarifyingQuestion when destination is missing', () => {
    const result = finalizeTravelIntent({
      isTravelRequest: false,
      originIata: null,
      destinationIata: null,
      originCity: null,
      destinationCity: null,
      departureDate: null,
      returnDate: null,
      tripType: null,
      hotelNights: null,
      adults: null,
      source: 'gemini',
      notes: [],
      clarifyingQuestion: 'Where are you departing from?',
    });

    expect(result.destinationIata).toBeNull();
    expect(result.clarifyingQuestion).toMatch(/want to go/i);
    expect(result.clarificationFocus).toBe('destination');
  });

  it('walks full Q&A from non-travel prompt to ready search fields', () => {
    let draft = heuristicParseTravelIntent('what color is my dog', reference);
    expect(draft.isTravelRequest).toBe(false);
    expect(draft.clarificationFocus).toBe('destination');

    draft = applyClarificationAnswer(draft, 'Berlin', 'destination', reference);
    expect(draft.isTravelRequest).toBe(true);
    expect(draft.destinationIata).toBe('BER');
    expect(draft.clarificationFocus).toBe('origin');

    draft = applyClarificationAnswer(draft, 'Tbilisi', 'origin', reference);
    expect(draft.originIata).toBe('TBS');
    expect(draft.clarificationFocus).toBe('tripType');

    draft = applyClarificationAnswer(draft, 'one way', 'tripType', reference);
    expect(draft.tripType).toBe('one_way');
    expect(draft.clarificationFocus).toBe('departureDate');

    draft = applyClarificationAnswer(
      draft,
      '20 august',
      'departureDate',
      reference,
    );
    expect(draft.departureDate).toBe('2026-08-20');
    expect(draft.clarificationFocus).toBe('hotelNights');

    draft = applyClarificationAnswer(draft, '3', 'hotelNights', reference);
    expect(draft.hotelNights).toBe(3);
    expect(draft.clarifyingQuestion).toBeNull();
    expect(draft.clarificationFocus).toBeNull();
  });

  it('keeps confirmed origin when re-parsing enriched chat for trip type', () => {
    const heuristic = heuristicParseTravelIntent(
      'what color is my dog\nto Dubai\nfrom tbilisi\ntrip type one way',
      reference,
    );
    const base = preferConfirmedDraft(heuristic, {
      originIata: 'TBS',
      originCity: 'Tbilisi',
      destinationIata: 'DXB',
      destinationCity: 'Dubai',
    });
    const next = applyClarificationAnswer(
      base,
      'one way',
      'tripType',
      reference,
    );
    expect(next.originIata).toBe('TBS');
    expect(next.destinationIata).toBe('DXB');
    expect(next.tripType).toBe('one_way');
    expect(next.clarificationFocus).toBe('departureDate');
  });

  it('does not treat hotel-night counts as a 2-digit year on departing dates', () => {
    const polluted = heuristicParseTravelIntent(
      'to Berlin\nfrom tbilisi\ntrip type one way\ndeparting 20 august\n10 hotel nights',
      reference,
    );
    const base = preferConfirmedDraft(polluted, {
      originIata: 'TBS',
      destinationIata: 'BER',
      tripType: 'one_way',
      departureDate: '2026-08-20',
    });
    const next = applyClarificationAnswer(
      base,
      '10',
      'hotelNights',
      reference,
      'to Berlin\nfrom tbilisi\ntrip type one way\ndeparting 20 august\n10 hotel nights',
    );
    expect(next.departureDate).toBe('2026-08-20');
    expect(next.hotelNights).toBe(10);
    expect(next.clarifyingQuestion).toBeNull();
  });

  it('asks trip type when route is known but trip type is unclear', () => {
    const result = heuristicParseTravelIntent(
      'from tbilisi to berlin please',
      reference,
    );

    expect(result.originIata).toBe('TBS');
    expect(result.destinationIata).toBe('BER');
    expect(result.tripType).toBeNull();
    expect(result.clarifyingQuestion).toMatch(/one-way or round-trip/i);
  });

  it('applies trip type and hotel nights clarifications', () => {
    const partial = finalizeTravelIntent({
      isTravelRequest: true,
      originIata: 'TBS',
      destinationIata: 'CDG',
      originCity: 'Tbilisi',
      destinationCity: 'Paris',
      departureDate: '2026-09-15',
      returnDate: null,
      tripType: null,
      hotelNights: null,
      adults: 1,
      source: 'heuristic',
      notes: [],
    });
    expect(partial.clarifyingQuestion).toMatch(/one-way or round-trip/i);

    const withType = applyClarificationAnswer(
      partial,
      'one way',
      'tripType',
      reference,
    );
    expect(withType.tripType).toBe('one_way');
    expect(withType.clarifyingQuestion).toMatch(/hotel nights/i);

    const withNights = applyClarificationAnswer(
      withType,
      '3',
      'hotelNights',
      reference,
    );
    expect(withNights.hotelNights).toBe(3);
    expect(withNights.returnDate).toBe('2026-09-18');
    expect(withNights.clarifyingQuestion).toBeNull();
  });

  it('hotels-only: date-range prompt asks hotel city and keeps stay dates', () => {
    const result = heuristicParseTravelIntent(
      'i want hotel from 20 september to 25 september',
      reference,
      'HOTELS',
    );

    expect(result.isTravelRequest).toBe(true);
    expect(result.originIata).toBeNull();
    expect(result.destinationIata).toBeNull();
    expect(result.departureDate).toBe('2026-09-20');
    expect(result.returnDate).toBe('2026-09-25');
    expect(result.clarificationFocus).toBe('destination');
    expect(result.clarifyingQuestion).toBe(
      'Which city do you want a hotel in?',
    );
    expect(result.clarifyingQuestion).not.toMatch(/departing from|where do you want to go/i);
  });

  it('hotels-only: city answer after date prompt is ready without origin', () => {
    const base = heuristicParseTravelIntent(
      'i want hotel from 20 september to 25 september',
      reference,
      'HOTELS',
    );
    const next = applyClarificationAnswer(
      base,
      'Berlin',
      'destination',
      reference,
      'i want hotel from 20 september to 25 september',
      'HOTELS',
    );

    expect(next.destinationIata).toBe('BER');
    expect(next.departureDate).toBe('2026-09-20');
    expect(next.returnDate).toBe('2026-09-25');
    expect(next.originIata).toBeNull();
    expect(next.clarifyingQuestion).toBeNull();
    expect(next.clarificationFocus).toBeNull();
  });
});
