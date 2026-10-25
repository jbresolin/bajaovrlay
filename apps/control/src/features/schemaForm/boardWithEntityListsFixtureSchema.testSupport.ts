// Test support: a board's data schema with the two lists an item may read whole from
// Cadastros (BAJAOVRLAY-46), the sponsor roll's sponsors and the sessions board's slots,
// with a title beside them; and the library of the 30ª Competição they read. Written out
// here, as the manifests of packages/graphics/sponsor-roll and sessions-board declare the
// two lists, so a reader sees the schema the tests run against.
import type { EntityLibrary, ScheduleSlot, Sponsor, SponsorTier } from '@bajaovrlay/shared';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormDescription } from './schemaFormDescription';

/** The board's data schema: a title, the sponsors and the slots, each list optional. */
export function buildBoardWithEntityListsDataSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Título do quadro', gddType: 'single-line' },
      sponsors: {
        type: 'array',
        title: 'Patrocinadores',
        items: {
          type: 'object',
          required: ['name', 'level', 'logoUrl', 'logoOnLightPlate'],
        },
      },
      slots: {
        type: 'array',
        title: 'Sessões',
        items: { type: 'object', required: ['slotId', 'sessionName', 'startsAtMs'] },
      },
    },
    additionalProperties: false,
  };
}

/** The board's form description. */
export function describeBoardWithEntityListsForm(): SchemaFormDescription {
  return describeSchemaFormFromDataSchema(buildBoardWithEntityListsDataSchema());
}

/** A media id for a sponsor's logo, 64 hex digits as the media store names a file. */
function buildLogoMediaIdOfSponsor(positionInTheList: number): string {
  return positionInTheList.toString(16).padStart(2, '0').repeat(32);
}

/** The 30ª Competição's 17 sponsors by level, as the design's sample data lists them. */
const realSponsorNamesByLevel: Array<[SponsorTier, string[]]> = [
  ['diamante', ['Bosch', 'Renault']],
  ['ouro', ['Certi', 'CNH', 'Himix', 'Horse', 'Marcopolo', 'Rodonunes', 'Segula', 'TRP', 'Vetore']],
  ['apoio', ['Criciúma', 'Osaki', 'SAE4Mobility', 'SATC', 'Schulz']],
  ['realizacao', ['SAE Brasil']],
];

/** The 17 sponsors, each with its logo, and Pneus Trilha, whose logo is not uploaded yet. */
function buildSponsorsOfThe30thCompetition(): Sponsor[] {
  const sponsors: Sponsor[] = [];
  for (const [level, names] of realSponsorNamesByLevel) {
    for (const name of names) {
      sponsors.push({
        sponsorId: name.toLowerCase(),
        name,
        tier: level,
        rollWeight: 5,
        logoMediaId: buildLogoMediaIdOfSponsor(sponsors.length + 1),
      });
    }
  }
  sponsors.push({ sponsorId: 'pneus-trilha', name: 'Pneus Trilha', tier: 'apoio', rollWeight: 2 });
  return sponsors;
}

/** Sunday 30 March 2025 at a time of day in Brasília (UTC−3), in ms. */
function atSundayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2025-03-30T${hoursAndMinutes}:00.000-03:00`);
}

/** Sunday's six slots, as the design's sessions-board page shows them. */
function buildSundaySchedule(): ScheduleSlot[] {
  const slots: Array<[string, string, ScheduleSlot['sessionKind'], string]> = [
    ['abertura', 'Abertura do box', 'other', '07:30'],
    ['briefing', 'Briefing das equipes', 'other', '08:30'],
    ['alinhamento', 'Alinhamento do enduro', 'other', '09:15'],
    ['enduro', 'Enduro de Resistência', 'enduro', '10:00'],
    ['intervalo', 'Intervalo', 'other', '14:30'],
    ['premiacao', 'Cerimônia de premiação', 'other', '16:00'],
  ];
  return slots.map(([slotId, sessionName, sessionKind, startTime]) => ({
    slotId,
    sessionName,
    sessionKind,
    startsAtMs: atSundayBrasiliaTime(startTime),
  }));
}

/** The library of the 30ª Competição's Sunday: 18 sponsors (17 with a logo), six slots. */
export function buildLibraryOfThe30thCompetition(): EntityLibrary {
  return {
    teams: [],
    people: [],
    sponsors: buildSponsorsOfThe30thCompetition(),
    scheduleSlots: buildSundaySchedule(),
  };
}
