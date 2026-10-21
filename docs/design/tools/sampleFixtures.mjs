// The on-air data no canonical shape carries yet (BAJAOVRLAY-43; the "data needs" of each
// graphic are in docs/design/directions/ardosia/catalogue.md): what an operator types today,
// or what the entity library (BAJAOVRLAY-19) and the schedule will hold later. A car is named
// by its number only and buildSampleData.mjs looks its team up in the positions sample, so no
// team name is typed twice. Everything here is fictional: the cities, the schedule, the
// messages, the sponsors ("Patrocinador A": no real brand, ever).

/**
 * The team card's extras. The card with media shows a photo cell (a stream frame stands in
 * for the car photo) and a logo cell (a placeholder mark drawn from the team's initials); the
 * card without media is the common case until the entity library exists.
 */
export const teamCardFixtures = {
  withMedia: {
    carNumber: 31,
    city: 'São Caetano do Sul · SP',
    photoPath: '../../../brand/frames/3.jpg',
    logoInitials: 'AB',
  },
  withoutMedia: {
    carNumber: 38,
    city: 'São Carlos · SP',
  },
};

/**
 * Two cars fighting for one place. The positions shape carries the interval now; a trend
 * needs the interval a lap ago too, so the three states give it as a fixture (closing: the
 * gap shrank, opening: it grew, steady: it did not move).
 */
export const battleFixture = {
  aheadCarNumber: 78,
  behindCarNumber: 52,
  intervalOneLapAgoMs: { closing: 9150, opening: 7620, steady: 8388 },
};

/**
 * Notices from race direction. The reason and the penalty are typed by the operator; the
 * penalty is optional (an incident without one). "+30 segundos" is written in words because
 * the on-air face has no lowercase and "+30 s" would read as "+30 S".
 */
export const noticeFixtures = {
  penalty: { carNumber: 47, kind: 'penalty', reason: 'Queima de largada', penalty: '+30 segundos' },
  blackFlag: {
    carNumber: 65,
    kind: 'penalty',
    reason: 'Conduta antidesportiva',
    penalty: 'Bandeira preta',
  },
  incident: { carNumber: 13, kind: 'incident', reason: 'Volta cancelada', penalty: '' },
};

/** The day's schedule, as production would type it: a dynamic-events day with a lunch break. */
export const scheduleFixture = [
  { timeText: '08:00', sessionName: 'Briefing das equipes', status: 'done' },
  { timeText: '08:30', sessionName: 'Aceleração', status: 'done' },
  { timeText: '10:00', sessionName: 'Velocidade', status: 'done' },
  { timeText: '11:30', sessionName: 'Tração', status: 'done' },
  { timeText: '12:30', sessionName: 'Intervalo', status: 'live' },
  { timeText: '13:30', sessionName: 'Suspensão', status: 'next' },
  { timeText: '15:00', sessionName: 'Manobrabilidade', status: 'next' },
  { timeText: '16:30', sessionName: 'Eliminatórias de suspensão', status: 'next' },
  { timeText: '18:00', sessionName: 'Cerimônia de premiação', status: 'next' },
];

/** The next session, for the countdown and the intermission board: the first "next" above. */
export const countdownFixture = {
  sessionName: 'Suspensão',
  startTimeText: '13:30',
  remainingMs: 1425000,
};

/** Free-text messages from production, for the message ticker, one per page. */
export const messageFixtures = [
  'Próxima sessão às 13h30: Suspensão',
  'Box aberto para abastecimento',
  'Premiação às 18h no palco principal',
];

/** Plainly fictional sponsors; the roll shows six per page, so nine make two pages. */
export const sponsorFixtures = [
  'Patrocinador A',
  'Patrocinador B',
  'Patrocinador C',
  'Patrocinador D',
  'Patrocinador E',
  'Patrocinador F',
  'Patrocinador G',
  'Patrocinador H',
  'Patrocinador I',
];

/** The QR card's words. The address is the scoreboard the stream links to today. */
export const qrFixture = {
  callToAction: 'Acompanhe os resultados',
  url: 'placarbaja.juansalles.com.br',
};
