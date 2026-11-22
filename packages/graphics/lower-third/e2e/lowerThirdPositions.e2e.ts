/**
 * Lower third: where the pills sit for each "Posição"
 * (packages/graphics/lower-third, Playwright, BAJAOVRLAY-85)
 *
 * What this module is for:
 *   An item of the lower third ("Tarja") may put it on the left (Esquerda, the design's
 *   place and the place of every item that names none), in the centre (Centro) or on the
 *   right (Direita) of the bottom of the stage. The reviewer cannot run OBS, so this
 *   measures each pill in Chromium, at OBS's size, from the built graphic.
 *
 * What these tests prove, with the name pill and the role pill both on air:
 *   - No position, and Esquerda: both pills start at x 96, as before the setting.
 *   - Direita: both pills end at x 1824 (1920 − 96), the shorter one lined up under the
 *     longer one by its right edge.
 *   - Centro: both pills are centred on x 960.
 *   - In all three the role pill still ends at y 940 and the text inside each pill
 *     is set left to right.
 *   - A name too long for its pill stops the pill at 1300 px and scrolls inside it in
 *     Centro and in Direita too, the pill keeping its place.
 *   - A lower third on air on Esquerda moved to Direita by an update (the operator
 *     changing "Posição" on air) lands with both right edges at x 1824, still visible.
 *
 * What these tests deliberately do not cover:
 *   - How the pills look; e2e/lowerThirdScreenshots.e2e.ts pins Centro and Direita on
 *     both stages, beside the unchanged Esquerda baselines.
 *   - Motion: the play-in is the same rise and fade in every position;
 *     e2e/lowerThirdLifecycle.e2e.ts covers in and out.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import {
  expectTextEndShowing,
  longestBajaSchoolNames,
  measureScrollingBox,
  textTokensHoldingAtTheStart,
  textTokensScrollingToTheEndAtOnce,
  waitForScrollPhase,
} from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** `--lower-third-max-width` in Ardósia: 1728 − 420 − 8. */
const lowerThirdMaxWidthPx = 1300;

/** Opens the preview with this data on air, text held at its start, the font loaded. */
async function openLowerThirdOnAir(
  page: Page,
  lowerThirdData: Record<string, unknown>,
  textTokens: Record<string, string> = textTokensHoldingAtTheStart,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokens);
  await page.goto(buildPreviewAddressWithData(lowerThirdData));
  await expect(page.locator('body'), 'the lower third must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Measures one element on the stage: its left, right, centre and bottom, in pixels. */
async function measureOnTheStage(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  if (box === null) {
    throw new Error(`${testId} is not on the stage`);
  }
  return {
    left: box.x,
    right: box.x + box.width,
    centre: box.x + box.width / 2,
    bottom: box.y + box.height,
    width: box.width,
  };
}

/** The captain of Baja UFMG: a name pill narrower than the role pill under it. */
const teamCaptainData = {
  name: 'Mariana Costa',
  role: 'Capitã da equipe',
  teamLine: 'Baja UFMG · UFMG',
};

const positionScenarios = [
  {
    // An item saved before "Posição" existed: it must sit where it always sat.
    name: 'puts both pills at x 96 when the item names no position',
    lowerThirdData: teamCaptainData,
    edgeMeasured: 'left' as const,
    expectedEdgePx: 96,
  },
  {
    // Esquerda chosen on purpose: the same place.
    name: 'puts both pills at x 96 on Esquerda',
    lowerThirdData: { ...teamCaptainData, position: 'left' },
    edgeMeasured: 'left' as const,
    expectedEdgePx: 96,
  },
  {
    // Direita: the mirror, both right edges on the title-safe right edge.
    name: 'ends both pills at x 1824 on Direita',
    lowerThirdData: { ...teamCaptainData, position: 'right' },
    edgeMeasured: 'right' as const,
    expectedEdgePx: 1824,
  },
  {
    // Centro: each pill centred on the middle of the stage.
    name: 'centres both pills on x 960 on Centro',
    lowerThirdData: { ...teamCaptainData, position: 'center' },
    edgeMeasured: 'centre' as const,
    expectedEdgePx: 960,
  },
];

test.describe('where the pills sit for each position', () => {
  for (const scenario of positionScenarios) {
    test(scenario.name, async ({ page }) => {
      // Arrange: the captain on air in the position of the scenario row above.
      await openLowerThirdOnAir(page, scenario.lowerThirdData);

      // Act: measure both pills and the name inside the name pill.
      const namePill = await measureOnTheStage(page, 'lower-third-name-pill');
      const rolePill = await measureOnTheStage(page, 'lower-third-role-pill');
      const textDirectionsOfThePills = await Promise.all(
        ['lower-third-name-pill', 'lower-third-role-pill'].map((testId) =>
          page.getByTestId(testId).evaluate((pill) => getComputedStyle(pill).direction),
        ),
      );

      // Assert: each pill's edge (or centre) where the position puts it, the bottom at
      // y 940, and the text in both pills still set left to right (a mirror made with
      // `direction: rtl` would reverse the role, the dot and the team line).
      expect(
        namePill[scenario.edgeMeasured],
        `the name pill's ${scenario.edgeMeasured} must be at x ${String(scenario.expectedEdgePx)}`,
      ).toBeCloseTo(scenario.expectedEdgePx, 0);
      expect(
        rolePill[scenario.edgeMeasured],
        `the role pill's ${scenario.edgeMeasured} must be at x ${String(scenario.expectedEdgePx)}`,
      ).toBeCloseTo(scenario.expectedEdgePx, 0);
      expect(rolePill.bottom, 'the role pill must end at y 940 in every position').toBe(940);
      expect(textDirectionsOfThePills, 'the text in both pills must read left to right').toEqual([
        'ltr',
        'ltr',
      ]);
      expect(namePill.width, 'the captain’s name pill is narrower than her role pill').toBeLessThan(
        rolePill.width,
      );
    });
  }
});

const longNameScenarios = [
  {
    // Direita: the long pill ends at the safe edge and reaches back to x 524.
    name: 'stops a long name’s pill at 1300 px on Direita, ending at x 1824',
    position: 'right',
    edgeMeasured: 'right' as const,
    expectedEdgePx: 1824,
  },
  {
    // Centro: the long pill is centred, from x 310 to x 1610.
    name: 'stops a long name’s pill at 1300 px on Centro, centred on x 960',
    position: 'center',
    edgeMeasured: 'centre' as const,
    expectedEdgePx: 960,
  },
];

test.describe('a name too long for its pill, away from the left', () => {
  for (const scenario of longNameScenarios) {
    test(scenario.name, async ({ page }) => {
      // Arrange: the IFF's full name on air in this position, scrolled to its end at once.
      await openLowerThirdOnAir(
        page,
        {
          name: longestBajaSchoolNames.iffItaperuna,
          role: 'Representante da instituição',
          position: scenario.position,
        },
        textTokensScrollingToTheEndAtOnce,
      );
      const nameBox = page.getByTestId('lower-third-name');

      // Act: wait for the end of the scroll, then measure the pill and the name.
      await waitForScrollPhase(nameBox, 'holdingAtEnd');
      const namePill = await measureOnTheStage(page, 'lower-third-name-pill');
      const namePlace = await measureScrollingBox(nameBox);

      // Assert: the pill at its maximum, in its place, the end of the name showing.
      expect(namePill.width, 'the pill must stop at --lower-third-max-width').toBeCloseTo(
        lowerThirdMaxWidthPx,
        0,
      );
      expect(
        namePill[scenario.edgeMeasured],
        `the long pill's ${scenario.edgeMeasured} must stay at x ${String(scenario.expectedEdgePx)}`,
      ).toBeCloseTo(scenario.expectedEdgePx, 0);
      expectTextEndShowing(namePlace);
    });
  }
});

test.describe('changing the position on air', () => {
  test('moves a lower third on air from Esquerda to Direita, both pills still visible', async ({
    page,
  }) => {
    // Arrange: the captain on air on Esquerda, the item naming no position.
    await openLowerThirdOnAir(page, teamCaptainData);

    // Act: send the update a renderer sends when the operator picks "Direita" on air,
    // straight to the graphic on the preview page, and note its answer.
    const updateAnswer = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & {
        updateAction: (params: object) => Promise<{ statusCode: number }>;
      };
      const graphic = document.querySelector('baja-lower-third') as OGrafGraphic;
      return graphic.updateAction({ data: { position: 'right' } });
    });
    const namePill = await measureOnTheStage(page, 'lower-third-name-pill');
    const rolePill = await measureOnTheStage(page, 'lower-third-role-pill');

    // Assert: the update was taken, both pills now end at x 1824, and both are still
    // on air (an update never takes them out).
    expect(updateAnswer.statusCode, 'the move must be taken with 200').toBe(200);
    expect(namePill.right, 'the name pill must now end at x 1824').toBeCloseTo(1824, 0);
    expect(rolePill.right, 'the role pill must now end at x 1824').toBeCloseTo(1824, 0);
    await expect(
      page.getByTestId('lower-third-name-pill'),
      'the name pill must still be on air after the move',
    ).toHaveCSS('opacity', '1');
    await expect(
      page.getByTestId('lower-third-role-pill'),
      'the role pill must still be on air after the move',
    ).toHaveCSS('opacity', '1');
  });
});
