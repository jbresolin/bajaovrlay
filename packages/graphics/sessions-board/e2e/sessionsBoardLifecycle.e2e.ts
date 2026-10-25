/**
 * The sessions board driven like a renderer (packages/graphics/sessions-board, Playwright)
 *
 * What this module is for:
 *   A renderer finds the graphic by its manifest, imports "main", registers its default
 *   export and calls load, playAction, updateAction, stopAction and dispose. These tests do
 *   that against the BUILT graphic (dist/), served under /graphics/sessions-board/, in
 *   Chromium, with the page's clock set by the test.
 *
 * What these tests prove:
 *   - The built dist/ works; every call answers 200 in order, play reports step 0; the
 *     head is invisible before play, in after it, out after stop.
 *   - In the real browser at 09:20 the alignment shows "EM ANDAMENTO", and once the page's
 *     clock passes 10:00 the enduro does, read web-first.
 *
 * What these tests deliberately do not cover:
 *   - The crossfade's frames; sessions-board.test.ts proves the change at the boundary.
 *   - The look; sessionsBoardScreenshots.e2e.ts.
 */
import { expect, type Page, test } from '@playwright/test';

/** Sunday 30 March 2025 at a time of day in Brasília, in ms. */
function atSundayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2025-03-30T${hoursAndMinutes}:00.000-03:00`);
}

/** Sunday's six slots, as the design's page shows them. */
function buildSundaySlots() {
  const slots: Array<[string, string, string]> = [
    ['abertura', 'Abertura do box', '07:30'],
    ['briefing', 'Briefing das equipes', '08:30'],
    ['alinhamento', 'Alinhamento do enduro', '09:15'],
    ['enduro', 'Enduro de Resistência', '10:00'],
    ['intervalo', 'Intervalo', '14:30'],
    ['premiacao', 'Cerimônia de premiação', '16:00'],
  ];
  return slots.map(([slotId, sessionName, startTime]) => ({
    slotId,
    sessionName,
    startsAtMs: atSundayBrasiliaTime(startTime),
  }));
}

/**
 * Opens the folder at 09:19:50 on the page's clock (which runs: GSAP reads it) and does what
 * a renderer does: the motion tokens on :root, the manifest read, "main" imported and
 * registered, one element put on the page.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.clock.install({ time: atSundayBrasiliaTime('09:20') - 10_000 });
  await page.goto('sessions-board.ograf.json');
  return page.evaluate(async () => {
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifest = (await (await fetch('sessions-board.ograf.json')).json()) as {
      id: string;
      main: string;
    };
    const graphicModule = (await import(new URL(manifest.main, location.href).href)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-sessions-board', graphicModule.default);
    document.body.append(document.createElement('baja-sessions-board'));
    return manifest.id;
  });
}

/** The state shown on the row of a session, read inside the graphic's shadow root. */
function readStatusShownOf(page: Page, session: string): Promise<string | undefined> {
  return page.evaluate((sessionName) => {
    const board = document.querySelector('baja-sessions-board');
    const rows = [
      ...(board?.shadowRoot?.querySelectorAll('[data-testid="sessions-board-row"]') ?? []),
    ];
    const row = rows.find(
      (candidate) =>
        candidate.querySelector('[data-testid="sessions-board-session"]')?.textContent ===
        sessionName,
    );
    const layers = [...(row?.querySelectorAll<HTMLElement>('.status-layer') ?? [])];
    return layers.find((layer) => getComputedStyle(layer).opacity === '1')?.dataset.status;
  }, session);
}

test.describe('the sessions board driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: the whole lifecycle, each call awaited, noting the answers and the head's opacity.
    const lifecycle = await page.evaluate(async (slots) => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number; currentStep?: number }>;
      const graphic = document.querySelector('baja-sessions-board') as HTMLElement &
        Record<'load' | 'playAction' | 'updateAction' | 'stopAction' | 'dispose', OGrafAction>;
      const readHeadOpacity = () => {
        const head = graphic.shadowRoot?.querySelector('[data-testid="sessions-board-head"]');
        return head ? Number(getComputedStyle(head).opacity) : -1;
      };
      const answers: unknown[] = [];
      answers.push({
        action: 'load',
        ...(await graphic.load({
          data: { title: 'PROGRAMAÇÃO DO DIA', slots },
          renderType: 'realtime',
          renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
        })),
      });
      const opacityBeforePlay = readHeadOpacity();
      answers.push({ action: 'play', ...(await graphic.playAction({})) });
      const opacityWhenPlayResolved = readHeadOpacity();
      answers.push({
        action: 'update',
        ...(await graphic.updateAction({ data: { title: 'PROGRAMAÇÃO DE DOMINGO' } })),
      });
      answers.push({ action: 'stop', ...(await graphic.stopAction({})) });
      const opacityWhenStopResolved = readHeadOpacity();
      answers.push({ action: 'dispose', ...(await graphic.dispose({})) });
      return { answers, opacityBeforePlay, opacityWhenPlayResolved, opacityWhenStopResolved };
    }, buildSundaySlots());

    // Assert: the manifest read, every call 200 in order, the head in and out.
    expect(manifestId, 'the renderer read the built manifest').toBe('baja-sessions-board');
    expect(lifecycle.answers, 'each call resolves in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'in when play resolves').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'out when stop resolves').toBe(0);
  });

  test('moves "em andamento" from the alignment to the enduro once the clock passes 10:00', async ({
    page,
  }) => {
    // Arrange: the board on air at 09:20 on the page's clock.
    await loadGraphicFromItsManifestLikeARenderer(page);
    await page.evaluate(async (slots) => {
      type OGrafAction = (params: object) => Promise<unknown>;
      const graphic = document.querySelector('baja-sessions-board') as HTMLElement &
        Record<'load' | 'playAction', OGrafAction>;
      await graphic.load({
        data: { title: 'PROGRAMAÇÃO DO DIA', slots },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      await graphic.playAction({});
    }, buildSundaySlots());
    await page.clock.pauseAt(atSundayBrasiliaTime('09:20'));
    const alignmentAt0920 = await readStatusShownOf(page, 'Alinhamento do enduro');

    // Act: forty minutes and a second of the page's clock run.
    await page.clock.runFor(40 * 60_000 + 1000);

    // Assert: the alignment was in progress; the enduro is now, read web-first.
    expect(alignmentAt0920, 'em andamento at 09:20').toBe('inProgress');
    await expect
      .poll(() => readStatusShownOf(page, 'Enduro de Resistência'), {
        message: 'the enduro is in progress after 10:00',
      })
      .toBe('inProgress');
  });
});
