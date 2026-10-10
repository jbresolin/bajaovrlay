// Test support: reads what the fake graphic wrote down (see
// ../test-fixtures/fake-graphic/fake-graphic.js) and turns it into short sentences, so a
// test compares a list a person can read: "Enduro: load called", "Enduro: load finished".
import type { Page } from '@playwright/test';

/** One record the fake graphic writes: a lifecycle call starting or finishing. */
export type FakeGraphicCall = {
  instanceId: string | null;
  action: 'load' | 'playAction' | 'updateAction' | 'stopAction' | 'customAction' | 'dispose';
  moment: 'called' | 'finished';
  params: Record<string, unknown>;
};

/** Reads every record the fake graphics on the page have written so far, oldest first. */
export async function readFakeGraphicCalls(page: Page): Promise<FakeGraphicCall[]> {
  return page.evaluate(() => {
    const pageWithCalls = window as unknown as { __fakeGraphicCalls?: FakeGraphicCall[] };
    return pageWithCalls.__fakeGraphicCalls ?? [];
  });
}

/**
 * Reads the records as sentences, "<instance name>: <action> <moment>", oldest first.
 * `instanceNames` maps each instance id to the name the test gives it.
 */
export async function readFakeGraphicCallsAsSentences(
  page: Page,
  instanceNames: Record<string, string>,
): Promise<string[]> {
  const calls = await readFakeGraphicCalls(page);
  return calls.map((call) => {
    const instanceName = instanceNames[call.instanceId ?? ''] ?? 'unknown instance';
    return `${instanceName}: ${call.action} ${call.moment}`;
  });
}

/**
 * Reads the arguments the renderer passed to one action of one instance, in call order.
 * A test uses it to check, for example, that playAction got `skipAnimation: true`.
 */
export async function readParamsOfCalls(
  page: Page,
  instanceId: string,
  action: FakeGraphicCall['action'],
): Promise<Array<Record<string, unknown>>> {
  const calls = await readFakeGraphicCalls(page);
  return calls
    .filter((call) => call.instanceId === instanceId)
    .filter((call) => call.action === action && call.moment === 'called')
    .map((call) => call.params);
}

/** Makes every call of the fake graphic take this long, standing in for an animation. */
export async function makeFakeGraphicCallsTake(
  page: Page,
  delayInMilliseconds: number,
): Promise<void> {
  await page.addInitScript((delay) => {
    const pageWithDelay = window as unknown as { __fakeGraphicDelayInMilliseconds?: number };
    pageWithDelay.__fakeGraphicDelayInMilliseconds = delay;
  }, delayInMilliseconds);
}
