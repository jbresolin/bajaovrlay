/**
 * Reading an entity list against the library (packages/shared)
 *
 * What this module is for:
 *   An item field of kind `entityList` (BAJAOVRLAY-46) becomes, at the take and at every
 *   edit of Cadastros, a plain list the graphic draws: every sponsor, or every slot of the
 *   schedule, each as a small object with the keys entityListItems.ts lists by hand, in a
 *   fixed order. The server and the item editor ("Valor agora") read it with this one
 *   function, so they cannot disagree.
 *
 * What these tests prove:
 *   - Sponsors come in round order (Diamante … Realização last), then by roll weight from
 *     high to low, then by name, whatever the order Cadastros holds them in; each carries
 *     its name, level, logo as a /media URL, plate choice (false when it says nothing)
 *     and weight, and nothing else.
 *   - A sponsor without a logo is left out of the list: a roll cannot draw it.
 *   - Schedule slots come by start, each with its id, session, kind and start, and its end
 *     and place only when it has them. Its status is not in the list: the graphic works
 *     it out from the clock.
 *   - An empty list (no sponsor with a logo, no slot) is "value absent" with a pt-BR
 *     sentence, so the take leaves an optional field out and refuses a required one.
 *
 * What these tests deliberately do not cover:
 *   - The take's refusal and the live refresh; the server's resolveItemFieldsWithEntityLists
 *     and liveRefreshEntityLists tests.
 *   - Which fields a list fits; entityListFitsGraphicField.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { buildFakeMediaId } from '../media/fakeMediaIds.testSupport.js';
import type { EntityLibrary } from './entityLibrary.js';
import { resolveEntityListAgainstLibrary } from './entityListResolution.js';
import type { Sponsor } from './sponsor.js';

/** The media id of each logo below: a SHA-256, as the media store names a file. */
const logoMediaIds = {
  bosch: buildFakeMediaId(8),
  renault: buildFakeMediaId(13),
  certi: buildFakeMediaId(10),
  cnh: buildFakeMediaId(14),
  vetore: buildFakeMediaId(15),
  sae: buildFakeMediaId(9),
};

/**
 * Six sponsors of the 30ª Competição as Cadastros might hold them, out of order: the
 * organiser first, two Ouro of different weights, the two Diamante of equal weight, Vetore
 * (whose light logo goes straight on the panel) and Criciúma, whose logo is not uploaded.
 */
function buildSponsorsOutOfOrder(): Sponsor[] {
  return [
    {
      sponsorId: 'sae',
      name: 'SAE Brasil',
      tier: 'realizacao',
      rollWeight: 5,
      logoMediaId: logoMediaIds.sae,
      logoOnLightPlate: true,
    },
    {
      sponsorId: 'certi',
      name: 'Certi',
      tier: 'ouro',
      rollWeight: 4,
      logoMediaId: logoMediaIds.certi,
      logoOnLightPlate: true,
    },
    {
      sponsorId: 'renault',
      name: 'Renault',
      tier: 'diamante',
      rollWeight: 10,
      logoMediaId: logoMediaIds.renault,
      logoOnLightPlate: true,
    },
    { sponsorId: 'criciuma', name: 'Criciúma', tier: 'apoio', rollWeight: 2 },
    {
      sponsorId: 'vetore',
      name: 'Vetore',
      tier: 'ouro',
      rollWeight: 4,
      logoMediaId: logoMediaIds.vetore,
    },
    {
      sponsorId: 'cnh',
      name: 'CNH',
      tier: 'ouro',
      rollWeight: 8,
      logoMediaId: logoMediaIds.cnh,
      logoOnLightPlate: true,
    },
    {
      sponsorId: 'bosch',
      name: 'Bosch',
      tier: 'diamante',
      rollWeight: 10,
      logoMediaId: logoMediaIds.bosch,
      logoOnLightPlate: true,
    },
  ];
}

/** Sunday 30 March 2025 at a time of day in Brasília (UTC−3), in ms. */
function atSundayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2025-03-30T${hoursAndMinutes}:00.000-03:00`);
}

/** A library holding only these sponsors and slots. */
function buildLibraryWith(parts: Partial<EntityLibrary>): EntityLibrary {
  return { teams: [], people: [], sponsors: [], scheduleSlots: [], ...parts };
}

describe('resolveEntityListAgainstLibrary of the sponsors', () => {
  it('gives the sponsors in round order, then by weight from high to low, then by name', () => {
    // Arrange: the sponsors out of order.
    const library = buildLibraryWith({ sponsors: buildSponsorsOutOfOrder() });

    // Act: read every sponsor.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: 'sponsor' },
      library,
    );

    // Assert: Bosch and Renault (Diamante, equal weight, by name), CNH (Ouro, 8), Certi and
    // Vetore (Ouro, 4, by name), and SAE Brasil last; Criciúma, with no logo, left out.
    const names =
      resolution.status === 'resolved'
        ? resolution.value.map((sponsor) => (sponsor as { name: string }).name)
        : [];
    expect(names, 'the round order, then the weight, then the name').toEqual([
      'Bosch',
      'Renault',
      'CNH',
      'Certi',
      'Vetore',
      'SAE Brasil',
    ]);
  });

  it('gives each sponsor its name, level, logo URL, plate and weight, and nothing else', () => {
    // Arrange: Bosch, on the plate, and Vetore, which says nothing about the plate.
    const [, , , , vetore, , bosch] = buildSponsorsOutOfOrder();
    const library = buildLibraryWith({ sponsors: [vetore as Sponsor, bosch as Sponsor] });

    // Act: read every sponsor.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: 'sponsor' },
      library,
    );

    // Assert: the hand-written keys; Vetore's plate reads as no.
    expect(resolution, 'each sponsor as the graphic draws it').toEqual({
      status: 'resolved',
      value: [
        {
          name: 'Bosch',
          level: 'diamante',
          logoUrl: `/media/${logoMediaIds.bosch}`,
          logoOnLightPlate: true,
          rollWeight: 10,
        },
        {
          name: 'Vetore',
          level: 'ouro',
          logoUrl: `/media/${logoMediaIds.vetore}`,
          logoOnLightPlate: false,
          rollWeight: 4,
        },
      ],
    });
  });

  it('leaves out a sponsor without a logo', () => {
    // Arrange: Criciúma, imported from CSV, its logo not uploaded yet, beside Bosch.
    const sponsors = buildSponsorsOutOfOrder().filter(
      (sponsor) => sponsor.sponsorId === 'criciuma' || sponsor.sponsorId === 'bosch',
    );
    const library = buildLibraryWith({ sponsors });

    // Act: read every sponsor.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: 'sponsor' },
      library,
    );

    // Assert: Bosch alone.
    const names =
      resolution.status === 'resolved'
        ? resolution.value.map((sponsor) => (sponsor as { name: string }).name)
        : [];
    expect(names, 'a roll cannot draw a sponsor without its logo').toEqual(['Bosch']);
  });

  it('says the list is empty, in pt-BR, when no sponsor has a logo', () => {
    // Arrange: only Criciúma, with no logo.
    const sponsors = buildSponsorsOutOfOrder().filter(
      (sponsor) => sponsor.sponsorId === 'criciuma',
    );
    const library = buildLibraryWith({ sponsors });

    // Act: read every sponsor.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: 'sponsor' },
      library,
    );

    // Assert: value absent, so an optional field is left out and a required one refused.
    expect(resolution, 'an empty list is a value absent, with its reason').toEqual({
      status: 'valueAbsent',
      problem: 'nenhum patrocinador com logo nos cadastros.',
    });
  });
});

describe('resolveEntityListAgainstLibrary of the schedule', () => {
  it('gives the slots by start, the end and place only when they have them', () => {
    // Arrange: the enduro (with an end and a place) listed before the briefing (neither).
    const library = buildLibraryWith({
      scheduleSlots: [
        {
          slotId: 'enduro',
          sessionName: 'Enduro de Resistência',
          sessionKind: 'enduro',
          startsAtMs: atSundayBrasiliaTime('10:00'),
          endsAtMs: atSundayBrasiliaTime('14:00'),
          place: 'Pista principal',
        },
        {
          slotId: 'briefing',
          sessionName: 'Briefing das equipes',
          sessionKind: 'other',
          startsAtMs: atSundayBrasiliaTime('08:30'),
        },
      ],
    });

    // Act: read every slot.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: 'scheduleSlot' },
      library,
    );

    // Assert: the briefing first; no status anywhere, and no key for what a slot lacks.
    expect(resolution, 'the schedule by start, as the graphic draws it').toEqual({
      status: 'resolved',
      value: [
        {
          slotId: 'briefing',
          sessionName: 'Briefing das equipes',
          sessionKind: 'other',
          startsAtMs: atSundayBrasiliaTime('08:30'),
        },
        {
          slotId: 'enduro',
          sessionName: 'Enduro de Resistência',
          sessionKind: 'enduro',
          startsAtMs: atSundayBrasiliaTime('10:00'),
          endsAtMs: atSundayBrasiliaTime('14:00'),
          place: 'Pista principal',
        },
      ],
    });
  });

  it('says the list is empty, in pt-BR, when the schedule has no slot', () => {
    // Arrange: a library with no schedule yet.
    const library = buildLibraryWith({});

    // Act: read every slot.
    const resolution = resolveEntityListAgainstLibrary(
      { kind: 'entityList', entityType: 'scheduleSlot' },
      library,
    );

    // Assert: value absent, with its reason.
    expect(resolution, 'an empty schedule is a value absent').toEqual({
      status: 'valueAbsent',
      problem: 'nenhuma sessão na programação dos cadastros.',
    });
  });
});
