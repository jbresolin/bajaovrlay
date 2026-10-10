// Test support: the few things an operator does to the race clock form, and the one
// thing the server does back, written once so the four panel test files read the same.
// Nothing here keeps state between calls.
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { z } from 'zod';

import type { ControlPageOnFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

// What the fake server needs from a take it received: the data to put on air.
const TakeCommandReceivedSchema = z.object({
  type: z.literal('takeGraphic'),
  data: z.record(z.string(), z.unknown()),
});

/** Types into a text field found by its label, replacing what was there. */
export function typeIntoField(fieldLabel: string, text: string): void {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

/** Opens a dropdown found by its label and picks one of its options. */
export function chooseOptionInDropdown(dropdownLabel: string, optionLabel: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownLabel }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}

/** Presses a button and waits until the fake server holds that many commands. */
export async function pressButtonAndWaitForCommand(
  buttonName: string,
  commandsExpectedByThen: number,
  fakeServer: ControlPageOnFakeServer['fakeServer'],
): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitFor(() => {
    expect(
      fakeServer.listCommandsReceived(),
      `pressing "${buttonName}" must send a command`,
    ).toHaveLength(commandsExpectedByThen);
  });
}

/** A race clock instance on the clock layer of the program output, holding this data. */
export function buildRaceClockInstanceHoldingThisData(
  raceClockData: Record<string, unknown>,
  takenAt: string,
): Instance {
  return {
    id: 'c41f7e9a-63d2-4b1c-8a0f-5e2d9b7a3c66',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: raceClockData,
    currentStep: 0,
    status: 'loading',
    takenAt,
  };
}

/**
 * The fake server does what the real one does with a take it accepts: it puts the data
 * of the newest command on the clock layer, tells the page so, and only then answers
 * "ok". The real server sends in that same order (webSocketHub.ts), which is why the page
 * may read the new instance as soon as it hears "ok".
 */
export function letTheServerPutTheLastTakeOnAir(
  fakeServer: ControlPageOnFakeServer['fakeServer'],
  takenAt: string,
): void {
  const lastCommandReceived = fakeServer.listCommandsReceived().at(-1);
  const takeCommand = TakeCommandReceivedSchema.parse(lastCommandReceived);
  const instanceTheTakeCreates = buildRaceClockInstanceHoldingThisData(takeCommand.data, takenAt);

  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [instanceTheTakeCreates] });
  fakeServer.acceptLastCommand();
}
