/**
 * Match bug screenshots: before, during and after a match, a timed run, the third place,
 * and each corner, on two stages (packages/graphics/bracket-match-bug, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so how the match bug looks and where it
 *   sits are pinned by screenshots of the built preview.html (the theme's tokens, as the
 *   renderer page loads them) at 1920x1080, on the design's grey and black stages,
 *   compared with the baselines stored next to this file (BAJAOVRLAY-65).
 *
 * What these tests prove:
 *   - The second semifinal before it starts (0 × 0, "MD3"), during it (1 × 1) and after
 *     it (1 × 2, Pequi's chip and score green, Corisco dimmed); a timed quarter-final with
 *     both times and its winner; the third place under its own round name: each like its
 *     baseline.
 *   - In the top-left corner the bug stands beside the sponsor bug (left edge at 412: the
 *     safe edge 96, the bug's 300 and a 16 gap), on the safe top edge; in each other corner
 *     it sits on that corner's title-safe edges (x 96..1824, y 54..1026), measured.
 *   - An empty "agora" played on air leaves the stage empty.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of the fade in.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/bracket-match-bug test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on air and hides its buttons, which are not on air. */
async function openPreviewOnAir(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the match bug must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

/** The panel's edges on the 1920x1080 page, read from its box. */
async function measureThePanel(page: Page) {
  const box = await page.getByTestId('match-bug-panel').boundingBox();
  const left = box?.x ?? 0;
  const top = box?.y ?? 0;
  return { left, top, right: left + (box?.width ?? 0), bottom: top + (box?.height ?? 0) };
}

type PanelEdges = Awaited<ReturnType<typeof measureThePanel>>;

const matchScenarios = [
  // Before: a best of 3 at 0 × 0 with its "MD3".
  { slug: 'antes', match: 'before' },
  // During: 1 × 1.
  { slug: 'durante-1x1', match: 'during' },
  // After: Pequi took it 2 × 1; the winner green, the loser dimmed.
  { slug: 'depois', match: 'after' },
  // A timed quarter-final: each car's time, Corisco the winner.
  { slug: 'tempos', match: 'times' },
  // The third place, named by its round.
  { slug: 'disputa-3o-lugar', match: 'third-place' },
];

const cornerScenarios = [
  // Beside the sponsor bug: 96 + 300 + 16 from the left, on the safe top edge.
  {
    corner: 'top-left',
    edges: (panel: PanelEdges) => ({ left: panel.left, top: panel.top }),
    expected: { left: 412, top: 54 },
  },
  // The clock's corner: right edge 1824, top edge 54.
  {
    corner: 'top-right',
    edges: (panel: PanelEdges) => ({ right: panel.right, top: panel.top }),
    expected: { right: 1824, top: 54 },
  },
  // Bottom-left: left 96, bottom 1026.
  {
    corner: 'bottom-left',
    edges: (panel: PanelEdges) => ({ left: panel.left, bottom: panel.bottom }),
    expected: { left: 96, bottom: 1026 },
  },
  // Bottom-right: right 1824, bottom 1026.
  {
    corner: 'bottom-right',
    edges: (panel: PanelEdges) => ({ right: panel.right, bottom: panel.bottom }),
    expected: { right: 1824, bottom: 1026 },
  },
] as const;

for (const stage of ['grey', 'black'] as const) {
  test.describe(`the match bug on the ${stage} stage`, () => {
    for (const scenario of matchScenarios) {
      test(`draws the match ${scenario.slug} like its baseline`, async ({ page }) => {
        // Arrange: the preview on air with this sample match, in the default corner.
        await openPreviewOnAir(page, `preview.html?stage=${stage}&match=${scenario.match}`);

        // Act: nothing more; the bug is on air.

        // Assert: its look against the baseline. A 1% pixel tolerance absorbs
        // anti-aliasing between GPU drivers.
        await expect(
          page,
          `the match ${scenario.slug} must look like its baseline`,
        ).toHaveScreenshot(`match-bug-${scenario.slug}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }

    for (const scenario of cornerScenarios) {
      test(`sits on the ${scenario.corner} corner's edges`, async ({ page }) => {
        // Arrange: the match at 1 × 1 on air in this corner.
        await openPreviewOnAir(page, `preview.html?stage=${stage}&corner=${scenario.corner}`);

        // Act: measure the panel.
        const panel = await measureThePanel(page);

        // Assert: the corner's two edges, and its look against the baseline.
        expect(scenario.edges(panel), `the bug must sit on the ${scenario.corner} edges`).toEqual(
          scenario.expected,
        );
        await expect(
          page,
          `the ${scenario.corner} bug must look like its baseline`,
        ).toHaveScreenshot(`match-bug-${scenario.corner}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }

    test('shows nothing on air for an empty "agora"', async ({ page }) => {
      // Arrange: the preview playing an empty match.
      await openPreviewOnAir(page, `preview.html?stage=${stage}&match=empty`);

      // Act: nothing more; the bug is on air with no match.

      // Assert: no car drawn, and the stage alone in the shot.
      await expect(
        page.getByTestId('match-bug-car-name'),
        'an empty "agora" must draw no car',
      ).toHaveCount(0);
      await expect(page, 'an empty "agora" must leave the stage empty').toHaveScreenshot(
        `match-bug-vazio-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  });
}
