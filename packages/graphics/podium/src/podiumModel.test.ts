// @vitest-environment node
/**
 * The podium's data and rules (packages/graphics/podium)
 *
 * What this module is for:
 *   podiumModel.ts says which entry stands on which card, the place each card writes, which
 *   cards a step shows, and checks the data a renderer sends. The view and the lifecycle
 *   only follow these answers, so the podium's rules are all read here.
 *
 * What these tests prove:
 *   - The cards by list order: the first entry is the middle card, the second the left,
 *     the third the right; a list of two leaves the right card empty; a fourth entry is not
 *     drawn.
 *   - A tie: standings with two teams on rank 1 write "1º" on both cards, both on the green
 *     chip, the list still deciding who stands in the middle; the next team writes "3º".
 *   - The places: a position or a rank with "º", "—" for neither.
 *   - The logo row and the plate: only with a logo address; the plate only with the switch.
 *   - The reveal order: steps 1, 2, 3 bring the 3rd, the 2nd, the 1st; a play from off air
 *     straight to step 2 brings two; a step backwards brings none.
 *   - The step line: empty for the head alone, then "1/3" to "3/3".
 *   - The settings' defaults ("PÓDIO", no event line), the data checks (no entries, an empty
 *     list, a car number of 0 and a misspelt field are refused in pt-BR), and a partial
 *     update that keeps what it does not name and leaves the current data untouched.
 *
 * What these tests deliberately do not cover:
 *   - The DOM; podiumView.test.ts draws these answers.
 *   - The manifest's JSON Schema; podiumManifestDataAgreement.test.ts runs the same payloads
 *     through both.
 */
import { describe, expect, it } from 'vitest';

import {
  hasLogo,
  isLogoOnLightPlate,
  isPlaceOnTheLeaderChip,
  listPodiumCardsLeftToRight,
  listSlotsRevealedBetweenSteps,
  mergePartialUpdateIntoPodiumData,
  parseCompletePodiumData,
  type PodiumEntry,
  readPodiumSettings,
  writePlaceText,
  writeStepLine,
} from './podiumModel.js';
import { createEnduroPodium, createOverallPodiumWithATieForFirst } from './previewData.js';

/** The enduro's first three as a positions list, without logos. */
function createEnduroTopThree(): PodiumEntry[] {
  return createEnduroPodium(false).entries;
}

describe('which entry stands on which card', () => {
  it('puts the first entry in the middle, the second at the left and the third at the right', () => {
    // Arrange: the enduro's three, Sinuelo first.
    const entries = createEnduroTopThree();

    // Act: lay out the cards left to right.
    const cards = listPodiumCardsLeftToRight(entries);

    // Assert: Komiketo (car 10), Sinuelo (car 51), Pato Baja (car 47), with their slots.
    expect(
      cards.map((card) => [card.slot, card.entry?.carNumber]),
      'the podium stands 2nd, 1st, 3rd from left to right',
    ).toEqual([
      ['second', 10],
      ['first', 51],
      ['third', 47],
    ]);
  });

  it('leaves the right card empty for a list of two, and draws no fourth entry', () => {
    // Arrange: a session with only two cars classified, and the whole positions list.
    const twoCars = createEnduroTopThree().slice(0, 2);
    const fourCars: PodiumEntry[] = [
      ...createEnduroTopThree(),
      { position: 4, carNumber: 5, teamName: 'Poli Baja', schoolName: 'Poli' },
    ];

    // Act: lay out both.
    const cardsOfTwo = listPodiumCardsLeftToRight(twoCars);
    const cardsOfFour = listPodiumCardsLeftToRight(fourCars);

    // Assert: the 3rd card has no entry; the fourth car stands nowhere.
    expect(cardsOfTwo[2]?.entry, 'a list of two leaves the 3rd card empty').toBeUndefined();
    expect(
      cardsOfFour.map((card) => card.entry?.carNumber),
      'only the first three entries stand on the podium',
    ).toEqual([10, 51, 47]);
  });

  it('writes a shared rank on both cards of a tie, the list deciding who stands where', () => {
    // Arrange: the overall standings with Baja UFMG and Equipe FEI Baja tied on rank 1.
    const entries = createOverallPodiumWithATieForFirst().entries;

    // Act: lay out the cards and read what each writes.
    const cards = listPodiumCardsLeftToRight(entries);
    const placesWritten = cards.map((card) =>
      card.entry === undefined ? undefined : writePlaceText(card.entry),
    );
    const leaderChips = cards.map((card) =>
      card.entry === undefined ? undefined : isPlaceOnTheLeaderChip(card.entry),
    );

    // Assert: FEI at the left and UFMG in the middle both write "1º" on the green chip;
    // Komiketo at the right writes "3º", the place after a tie of two.
    expect(
      cards.map((card) => card.entry?.carNumber),
      'the list order decides the cards',
    ).toEqual([1, 2, 10]);
    expect(placesWritten, 'a tie shows the shared rank on both cards').toEqual(['1º', '1º', '3º']);
    expect(leaderChips, 'both teams tied for first sit on the green chip').toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe('what a card writes', () => {
  const placeScenarios = [
    // A positions list: the place is the position.
    { name: 'writes a position', entry: { position: 2 }, expected: '2º' },
    // A standings list: the place is the rank.
    { name: 'writes a rank', entry: { rank: 3 }, expected: '3º' },
    // A disqualified team in the standings has no rank: the mark for an unknown value.
    { name: 'writes a dash for an entry with neither', entry: {}, expected: '—' },
  ];

  it.each(placeScenarios)('$name', ({ entry, expected }) => {
    // Arrange: Pato Baja with the place of the row.
    const podiumEntry: PodiumEntry = {
      carNumber: 47,
      teamName: 'Pato Baja',
      schoolName: 'UTFPR-PB',
      ...entry,
    };

    // Act: write its place.
    const placeText = writePlaceText(podiumEntry);

    // Assert: the expected text.
    expect(placeText, 'the card must write the place as given').toBe(expected);
  });

  it('draws the logo row only with a logo address, and the plate only with its switch', () => {
    // Arrange: Sinuelo with no logo, with its logo on the panel, Komiketo on the plate,
    // and a plate switch left on for a team whose logo is gone.
    const withoutLogo = createEnduroTopThree()[0];
    const enduroWithLogos = createEnduroPodium(true).entries;
    const onThePanel = enduroWithLogos[0];
    const onThePlate = enduroWithLogos[1];
    const plateWithoutLogo: PodiumEntry = {
      carNumber: 7,
      teamName: 'Reptiles Baja PUC-Rio',
      schoolName: 'PUC-Rio',
      logoOnLightPlate: true,
    };
    if (withoutLogo === undefined || onThePanel === undefined || onThePlate === undefined) {
      throw new Error('the samples must hold three entries');
    }

    // Act: ask each about its logo row and its plate.
    const answers = [withoutLogo, onThePanel, onThePlate, plateWithoutLogo].map((entry) => [
      hasLogo(entry),
      isLogoOnLightPlate(entry),
    ]);

    // Assert: no logo, no row; the plate only where a logo sits on it.
    expect(answers, 'the logo row needs a logo, the plate needs a logo and its switch').toEqual([
      [false, false],
      [true, false],
      [true, true],
      [false, false],
    ]);
  });
});

describe('the steps', () => {
  const revealScenarios = [
    // Entrar: the head alone.
    { name: 'brings no card when the head enters', fromStep: -1, toStep: 0, expected: [] },
    // The first Próximo: the 3rd place.
    { name: 'brings the 3rd at step 1', fromStep: 0, toStep: 1, expected: ['third'] },
    // The second Próximo: the 2nd place.
    { name: 'brings the 2nd at step 2', fromStep: 1, toStep: 2, expected: ['second'] },
    // The last Próximo: the winner.
    { name: 'brings the 1st at step 3', fromStep: 2, toStep: 3, expected: ['first'] },
    // A play from off air straight to step 2 (a goto) brings both, in their order.
    {
      name: 'brings the 3rd and the 2nd on a jump from off air to step 2',
      fromStep: -1,
      toStep: 2,
      expected: ['third', 'second'],
    },
    // A goto backwards reveals nothing (the lifecycle hides the cards past it).
    { name: 'brings nothing on a step backwards', fromStep: 3, toStep: 1, expected: [] },
  ];

  it.each(revealScenarios)('$name', ({ fromStep, toStep, expected }) => {
    // Arrange: nothing to set up; the steps are fixed.

    // Act: list the slots revealed between the two steps.
    const slots = listSlotsRevealedBetweenSteps(fromStep, toStep);

    // Assert: the expected slots, in the order they come up.
    expect(slots, 'the podium reveals 3rd, 2nd, 1st, one per step').toEqual(expected);
  });

  it('writes no step line for the head alone, then 1/3, 2/3 and 3/3', () => {
    // Arrange: the four steps on air.
    const steps = [0, 1, 2, 3];

    // Act: write the head's line at each.
    const stepLines = steps.map((step) => writeStepLine(step));

    // Assert: empty, then how many of the three are shown.
    expect(stepLines, 'the head counts the places shown').toEqual(['', '1/3', '2/3', '3/3']);
  });
});

describe('the data', () => {
  it('defaults the title to PÓDIO and the event line to none', () => {
    // Arrange: the entries alone, as an item that types nothing else.
    const data = { entries: createEnduroTopThree() };

    // Act: read the settings.
    const settings = readPodiumSettings(data);

    // Assert: the manifest's defaults.
    expect(settings, 'the head defaults to "PÓDIO" with no event line').toEqual({
      title: 'PÓDIO',
      eventLine: '',
    });
  });

  const refusedDataScenarios = [
    // The one required field left out.
    {
      name: 'refuses data without entries',
      data: { title: 'PÓDIO' },
      problem: 'Falta o campo obrigatório "entries".',
    },
    // A podium of nobody cannot be drawn.
    {
      name: 'refuses an empty list',
      data: { entries: [] },
      problem: 'Valor inválido no campo "entries".',
    },
    // Car numbers start at 1.
    {
      name: 'refuses a car number of 0',
      data: { entries: [{ position: 1, carNumber: 0, teamName: 'Sinuelo', schoolName: 'FAHOR' }] },
      problem: 'Valor inválido no campo "entries[0].carNumber".',
    },
    // A misspelt field must not be ignored.
    {
      name: 'refuses a field the podium does not know',
      data: { entries: createEnduroTopThree(), titulo: 'PÓDIO' },
      problem: 'Campo desconhecido nos dados: "titulo".',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, problem }) => {
    // Arrange: nothing beyond the row's data.

    // Act: check it as load does.
    const dataCheck = parseCompletePodiumData(data);

    // Assert: refused, with the pt-BR sentence naming the field.
    expect(dataCheck, 'bad data must be refused in pt-BR').toEqual({ isValid: false, problem });
  });

  it('merges a partial update, keeping what it does not name and the current data untouched', () => {
    // Arrange: the enduro's podium loaded.
    const currentData = createEnduroPodium(false);

    // Act: an update that changes the title only.
    const dataCheck = mergePartialUpdateIntoPodiumData(currentData, { title: 'PÓDIO · ENDURO' });

    // Assert: the new title, the same entries and event line; the current data unchanged.
    expect(dataCheck, 'the update must merge into the current data').toEqual({
      isValid: true,
      data: { ...currentData, title: 'PÓDIO · ENDURO' },
    });
    expect(currentData.title, 'the current data must not be modified').toBe('PÓDIO');
  });
});
