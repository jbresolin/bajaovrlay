// Test support: "Edição rápida" drawn on a page connected to a fake server that lists two
// graphics (the real race clock and the lower third fixture), the few things an operator
// does to the panel, and the three things the server does back. Written once so the panel's
// test files read the same. Nothing here keeps state between calls.
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { z } from 'zod';

import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildRaceClockGraphic,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

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
 * Draws "Edição rápida" on a connected page. The server lists the race clock first and
 * the lower third second, and has these instances on air.
 */
export function renderQuickEditPanelWithTheseInstancesOnAir(
  instancesOnAir: Instance[],
): ControlPageOnFakeServer {
  return renderOnControlPageConnectedToFakeServer(<QuickEditPanel />, {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
    instances: instancesOnAir,
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
 * Presses a button and waits until the panel has finished with the press. Both buttons
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

/**
 * Does to data what the real server does before it checks it: a field sent as null is
 * taken out, and every field named in `takeTimeFieldKeys` gets the moment of the command.
 */
function prepareDataAsTheServerDoes(
  dataBefore: Record<string, unknown>,
  dataOfTheCommand: Record<string, unknown>,
  takeTimeFieldKeys: string[],
  momentOfTheCommand: string,
): Record<string, unknown> {
  const fieldsLaidOver = Object.entries({ ...dataBefore, ...dataOfTheCommand });
  const fieldsWithAValue = fieldsLaidOver.filter(([, value]) => value !== null);
  const stampedFields = takeTimeFieldKeys.map((key) => [key, Date.parse(momentOfTheCommand)]);
  return Object.fromEntries([...fieldsWithAValue, ...stampedFields]);
}

/**
 * The fake server does what the real one does with a take it accepts: it puts the data
 * of the newest command on the layer the command names, tells the page so, and only then
 * answers "ok". The real server sends in that same order (webSocketHub.ts), which is why
 * the page may read the new instance as soon as it hears "ok".
 */
export function letTheServerPutTheLastTakeOnAir(
  fakeServer: FakeServer,
  idOfTheNewInstance: string,
  takenAt: string,
): void {
  const takeCommand = TakeCommandReceivedSchema.parse(fakeServer.listCommandsReceived().at(-1));
  const instanceTheTakeCreates: Instance = {
    id: idOfTheNewInstance,
    layerId: takeCommand.layerId,
    graphicId: takeCommand.graphicId,
    target: 'program',
    resolvedData: prepareDataAsTheServerDoes(
      {},
      takeCommand.data,
      takeCommand.takeTimeFieldKeys,
      takenAt,
    ),
    currentStep: 0,
    status: 'on-air',
    takenAt,
  };

  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [instanceTheTakeCreates] });
  fakeServer.acceptLastCommand();
}

/**
 * The fake server does what the real one does with an update it accepts: it lays the
 * fields of the newest command over the data the instance held, keeps the instance's id
 * and the moment it was taken, tells the page so, and only then answers "ok".
 */
export function letTheServerApplyTheLastUpdate(
  fakeServer: FakeServer,
  instanceBeforeTheUpdate: Instance,
  momentOfTheUpdate: string,
): void {
  const updateCommand = UpdateCommandReceivedSchema.parse(fakeServer.listCommandsReceived().at(-1));
  const instanceAfterTheUpdate: Instance = {
    ...instanceBeforeTheUpdate,
    resolvedData: prepareDataAsTheServerDoes(
      instanceBeforeTheUpdate.resolvedData,
      updateCommand.data,
      updateCommand.takeTimeFieldKeys,
      momentOfTheUpdate,
    ),
  };

  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [instanceAfterTheUpdate] });
  fakeServer.acceptLastCommand();
}

/**
 * The fake server does what the real one does with an update whose result lacks a
 * required field of the race clock: it lays the fields of the newest command over the
 * data the instance held, looks for the first field the manifest requires that is still
 * not there, and refuses in the real server's words, changing nothing on air. The real
 * server checks the whole result, not only the fields sent (updateInstanceData.ts).
 */
export function letTheServerRefuseTheLastUpdateForARequiredFieldMissingOnAir(
  fakeServer: FakeServer,
  raceClockInstanceBeforeTheUpdate: Instance,
): void {
  const updateCommand = UpdateCommandReceivedSchema.parse(fakeServer.listCommandsReceived().at(-1));
  const dataTheUpdateWouldLeaveOnAir = prepareDataAsTheServerDoes(
    raceClockInstanceBeforeTheUpdate.resolvedData,
    updateCommand.data,
    updateCommand.takeTimeFieldKeys,
    raceClockInstanceBeforeTheUpdate.takenAt,
  );
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
