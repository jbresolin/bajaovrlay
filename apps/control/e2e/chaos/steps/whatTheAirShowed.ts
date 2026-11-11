// Test support (chaos suite): what a viewer of the program output saw while something
// broke, read from the output page's watch (pagesOfTheShow.ts): whether a layer went blank
// for even one frame, and how many times an instance played its entrance. The two promises
// every scenario ends on: nothing on air blanks, nothing on air jumps.
import { expect } from '@playwright/test';

import type { RendererLogLine } from '../../../../renderer/e2e/rendererLogLines';
import { readWhatLayerShowed } from '../../../../renderer/e2e/whatEachLayerShowed';
import type { ProgramOutput } from './pagesOfTheShow';
import { readTowerRowCountsSinceItShowed } from './towerRowsAtEveryFrame';

/**
 * How many times the renderer played this instance with its entrance: a `playAction`
 * without skipAnimation. Once is the take; a rebuild after a reconnect plays it again with
 * skipAnimation (straight to where it was), which is not an entrance and is not counted.
 * For a graphic of one step only: a step change ("Próximo") is a `playAction` too, which
 * countLifecycleCallsOfInstance tells apart.
 */
export function countEntrancesOfInstance(logLines: RendererLogLine[], instanceId: string): number {
  const entrances = logLines.filter(
    (line) =>
      line.message === 'graphic lifecycle call' &&
      line.action === 'playAction' &&
      line.instanceId === instanceId &&
      line.skipAnimation !== true,
  );
  return entrances.length;
}

/**
 * How many calls of this OGraf action the renderer made on this instance, animated or
 * not: one `load` per time it was built, one `playAction` for the take and one per step.
 */
export function countLifecycleCallsOfInstance(
  logLines: RendererLogLine[],
  instanceId: string,
  action: 'load' | 'playAction',
): number {
  const calls = logLines.filter(
    (line) =>
      line.message === 'graphic lifecycle call' &&
      line.action === action &&
      line.instanceId === instanceId,
  );
  return calls.length;
}

/**
 * How many entrances the renderer played on this layer, whatever the instance: two takes
 * of the same button are two instances, so a take applied twice shows here as 2.
 */
export function countEntrancesOnLayer(logLines: RendererLogLine[], layerId: string): number {
  const entrances = logLines.filter(
    (line) =>
      line.message === 'graphic lifecycle call' &&
      line.action === 'playAction' &&
      line.layerId === layerId &&
      line.skipAnimation !== true,
  );
  return entrances.length;
}

/**
 * What the layer showed, frame by frame, from the first frame this instance was visible
 * on: one sentence per change ("on air", "nothing", "another instance"). Hidden copies the
 * renderer loads behind the visible one do not count: the viewer never saw them.
 */
export async function readWhatTheLayerShowedSinceTheInstanceCameOn(
  output: ProgramOutput,
  layerId: string,
  instanceId: string,
): Promise<string[]> {
  const changes = await readWhatLayerShowed(output.page, layerId, { [instanceId]: 'on air' });
  const firstFrameOnAir = changes.findIndex((change) => change.includes('on air visible'));
  if (firstFrameOnAir === -1) {
    return [];
  }
  return changes.slice(firstFrameOnAir).map((change) => {
    if (change === 'nothing') {
      return 'nothing';
    }
    return change.includes('on air visible') ? 'on air' : 'another instance';
  });
}

/**
 * Checks the two promises for one instance on one layer: since it first came on air, the
 * layer never showed anything but it, not even for a frame, and its entrance played once.
 * `whatBroke` names the failure in the messages ("the API went down").
 */
export async function expectTheInstanceStayedOnAirUntouched(
  output: ProgramOutput,
  layerId: string,
  instanceId: string,
  whatBroke: string,
): Promise<void> {
  const framesSinceItCameOn = await readWhatTheLayerShowedSinceTheInstanceCameOn(
    output,
    layerId,
    instanceId,
  );
  expect(
    framesSinceItCameOn.every((frame) => frame === 'on air'),
    `the "${layerId}" layer must show the same graphic at every frame while ${whatBroke}; it showed: ${framesSinceItCameOn.join(' → ')}`,
  ).toBe(true);
  expect(
    countEntrancesOfInstance(output.logLines, instanceId),
    `the graphic on "${layerId}" must play its entrance once, never again because ${whatBroke}`,
  ).toBe(1);
}

/**
 * Checks the tower's rows: from the first frame it showed `startingRowCount` rows to now,
 * it never showed fewer, not even for a frame. `whatBroke` names the failure in the message.
 */
export async function expectTheTowerNeverLostARow(
  output: ProgramOutput,
  startingRowCount: number,
  whatBroke: string,
): Promise<void> {
  const rowCounts = await readTowerRowCountsSinceItShowed(output.page, startingRowCount);
  expect(
    rowCounts.length,
    `the tower must have shown its ${String(startingRowCount)} rows on the output`,
  ).toBeGreaterThan(0);
  expect(
    Math.min(...rowCounts),
    `the tower must never show fewer than ${String(startingRowCount)} rows while ${whatBroke}; its counts were ${rowCounts.join(' → ')}`,
  ).toBeGreaterThanOrEqual(startingRowCount);
}

/**
 * Checks that from the first frame this layer showed a graphic to now, it never showed
 * nothing, whichever graphic it was: a take replacing another must never leave a gap.
 */
export async function expectTheLayerNeverWentBlank(
  output: ProgramOutput,
  layerId: string,
  whatWasGoingOn: string,
): Promise<void> {
  const changes = await readWhatLayerShowed(output.page, layerId, {});
  const firstFrameWithAGraphic = changes.findIndex((change) => change !== 'nothing');
  const changesSinceItShowedAGraphic = changes.slice(firstFrameWithAGraphic);
  expect(
    firstFrameWithAGraphic,
    `the "${layerId}" layer must have shown a graphic on the output`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    changesSinceItShowedAGraphic.includes('nothing'),
    `the "${layerId}" layer must never show nothing while ${whatWasGoingOn}`,
  ).toBe(false);
}
