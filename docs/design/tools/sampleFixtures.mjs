// The choices buildSampleData.mjs makes on top of the real data (BAJAOVRLAY-43): which moment
// of the enduro the static pages show, which teams the team card and the notices use, and the
// on-air data no export carries yet (the schedule, production messages, the QR card's words,
// the sponsors' display names). Everything about the race itself (teams, laps, times,
// scores, the bracket) comes from docs/design/sample_data; only what is listed here is chosen
// or invented, and the invented parts say so.

/** The event's name on air (super_prime.md's title) and the enduro's session. */
export const eventFixture = {
  eventName: '30ª Competição Baja SAE Brasil',
  sessionName: 'Enduro de Resistência',
  // The enduro runs four hours from the start (lap 0 at 10:01:05); the cars still finishing
  // their lap after the end is why the last pass is at 14:10. Assumed: the export has no end.
  sessionDurationMs: 4 * 60 * 60 * 1000,
  // The static pages show the race three hours in, with one hour left.
  staticMomentAfterStartMs: 3 * 60 * 60 * 1000,
  // The yellow-flag clock of the flags sheet: invented, the export has no flags.
  yellowMomentAfterStartMs: 3 * 60 * 60 * 1000 + 10 * 60 * 1000,
};

/**
 * The team card's teams: the overall champion with a photo cell (a stream frame stands in for
 * a car photo: no photos were given) and its logo, and another team without photo and logo.
 */
export const teamCardFixtures = {
  withMedia: { carNumber: 2, photoPath: '../../../brand/frames/3.jpg' },
  withoutMedia: { carNumber: 47 },
};

/**
 * The battle card shows the pair that stayed within 20 s of each other for the most laps
 * (sampleBattle.mjs: the race's only close fights are in its first laps); Atualizar walks its
 * next readings. The battle sheet's trends add and remove 0,7 s from the real gap.
 */
export const battleFixture = { withinMs: 20000, laterReadingsCount: 4, sheetTrendChangeMs: 700 };

/**
 * The penalty notices use these rows of penalizacoes.csv, by car number: a yellow flag (5 min),
 * an obstacle (2 min), fuel spilt (5 min), and one posted before the race (15 min). The
 * export's car numbers do not match teams.csv (car 41 there is "Centro Universitário FEI"),
 * so a notice shows the number and the school as the export writes them.
 */
export const noticePenaltyCars = { yellowFlag: 4, obstacle: 12, fuel: 43, beforeTheRace: 18 };

/** The day's schedule, invented for the boards (no export has one), before the enduro. */
export const scheduleFixture = [
  { timeText: '07:30', sessionName: 'Abertura do box', status: 'done' },
  { timeText: '08:30', sessionName: 'Briefing das equipes', status: 'done' },
  { timeText: '09:15', sessionName: 'Alinhamento do enduro', status: 'live' },
  { timeText: '10:00', sessionName: 'Enduro de Resistência', status: 'next' },
  { timeText: '14:30', sessionName: 'Intervalo', status: 'next' },
  { timeText: '16:00', sessionName: 'Cerimônia de premiação', status: 'next' },
];

/** The next session, for the countdown and the intermission board: the enduro. */
export const countdownFixture = {
  sessionName: 'Enduro de Resistência',
  startTimeText: '10:00',
  remainingMs: 1425000,
};

/** Free-text messages from production, invented, for the message ticker, one per page. */
export const messageFixtures = [
  'Largada do enduro às 10h00',
  'Box aberto para abastecimento',
  'Premiação às 16h no palco principal',
];

/** The sponsors' names as they are written (the logo files carry a lowercase key). */
export const sponsorNames = {
  bosch: 'Bosch',
  renault: 'Renault',
  certi: 'Certi',
  cnh: 'CNH',
  himix: 'Himix',
  horse: 'Horse',
  marcopolo: 'Marcopolo',
  rodonunes: 'Rodonunes',
  segula: 'Segula',
  trp: 'TRP',
  vetore: 'Vetore',
  criciuma: 'Criciúma',
  osaki: 'Osaki',
  sae4mobility: 'SAE4Mobility',
  satc: 'SATC',
  schulz: 'Schulz',
  sae: 'SAE Brasil',
};

/**
 * The sponsor levels in the order they are shown, each with the heading it carries on air:
 * the sponsorship levels read "Patrocínio …", support is just "Apoio", and the organiser,
 * SAE Brasil, closes every roll as "Realização". Prata has no sponsor this year; it is
 * listed so a sponsor of that level would land in its place.
 */
export const sponsorLevels = [
  { key: 'diamante', heading: 'Patrocínio Diamante' },
  { key: 'ouro', heading: 'Patrocínio Ouro' },
  { key: 'prata', heading: 'Patrocínio Prata' },
  { key: 'apoio', heading: 'Apoio' },
  { key: 'realizacao', heading: 'Realização' },
];

/** The QR card's words. The address is the event's results site (João, 2026-10-23). */
export const qrFixture = {
  callToAction: 'Acompanhe os resultados',
  url: 'resultados.bajasaebrasil.net',
};
