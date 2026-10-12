/**
 * Which graphic "Edição rápida" shows (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" has one form at a time, for one graphic. Until the operator chooses,
 *   the panel chooses for them: the graphic most recently taken on the program output,
 *   because that is the one most likely to need a quick change; with nothing on air, the
 *   first graphic the server lists. Once the operator has chosen (or started typing), the
 *   panel stays on that graphic whatever goes on air afterwards.
 *
 * What these tests prove:
 *   - With no graphics registered there is nothing to show.
 *   - With nothing on air the first graphic of the slice is shown.
 *   - The graphic taken most recently on program is shown, whichever comes first in
 *     either slice; two taken at the same moment give the later one in the instances slice.
 *   - An instance on the preview output, and an instance of a graphic the server no
 *     longer lists, do not decide.
 *   - A graphic the panel was told to stay on wins over everything on air; if the server
 *     no longer lists it, the panel goes back to choosing by itself.
 *   - A graphic the panel went to by itself is kept when it leaves the air, whether an
 *     earlier take is still on air or nothing is; only a take later than the one the
 *     panel followed moves it, or that graphic no longer being listed.
 *   - The take the panel has to remember for that is the latest one on program, and the
 *     one it already remembered while nothing later is on air.
 *
 * What these tests deliberately do not cover:
 *   - The dropdown and the moment the panel starts "staying"; QuickEditPanelChoosingTheGraphic.test.tsx.
 *   - Which instance of the shown graphic is followed; instanceOfGraphicToFollow.test.ts.
 */
import type { Graphic, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildLowerThirdFixtureGraphic,
  buildLowerThirdFixtureInstanceOnProgram,
} from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildRaceClockGraphic,
  buildRaceClockInstanceOnTheClockLayer,
} from '@/state/slicesLikeTheServerSends.testSupport';

import {
  chooseGraphicForQuickEdit,
  findTakeForQuickEditToFollow,
  type TakeFollowedByQuickEdit,
} from './graphicForQuickEdit';

const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';
const quarterPastTen = '2026-10-10T13:15:00.000Z';

/** What the panel remembers after it went to the lower third taken at 10:00. */
const takeOfTheLowerThirdAtTenOClock: TakeFollowedByQuickEdit = {
  graphicId: 'lower-third-fixture',
  takenAt: tenOClock,
};

/** The two graphics of these tests, the race clock first, as the server lists them. */
function buildRaceClockAndLowerThirdGraphics(): Graphic[] {
  return [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()];
}

/** Ana Souza's lower third on the "Tarja" layer of the program output since `takenAt`. */
function buildLowerThirdInstanceTakenAt(takenAt: string): Instance {
  return buildLowerThirdFixtureInstanceOnProgram({
    id: 'tarja-da-ana-souza',
    layerId: 'lower-third',
    resolvedData: { nome: 'Ana Souza', equipe: 'baja-ufpr' },
    takenAt,
  });
}

const chooseScenarios: Array<{
  name: string;
  graphics: Graphic[];
  instances: Instance[];
  graphicIdThePanelStaysOn: string | undefined;
  takeThePanelLastFollowed: TakeFollowedByQuickEdit | undefined;
  expectedGraphicId: string | undefined;
}> = [
  // No package was built yet: the panel has no form to draw and must say so.
  {
    name: 'shows nothing when the server lists no graphic',
    graphics: [],
    instances: [],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: undefined,
  },
  // The page opens before the show: the first graphic is as good a guess as any.
  {
    name: 'shows the first graphic of the slice when nothing is on air',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'race-clock',
  },
  // The lower third went on air after the clock: it is the one to correct quickly.
  {
    name: 'shows the graphic taken most recently on the program output',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
      buildLowerThirdInstanceTakenAt(tenOClock),
    ],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'lower-third-fixture',
  },
  // The same two takes with the slice the other way round: the moment decides, not the order.
  {
    name: 'shows the graphic taken most recently when it comes first in the instances slice',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [
      buildLowerThirdInstanceTakenAt(tenOClock),
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
    ],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'lower-third-fixture',
  },
  // Taken together (it cannot really happen): one fixed answer, the later in the slice.
  {
    name: 'shows the later one in the instances slice when two graphics were taken at the same moment',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [
      buildLowerThirdInstanceTakenAt(tenOClock),
      buildRaceClockInstanceOnTheClockLayer(tenOClock),
    ],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'race-clock',
  },
  // The preview output is not on air, so a later take there must not move the panel.
  {
    name: 'ignores a later take on the preview output',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
      { ...buildLowerThirdInstanceTakenAt(tenOClock), target: 'preview' },
    ],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'race-clock',
  },
  // A package removed while its graphic is still on air: there is no manifest to build
  // a form from, so the panel falls back to the first graphic it can show.
  {
    name: 'ignores an instance whose graphic the server no longer lists',
    graphics: [buildRaceClockGraphic()],
    instances: [buildLowerThirdInstanceTakenAt(tenOClock)],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'race-clock',
  },
  // The operator chose the clock: a lower third fired from the rundown afterwards must
  // not pull the form away from under their hands.
  {
    name: 'stays on the graphic it was told to stay on, whatever was taken later',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
      buildLowerThirdInstanceTakenAt(tenOClock),
    ],
    graphicIdThePanelStaysOn: 'race-clock',
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'race-clock',
  },
  // The chosen graphic's package was removed: staying on it would leave no form at all.
  {
    name: 'goes back to choosing by itself when the graphic it stayed on is no longer listed',
    graphics: [buildRaceClockGraphic()],
    instances: [],
    graphicIdThePanelStaysOn: 'lower-third-fixture',
    takeThePanelLastFollowed: undefined,
    expectedGraphicId: 'race-clock',
  },
  // The lower third the panel went to was cleared (or timed out) and the clock taken
  // before it is still on air. The operator may want to put the lower third back, so
  // its form must not be swapped for the clock's.
  {
    name: 'stays on the graphic it followed when that one leaves the air and an earlier take is still on air',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [buildRaceClockInstanceOnTheClockLayer(quarterToTen)],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedGraphicId: 'lower-third-fixture',
  },
  // "Limpar tudo" emptied the program output: the panel must not jump to the first
  // graphic listed, as it does when the page opens before the show.
  {
    name: 'stays on the graphic it followed when nothing is left on air',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedGraphicId: 'lower-third-fixture',
  },
  // A new take is still what moves an untouched panel: the clock fired at 10:15 is
  // later than the lower third the panel followed.
  {
    name: 'moves to a graphic taken later than the take it followed',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [buildRaceClockInstanceOnTheClockLayer(quarterPastTen)],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedGraphicId: 'race-clock',
  },
  // The followed graphic's package was removed: there is no manifest to draw its form.
  {
    name: 'goes back to what is on air when the graphic it followed is no longer listed',
    graphics: [buildRaceClockGraphic()],
    instances: [buildRaceClockInstanceOnTheClockLayer(quarterToTen)],
    graphicIdThePanelStaysOn: undefined,
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedGraphicId: 'race-clock',
  },
  // The operator's own choice still wins over the take the panel followed by itself.
  {
    name: 'stays on the graphic it was told to stay on, not on the one it followed before',
    graphics: buildRaceClockAndLowerThirdGraphics(),
    instances: [],
    graphicIdThePanelStaysOn: 'race-clock',
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedGraphicId: 'race-clock',
  },
];

describe('chooseGraphicForQuickEdit', () => {
  it.each(chooseScenarios)(
    '$name',
    ({
      graphics,
      instances,
      graphicIdThePanelStaysOn,
      takeThePanelLastFollowed,
      expectedGraphicId,
    }) => {
      // Arrange: the graphics and instances of this row are what the server sent, and
      // the take of this row is what the panel remembers having followed.

      // Act: ask which graphic the panel shows.
      const graphicShown = chooseGraphicForQuickEdit({
        graphics,
        instances,
        graphicIdThePanelStaysOn,
        takeThePanelLastFollowed,
      });

      // Assert: the graphic of this row.
      expect(
        graphicShown?.id,
        'the panel must show the graphic it stays on, else the latest take it followed, else the first listed',
      ).toBe(expectedGraphicId);
    },
  );
});

const takeToFollowScenarios: Array<{
  name: string;
  instances: Instance[];
  takeThePanelLastFollowed: TakeFollowedByQuickEdit | undefined;
  expectedTakeToFollow: TakeFollowedByQuickEdit | undefined;
}> = [
  // The page opens before the show: there is no take to remember yet.
  {
    name: 'follows no take while nothing is on air and nothing was followed before',
    instances: [],
    takeThePanelLastFollowed: undefined,
    expectedTakeToFollow: undefined,
  },
  // The first thing the panel sees on air is what it remembers.
  {
    name: 'follows the latest take on the program output',
    instances: [
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
      buildLowerThirdInstanceTakenAt(tenOClock),
    ],
    takeThePanelLastFollowed: undefined,
    expectedTakeToFollow: takeOfTheLowerThirdAtTenOClock,
  },
  // The lower third left the air: the clock's 9:45 take is older than the one the
  // panel remembers, so it is not news.
  {
    name: 'keeps the take it followed while only earlier takes are on air',
    instances: [buildRaceClockInstanceOnTheClockLayer(quarterToTen)],
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedTakeToFollow: takeOfTheLowerThirdAtTenOClock,
  },
  // The clock fired again at 10:15 is news, and becomes what the panel remembers.
  {
    name: 'follows a take later than the one it followed before',
    instances: [buildRaceClockInstanceOnTheClockLayer(quarterPastTen)],
    takeThePanelLastFollowed: takeOfTheLowerThirdAtTenOClock,
    expectedTakeToFollow: { graphicId: 'race-clock', takenAt: quarterPastTen },
  },
];

describe('findTakeForQuickEditToFollow', () => {
  it.each(takeToFollowScenarios)(
    '$name',
    ({ instances, takeThePanelLastFollowed, expectedTakeToFollow }) => {
      // Arrange: the server lists the race clock and the lower third, and has the
      // instances of this row on air.
      const graphics = buildRaceClockAndLowerThirdGraphics();

      // Act: ask which take the panel follows from now on.
      const takeToFollow = findTakeForQuickEditToFollow({
        graphics,
        instances,
        takeThePanelLastFollowed,
      });

      // Assert: the take of this row.
      expect(
        takeToFollow,
        'the panel must remember the latest take it has seen on program, also after that graphic left the air',
      ).toEqual(expectedTakeToFollow);
    },
  );
});
