/**
 * The operator guide prints on one A4 sheet, both sides at most (docs/operador, BAJAOVRLAY-31)
 *
 * What this module is for:
 *   guia-do-operador.md is printed and left beside the keyboard on race day. The brief allows
 *   one A4 sheet, both sides: two pages. This check builds the printable page
 *   (printableGuide.ts: the Markdown, guia-impressao.css and the pictures), prints it to
 *   A4 with Chromium as `page.pdf()` does, and counts the pages, so a guide that grew past
 *   the sheet fails the build instead of reaching a volunteer on three pages.
 *
 * What these tests prove:
 *   - The printed guide is one or two A4 pages.
 *   - The guide shows exactly the pictures screenshots.e2e.ts takes (picturesOfTheGuide.ts),
 *     each once, at most six, each a file in imagens/.
 *   - Run by the operator guide's config (project "impressao"), the PDF is also written to
 *     docs/operador/guia-do-operador.pdf, the file João prints. Run with the other browser
 *     tests (project "guia-do-operador" of playwright.config.ts) it writes nothing there; the
 *     PDF is attached to the report only.
 *
 * What these tests deliberately do not cover:
 *   - How the sheet looks: a person reads the PDF in the pull request.
 *   - That every label the guide quotes exists: apps/control/src/i18n/operatorGuideLabels.test.ts.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { picturesOfTheGuide } from './picturesOfTheGuide';
import {
  buildPrintablePageOfTheGuide,
  countPagesOfPdf,
  readPicturePathsOfTheGuide,
} from './printableGuide';

const printedGuideFile = fileURLToPath(new URL('./guia-do-operador.pdf', import.meta.url));
const picturesFolder = fileURLToPath(new URL('./imagens/', import.meta.url));

// One A4 sheet, both sides.
const mostPagesOfTheGuide = 2;

test('prints the operator guide on two A4 pages at most', async ({ page }, testInfo) => {
  // Arrange: the guide as a printable page, loaded in Chromium with its pictures and face.
  await page.setContent(buildPrintablePageOfTheGuide(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  // Act: print it to A4, as the browser's "Salvar como PDF" would, background included.
  const pdfBytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

  // Assert: one or two pages; keep the PDF where it belongs.
  const pageCount = countPagesOfPdf(pdfBytes);
  await testInfo.attach('guia-do-operador.pdf', {
    body: pdfBytes,
    contentType: 'application/pdf',
  });
  expect(pageCount, 'the printed guide must have at least one page').toBeGreaterThan(0);
  expect(
    pageCount,
    'the guide must fit one A4 sheet, both sides: shorten the text or a picture',
  ).toBeLessThanOrEqual(mostPagesOfTheGuide);
  if (testInfo.project.metadata.savesThePrintedGuide === true) {
    writeFileSync(printedGuideFile, pdfBytes);
  }
});

test('shows exactly the pictures the screenshot script takes, six at most', () => {
  // Arrange: the picture files the screenshot script writes.
  const expectedPicturePaths = Object.values(picturesOfTheGuide).map(
    (fileName) => `imagens/${fileName}`,
  );

  // Act: read which pictures the guide shows.
  const picturePathsOfTheGuide = readPicturePathsOfTheGuide();

  // Assert: the same set, each once, at most six, and every file there.
  expect(
    [...picturePathsOfTheGuide].sort(),
    'the guide must show each picture of picturesOfTheGuide.ts once, and no other',
  ).toEqual([...expectedPicturePaths].sort());
  expect(
    picturePathsOfTheGuide.length,
    'the brief allows at most six pictures',
  ).toBeLessThanOrEqual(6);
  for (const fileName of Object.values(picturesOfTheGuide)) {
    expect(
      existsSync(`${picturesFolder}${fileName}`),
      `imagens/${fileName} must exist: run the screenshot script`,
    ).toBe(true);
  }
});
