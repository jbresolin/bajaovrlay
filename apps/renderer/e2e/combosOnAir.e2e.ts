/**
 * The design's two combinations on the renderer's stage: the strip or the ticker with a
 * lower third (apps/renderer, Playwright)
 *
 * What this module is for:
 *   Graphics on different layers share the screen (the design's catalogue, "What can share
 *   the screen"), and the boxes were drawn so that they never overlap: the bar along the
 *   bottom on the ticker layer, the lower third just above it. The design pins two such
 *   screens, `combo-strip` and `combo-ticker`; this test composes each on the real renderer
 *   page from takes of items on the real server, the way the operator puts them on air, and
 *   pins it against a baseline.
 *
 * What these tests prove:
 *   - combo-strip: page 1 of the real enduro on the strip (the clock held at 1:00:00) under
 *     Mariana Costa's lower third, both on air at once, as the baseline shows.
 *   - combo-ticker: the ticker ("AVISO", "Largada do enduro às 10h00") under Carlos Henrique
 *     Lima's lower third, as the baseline shows.
 *   - In both, the lower third ends above the bar: nothing overlaps.
 *
 * What these tests deliberately do not cover:
 *   - Each graphic alone; their own packages' screenshots.
 *   - The design's background: the stage here is the design's grey (#7f7f7f), painted
 *     under the renderer's transparent page so the shot is comparable.
 *   - Other operating systems: the baselines are rendered on Linux. After a deliberate
 *     visual change refresh them with
 *     `pnpm --filter @bajaovrlay/renderer test:e2e --update-snapshots`.
 */
import { readFileSync } from 'node:fs';

import { expect, type Page, test } from '@playwright/test';

import { sendCommandToRealServer } from './realServer.js';

/**
 * The real enduro's 34 cars, read from the design's sample data (docs/design/sample-data.json,
 * the same field the strip's own tests and preview use), as the positions source sends them.
 */
function readRealEnduroField(): Array<Record<string, unknown>> {
  const sampleDataAddress = new URL('../../../docs/design/sample-data.json', import.meta.url);
  const sampleData = JSON.parse(readFileSync(sampleDataAddress, 'utf8')) as {
    positions: Array<{ position: number; carNumber: number; schoolName: string }>;
  };
  return sampleData.positions.map((car) => ({
    position: car.position,
    carNumber: car.carNumber,
    schoolName: car.schoolName,
  }));
}

/** The clock both bars show, held at 1:00:00 under the green flag so a shot never moves. */
const heldEnduroClock = {
  state: 'green',
  clockMode: 'elapsed',
  referenceTimeMs: 3_600_000,
  referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
  running: false,
};

/** Turns data into item fields, each value typed in (`literal`). */
function buildLiteralItemFields(data: Record<string, unknown>) {
  const fields: Record<string, { kind: 'literal'; value: unknown }> = {};
  for (const [fieldKey, value] of Object.entries(data)) {
    fields[fieldKey] = { kind: 'literal', value };
  }
  return fields;
}

/**
 * Prepares one graphic as an item of "Sessão principal" on its layer and takes it, as the
 * control page's "Salvar e disparar" does. Throws when the server refuses either command.
 */
async function prepareAndTake(
  graphicId: string,
  layerId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const createAnswer = await sendCommandToRealServer({
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    layerId,
    graphicId,
    fields: buildLiteralItemFields(data),
    label: `${graphicId} da combinação`,
  });
  if (!createAnswer.ok || createAnswer.createdItemId === undefined) {
    throw new Error(
      `the real server did not create the ${graphicId} item: ${JSON.stringify(createAnswer)}`,
    );
  }
  const takeAnswer = await sendCommandToRealServer({
    type: 'takeItem',
    itemId: createAnswer.createdItemId,
  });
  if (!takeAnswer.ok) {
    throw new Error(
      `the real server refused the take of ${graphicId}: ${JSON.stringify(takeAnswer)}`,
    );
  }
}

/** Opens the renderer on a clear stage painted the design's grey, its layers built. */
async function openTheRendererOnAClearGreyStage(page: Page): Promise<void> {
  await sendCommandToRealServer({ type: 'clearAll' });
  await page.goto('/render/');
  await page.addStyleTag({ content: 'html, body { background: #7f7f7f; }' });
  await expect(
    page.locator('[data-layer-id="ticker"]'),
    'the renderer must build the ticker layer',
  ).toBeAttached();
}

/**
 * Waits until both graphics are on air and at rest, the face loaded: the bar's page cell
 * (its last piece in) and the lower third's role pill (its last) fully visible.
 */
async function waitForBothOnAir(page: Page, pageCellTestId: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.getByTestId(pageCellTestId), 'the bar must be in').toHaveCSS('opacity', '1');
  await expect(page.getByTestId('lower-third-role-pill'), 'the lower third must be in').toHaveCSS(
    'opacity',
    '1',
  );
}

// The two tests share one server and its layers, so they run one after the other; each
// clears the server and arranges its own screen.
test.describe.configure({ mode: 'serial' });

test.describe('the design’s combinations on the renderer', () => {
  test('combo-strip: the strip under a lower third', async ({ page }) => {
    // Arrange: a clear grey stage.
    await openTheRendererOnAClearGreyStage(page);

    // Act: take the strip with the real field, then the captain's lower third.
    await prepareAndTake('lower-strip', 'ticker', {
      entries: readRealEnduroField(),
      ...heldEnduroClock,
    });
    await prepareAndTake('lower-third', 'lower-third', {
      name: 'Mariana Costa',
      role: 'Capitã da equipe',
      teamLine: 'Baja UFMG · UFMG',
    });
    await waitForBothOnAir(page, 'lower-strip-page-cell');

    // Assert: the lower third ends above the bar, and the screen looks like its baseline.
    const barBox = await page.getByTestId('lower-strip-bar').boundingBox();
    const rolePillBox = await page.getByTestId('lower-third-role-pill').boundingBox();
    expect(
      (rolePillBox?.y ?? 0) + (rolePillBox?.height ?? 0),
      'the lower third must end above the bar',
    ).toBeLessThan(barBox?.y ?? 0);
    await expect(page, 'combo-strip must look like its baseline').toHaveScreenshot(
      'combo-strip.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('combo-ticker: the ticker under a lower third', async ({ page }) => {
    // Arrange: a clear grey stage.
    await openTheRendererOnAClearGreyStage(page);

    // Act: take the ticker with the enduro's announcements, then the director's lower third.
    await prepareAndTake('message-ticker', 'ticker', {
      label: 'AVISO',
      messages: [
        'Largada do enduro às 10h00',
        'Box aberto para abastecimento',
        'Premiação às 16h no palco principal',
      ],
      ...heldEnduroClock,
      // The design's combo-ticker shows the clock block, which is off by default.
      showClockBlock: true,
    });
    await prepareAndTake('lower-third', 'lower-third', {
      name: 'Carlos Henrique Lima',
      role: 'Diretor de prova',
    });
    await waitForBothOnAir(page, 'message-ticker-page-cell');

    // Assert: the lower third ends above the bar, and the screen looks like its baseline.
    const barBox = await page.getByTestId('message-ticker-bar').boundingBox();
    const rolePillBox = await page.getByTestId('lower-third-role-pill').boundingBox();
    expect(
      (rolePillBox?.y ?? 0) + (rolePillBox?.height ?? 0),
      'the lower third must end above the bar',
    ).toBeLessThan(barBox?.y ?? 0);
    await expect(page, 'combo-ticker must look like its baseline').toHaveScreenshot(
      'combo-ticker.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });
});
