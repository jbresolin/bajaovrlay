/**
 * The control page draws its text in its own bundled face, whatever fonts the machine has
 * (apps/control, Playwright; BAJAOVRLAY-71)
 *
 * What this module is for:
 *   The page used Tailwind's default stack, every face in it a system one: "Segoe UI" on the
 *   stream PC, then `sans-serif`, then four colour emoji faces. On João's WSL, once
 *   fonts-noto-color-emoji was installed, Chromium took Noto Color Emoji for every
 *   character that face carries (the space, the digits, "#" and "*", the bases of its keycap
 *   emoji), even with `sans-serif` before it: each space was as wide as an emoji, and
 *   triggerFieldsFitTheirBox's "Remover passo 1" was pushed out of its box. CI, without
 *   that font, was green. The page now bundles Inter and names it first. jsdom draws no
 *   text, so a real Chromium is asked, through the DevTools protocol, which face drew what.
 *
 * What these tests prove, on the console at 1024×768:
 *   - The page's font stack names "Inter Variable" first and the emoji faces last.
 *   - Every piece of text on the console made of Latin characters only (letters, digits,
 *     spaces, punctuation) is drawn by the bundled face and by no face of the machine;
 *     among them there are digits and spaces, the characters the emoji face took.
 *   - The face is loaded from the page's own address, never from a CDN: the stream PC may
 *     be offline at the track.
 *
 * What these tests deliberately do not cover:
 *   - Which characters the file holds; src/fonts/controlPageFontCoversPtBR.test.ts.
 *   - The six symbols the face lacks (← → ⋯ ▲ ▼ ☰), left to the machine's symbol faces.
 *   - That boxes still fit their text; triggerFieldsFitTheirBox.e2e.ts and the layout tests.
 */
import { expect, type Page, test } from '@playwright/test';

import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';
import { openControlPageAndWaitUntilConnected } from './previewTestSteps';

// The smallest screen the operator uses, the one the fit test failed on.
test.use({ viewport: { width: 1024, height: 768 } });

/** The face the page bundles, as its @font-face names it (src/index.css). */
const bundledFaceName = 'Inter Variable';
/**
 * How Chromium names that face when asked which face drew a text: by the family name in
 * the file, with a "web font" mark, where a face of the machine has none.
 */
const bundledFaceAsChromiumReportsIt = 'Inter (web font)';
/** The colour emoji faces, which must come last so they only draw what no other face has. */
const emojiFaceNames = [
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'Noto Color Emoji',
];

/** One piece of text on the page and the faces Chromium drew it with. */
type TextAndItsFaces = { text: string; faceNames: string[] };

/**
 * Asks Chromium which faces drew the text of every element that holds text and no other
 * element (so a button's word and its key hint are asked apart), whose text is made only
 * of Latin characters (U+0000–U+00FF and the punctuation block U+2000–U+206F, the ranges
 * of the bundled subset a page's words use), and that is set in the page's own stack (the
 * body's): text set in `font-mono` (the key hints "F1", "F2", ...) keeps the machine's own
 * monospace stack, which names no emoji face. An element not drawn reports no face and is
 * left out.
 */
async function listLatinTextsAndTheFacesThatDrewThem(page: Page): Promise<TextAndItsFaces[]> {
  await page.evaluate(() => {
    const pageFontStack = getComputedStyle(document.body).fontFamily;
    const isLatinOnly = (text: string) =>
      [...text].every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 0xff || (codePoint >= 0x2000 && codePoint <= 0x206f);
      });
    let elementNumber = 0;
    for (const element of document.body.querySelectorAll('*')) {
      const text = element.textContent ?? '';
      const holdsTextOnly = element.childElementCount === 0 && text.trim() !== '';
      const isSetInThePageStack = getComputedStyle(element).fontFamily === pageFontStack;
      if (holdsTextOnly && isSetInThePageStack && isLatinOnly(text)) {
        elementNumber += 1;
        element.setAttribute('data-font-check', String(elementNumber));
      }
    }
  });
  const devTools = await page.context().newCDPSession(page);
  await devTools.send('DOM.enable');
  await devTools.send('CSS.enable');
  const { root } = await devTools.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await devTools.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '[data-font-check]',
  });
  const textsAndFaces: TextAndItsFaces[] = [];
  for (const nodeId of nodeIds) {
    const { fonts } = await devTools.send('CSS.getPlatformFontsForNode', { nodeId });
    const { outerHTML } = await devTools.send('DOM.getOuterHTML', { nodeId });
    if (fonts.length > 0) {
      const text = outerHTML.replace(/<[^>]*>/g, '').slice(0, 60);
      const faceNames = fonts.map((font) =>
        font.isCustomFont ? `${font.familyName} (web font)` : font.familyName,
      );
      textsAndFaces.push({ text, faceNames });
    }
  }
  await devTools.detach();
  return textsAndFaces;
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test('names the bundled face first and the emoji faces last in the page’s font stack', async ({
  page,
}) => {
  // Arrange: the console, connected.
  await openControlPageAndWaitUntilConnected(page);

  // Act: read the font stack the page's body is set in, one face per entry.
  const bodyFontStack = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const faceNames = bodyFontStack.split(',').map((entry) => entry.trim().replace(/^"|"$/g, ''));

  // Assert: Inter first, the four emoji faces at the end.
  expect(faceNames[0], 'the bundled face must be the first the page asks for').toBe(
    bundledFaceName,
  );
  expect(faceNames.slice(-emojiFaceNames.length), 'the emoji faces must be the last').toEqual(
    emojiFaceNames,
  );
});

test('draws every letter, digit and space of the console in the bundled face', async ({ page }) => {
  // Arrange: an "Atalhos" lower third whose label has digits, the console connected and
  // its shortcut shown, with every face the page asked for loaded.
  await sendCommandOrFail(realServerPort, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'lower-third',
    layerId: 'lower-third',
    label: 'Equipe 42 – Baja UFPR',
    fields: {
      name: { kind: 'literal', value: 'Baja UFPR' },
      role: { kind: 'literal', value: 'Equipe 42' },
    },
  });
  await openControlPageAndWaitUntilConnected(page);
  await expect(page.getByText('Equipe 42 – Baja UFPR'), 'the shortcut must be shown').toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // Act: ask Chromium which faces drew each piece of Latin text.
  const textsAndFaces = await listLatinTextsAndTheFacesThatDrewThem(page);

  // Assert: a console's worth of text, with digits and spaces, none of it in a face of the
  // machine.
  expect(textsAndFaces.length, 'the console must show many pieces of text').toBeGreaterThan(20);
  const allTextDrawn = textsAndFaces.map(({ text }) => text).join(' ');
  expect(allTextDrawn, 'the console must show digits, the emoji face took them').toMatch(/\d/);
  expect(allTextDrawn, 'the console must show words with spaces between them').toMatch(/\S \S/);
  const textsDrawnInAnotherFace = textsAndFaces.filter(({ faceNames }) =>
    faceNames.some((faceName) => faceName !== bundledFaceAsChromiumReportsIt),
  );
  expect(
    textsDrawnInAnotherFace,
    'no letter, digit or space may be drawn by a face the machine happens to have',
  ).toEqual([]);
});

test('loads the face from the page’s own address, never from a CDN', async ({ page }) => {
  // Arrange: note every font file asked for, and whether the console's own page (not the
  // program monitor's frame, the renderer, which loads the on-air Bebas Neue) asked for it.
  const fontFilesAskedFor: { address: string; isAskedForByTheConsole: boolean }[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') {
      const isAskedForByTheConsole = response.frame() === page.mainFrame();
      fontFilesAskedFor.push({ address: response.url(), isAskedForByTheConsole });
    }
  });

  // Act: open the console and wait until its faces are loaded.
  await openControlPageAndWaitUntilConnected(page);
  await page.evaluate(() => document.fonts.ready);
  const pageOrigin = new URL(page.url()).origin;

  // Assert: the console asked for the bundled Inter alone, and every font file, the
  // monitor's included, came from the page's own address.
  const fileNamesAskedForByTheConsole = fontFilesAskedFor
    .filter(({ isAskedForByTheConsole }) => isAskedForByTheConsole)
    .map(({ address }) => new URL(address).pathname.split('/').at(-1));
  expect(fileNamesAskedForByTheConsole, 'the console must load the bundled Inter alone').toEqual([
    expect.stringMatching(/^inter-latin-wght-normal.*\.woff2$/),
  ]);
  const addressesFromElsewhere = fontFilesAskedFor
    .map(({ address }) => address)
    .filter((address) => new URL(address).origin !== pageOrigin);
  expect(addressesFromElsewhere, 'no font may come from another address').toEqual([]);
});
