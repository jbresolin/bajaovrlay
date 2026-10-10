// Test support: reads the renderer's log. The renderer writes one JSON line per event to
// the browser console (src/rendererLog.ts), which is the only log OBS has; a test keeps
// those lines, already parsed, to check what was logged and with which ids.
import { expect, type Page } from '@playwright/test';

/** One line of the renderer's log: its message plus whatever details were written with it. */
export type RendererLogLine = { message: string } & Record<string, unknown>;

/**
 * Starts keeping every log line the renderer writes on this page, oldest first. Call it
 * before `page.goto`. Console lines that are not the renderer's JSON (Vite's, for
 * example) are left out.
 */
export function collectRendererLogLines(page: Page): RendererLogLine[] {
  const logLines: RendererLogLine[] = [];
  page.on('console', (consoleMessage) => {
    let parsedLine: unknown;
    try {
      parsedLine = JSON.parse(consoleMessage.text());
    } catch {
      return;
    }
    const isARendererLogLine =
      typeof parsedLine === 'object' &&
      parsedLine !== null &&
      typeof (parsedLine as { message?: unknown }).message === 'string';
    if (isARendererLogLine) {
      logLines.push(parsedLine as RendererLogLine);
    }
  });
  return logLines;
}

/**
 * Waits until the renderer has logged a line with this message about this instance, and
 * returns that line so the test can check its other details.
 */
export async function waitForLogLineAboutInstance(
  logLines: RendererLogLine[],
  message: string,
  instanceId: string,
): Promise<RendererLogLine> {
  const findTheLine = () =>
    logLines.find((line) => line.message === message && line.instanceId === instanceId);
  await expect
    .poll(() => findTheLine() !== undefined, {
      message: `the renderer must log "${message}" for instance ${instanceId}`,
    })
    .toBe(true);
  const logLine = findTheLine();
  if (logLine === undefined) {
    // Cannot happen: lines are only ever added. It keeps the return type free of undefined.
    throw new Error(`the log line "${message}" was found and then lost`);
  }
  return logLine;
}
