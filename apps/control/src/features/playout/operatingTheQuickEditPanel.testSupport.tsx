// Test support: "Edição rápida" drawn on a page connected to a fake server that lists two
// graphics (the real race clock and the lower third fixture), next to the "Camadas" panel
// whose rows' "Editar" load an instance into it, the few things an operator
// does to the panel, and the three things the server does back. What the server does to
// the data itself is in graphicDataAsTheServerPreparesIt.testSupport.ts. Written once so
// the panel's test files read the same. Nothing here keeps state between calls.
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { Graphic, Instance } from '@bajaovrlay/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { z } from 'zod';

import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildRaceClockGraphic,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import {
  prepareDataOfTakeAsTheServerDoes,
  prepareDataOfUpdateAsTheServerDoes,
} from './graphicDataAsTheServerPreparesIt.testSupport';
import { QuickEditPanel } from './QuickEditPanel';

type FakeServer = ControlPageOnFakeServer['fakeServer'];

/** The id the server gave the race clock instance the panel tests put on air. */
export const idOfTheRaceClockInstanceOnAir = 'c41f7e9a-63d2-4b1c-8a0f-5e2d9b7a3c66';

// The titles the race clock's manifest gives three of its fields, read from the manifest
// so the tests follow it if the wording changes.
export const referenceTimeLabel = raceClockManifest.schema.properties.referenceTimeMs.title;
export const referenceMomentLabel = raceClockManifest.schema.properties.referenceWallClockMs.title;
export const lapsLabel = raceClockManifest.schema.properties.lapsCompletedByLeader.title;
/** The accessible name of the small dropdown that says who fills the reference moment. */
export const referenceMomentKindSelectorName = `Como preencher ${referenceMomentLabel}`;

// What the fake server needs from a take it received.
const TakeCommandReceivedSchema = z.object({
  type: z.literal('takeGraphic'),
  graphicId: z.string(),
  layerId: z.string(),
  data: z.record(z.string(), z.unknown()),
  takeTimeFieldKeys: z.array(z.string()),
});

// What the fake server needs from an update it received.
const UpdateCommandReceivedSchema = z.object({
  type: z.literal('updateInstanceData'),
  data: z.record(z.string(), z.unknown()),
  takeTimeFieldKeys: z.array(z.string()),
});

/**
 * Draws "Edição rápida" and the "Camadas" panel on a connected page. The server lists the
 * race clock first and the lower third second, and has these instances on air (or in
 * preview). Nothing is loaded into the panel until a test presses a row's "Editar".
 */
export function renderQuickEditPanelWithTheseInstancesOnAir(
  instancesOnAir: Instance[],
): ControlPageOnFakeServer {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <QuickEditPanel />
      <LayerStatusPanel />
    </>,
    {
      ...buildSlicesWithNothingOnAir(),
      graphics: buildGraphicsTheFakeServerLists(),
      instances: instancesOnAir,
    },
  );
}

/**
 * Presses "Editar" on the "Camadas" row of this layer, which loads the instance on air
 * there into "Edição rápida", as the operator does before changing it in place.
 */
export function pressEditOnTheLayerRow(layerName: string): void {
  const layerRow = within(screen.getByRole('listitem', { name: layerName }));
  fireEvent.click(layerRow.getByRole('button', { name: 'Editar' }));
}

/** Presses "Editar prévia" on the "Camadas" row of this layer: loads its preview instead. */
export function pressEditPreviewOnTheLayerRow(layerName: string): void {
  const layerRow = within(screen.getByRole('listitem', { name: layerName }));
  fireEvent.click(layerRow.getByRole('button', { name: 'Editar prévia' }));
}

/**
 * The line at the top of "Edição rápida" that says what a press changes: the panel's one
 * heading under its title ("Nova entrada — …" or "Editando: …").
 */
export function readQuickEditHeader(): string | null {
  return screen.getByRole('heading', { level: 3 }).textContent;
}

/**
 * Makes the page's clock read this moment and stand still there, so the time field of a
 * clock on air shows a time the test can name. Only the clock is held: timers go on in
 * real time, so the waits of the helpers below work as usual, and the panel's
 * once-a-second redraw finds the same moment every time. A test that must see a second
 * pass uses `vi.useFakeTimers()` itself and moves time by hand. testSetup.ts gives the
 * next test a real clock again.
 */
export function holdThePageClockAt(momentAsIsoText: string): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(momentAsIsoText));
}

/**
 * Makes all time on the page stand still at this moment until the test moves it
 * (`vi.useFakeTimers()`): the clock and every timer. For tests that must see a second
 * pass: "a second later" then takes no real time and is exactly a second. The helpers
 * below that wait (`pressButtonAndWaitForCommand` and the like) cannot be used with it;
 * use letTimePassAndThePageSettle instead.
 */
export function holdAllTimeOnThePageAt(momentAsIsoText: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(momentAsIsoText));
}

/**
 * Moves the page's clock forward and lets the page finish what it started (drawing
 * again, checking a form, sending a command). Zero milliseconds means "just let it
 * finish". Only after holdAllTimeOnThePageAt().
 */
export async function letTimePassAndThePageSettle(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

/** Presses a button and waits until the fake server holds that many commands. */
export async function pressButtonAndWaitForCommand(
  buttonName: string,
  commandsExpectedByThen: number,
  fakeServer: FakeServer,
): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitFor(() => {
    expect(
      fakeServer.listCommandsReceived(),
      `pressing "${buttonName}" must send a command`,
    ).toHaveLength(commandsExpectedByThen);
  });
}

/**
 * Presses a button and waits until the panel has finished with the press. Its buttons
 * are off while a press is being checked and sent, so "the button is on again" is how a
 * test knows the press is over, also when it sent nothing.
 */
export async function pressButtonAndWaitUntilThePressIsOver(buttonName: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitUntilButtonIsOnAgain(buttonName);
}

/** Waits until a button can be pressed again, which is how a press says it is over. */
export async function waitUntilButtonIsOnAgain(buttonName: string): Promise<void> {
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: buttonName }),
      `"${buttonName}" must come back on once the press was dealt with`,
    ).toBeEnabled();
  });
}

/** A race clock instance on the clock layer of the program output, holding this data. */
export function buildRaceClockInstanceHoldingThisData(
  raceClockData: Record<string, unknown>,
  takenAt: string,
): Instance {
  return {
    id: idOfTheRaceClockInstanceOnAir,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: raceClockData,
    currentStep: 0,
    status: 'on-air',
    takenAt,
  };
}

/** The two graphics the fake server lists, in the order the panel's page receives them. */
function buildGraphicsTheFakeServerLists(): Graphic[] {
  return [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()];
}

/** Finds one of the fake server's graphics by its id; a test naming another one is wrong. */
function findGraphicTheFakeServerLists(graphicId: string): Graphic {
  const graphic = buildGraphicsTheFakeServerLists().find(
    (graphicListed) => graphicListed.id === graphicId,
  );
  if (graphic === undefined) {
    throw new Error(`the fake server lists no graphic "${graphicId}"`);
  }
  return graphic;
}

/**
 * The fake server does what the real one does with a take: it prepares the data of the
 * newest command as the real one does (graphicDataAsTheServerPreparesIt.testSupport.ts)
 * and refuses, in the real server's words, a take that asks for a stamp in a field the
 * graphic's schema does not mark as a moment. Otherwise it puts the data on the layer the
 * command names, tells the page so, and only then answers "ok". The real server sends in
 * that same order (webSocketHub.ts), which is why the page may read the new instance as
 * soon as it hears "ok".
 */
export function letTheServerPutTheLastTakeOnAir(
  fakeServer: FakeServer,
  idOfTheNewInstance: string,
  takenAt: string,
): void {
  const takeCommand = TakeCommandReceivedSchema.parse(fakeServer.listCommandsReceived().at(-1));
  const outcome = prepareDataOfTakeAsTheServerDoes(
    findGraphicTheFakeServerLists(takeCommand.graphicId),
    {
      data: takeCommand.data,
      takeTimeFieldKeys: takeCommand.takeTimeFieldKeys,
      momentOfTheCommand: takenAt,
    },
  );
  if (!outcome.wasAccepted) {
    fakeServer.refuseLastCommand(outcome.refusal);
    return;
  }
  const instanceTheTakeCreates: Instance = {
    id: idOfTheNewInstance,
    layerId: takeCommand.layerId,
    graphicId: takeCommand.graphicId,
    target: 'program',
    resolvedData: outcome.dataLeftOnAir,
    currentStep: 0,
    status: 'on-air',
    takenAt,
  };

  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [instanceTheTakeCreates] });
  fakeServer.acceptLastCommand();
}

/**
 * The fake server does what the real one does with an update: it prepares the data as
 * the real one does (graphicDataAsTheServerPreparesIt.testSupport.ts), which for the
 * race clock includes carrying the clock forward, so a stopped or corrected clock does
 * not jump. It refuses, in the real server's words, a stamp in a field that is not a
 * moment. Otherwise it keeps the instance's id and the moment it was taken, tells the
 * page what is now on air, and only then answers "ok".
 */
export function letTheServerApplyTheLastUpdate(
  fakeServer: FakeServer,
  instanceBeforeTheUpdate: Instance,
  momentOfTheUpdate: string,
): void {
  const updateCommand = UpdateCommandReceivedSchema.parse(fakeServer.listCommandsReceived().at(-1));
  const outcome = prepareDataOfUpdateAsTheServerDoes(
    findGraphicTheFakeServerLists(instanceBeforeTheUpdate.graphicId),
    instanceBeforeTheUpdate.resolvedData,
    {
      data: updateCommand.data,
      takeTimeFieldKeys: updateCommand.takeTimeFieldKeys,
      momentOfTheCommand: momentOfTheUpdate,
    },
  );
  if (!outcome.wasAccepted) {
    fakeServer.refuseLastCommand(outcome.refusal);
    return;
  }
  const instanceAfterTheUpdate: Instance = {
    ...instanceBeforeTheUpdate,
    resolvedData: outcome.dataLeftOnAir,
  };

  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [instanceAfterTheUpdate] });
  fakeServer.acceptLastCommand();
}

/**
 * The fake server does what the real one does with an update whose result lacks a
 * required field of the race clock: it prepares the data the update would leave on air,
 * looks for the first field the manifest requires that is still not there, and refuses
 * in the real server's words, changing nothing on air. The real server checks the whole
 * result, not only the fields sent (updateInstanceData.ts).
 */
export function letTheServerRefuseTheLastUpdateForARequiredFieldMissingOnAir(
  fakeServer: FakeServer,
  raceClockInstanceBeforeTheUpdate: Instance,
): void {
  const updateCommand = UpdateCommandReceivedSchema.parse(fakeServer.listCommandsReceived().at(-1));
  const outcome = prepareDataOfUpdateAsTheServerDoes(
    findGraphicTheFakeServerLists(raceClockInstanceBeforeTheUpdate.graphicId),
    raceClockInstanceBeforeTheUpdate.resolvedData,
    {
      data: updateCommand.data,
      takeTimeFieldKeys: updateCommand.takeTimeFieldKeys,
      momentOfTheCommand: raceClockInstanceBeforeTheUpdate.takenAt,
    },
  );
  if (!outcome.wasAccepted) {
    throw new Error('this helper is for an update refused for a missing field, not for a stamp');
  }
  const dataTheUpdateWouldLeaveOnAir = outcome.dataLeftOnAir;
  const firstRequiredFieldStillMissing = raceClockManifest.schema.required.find(
    (requiredFieldKey) => !(requiredFieldKey in dataTheUpdateWouldLeaveOnAir),
  );
  expect(
    firstRequiredFieldStillMissing,
    'this helper is for an update the real server refuses: a required field must be missing',
  ).toBeDefined();

  fakeServer.refuseLastCommand({
    code: 'INVALID_GRAPHIC_DATA',
    message: `Dados inválidos para o gráfico "race-clock": o campo "${firstRequiredFieldStillMissing}" é obrigatório e não foi enviado.`,
  });
}
