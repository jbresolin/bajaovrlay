// The operator guide as a page to print (BAJAOVRLAY-31): guia-do-operador.md turned into
// HTML with marked, with the print stylesheet guia-impressao.css and every picture inlined, so
// the page can be loaded with page.setContent() and printed to an A4 PDF by Chromium.
// What could go wrong: a picture linked by its path would not load in a page set from a
// string (it has no address to resolve the path against), and would print as a blank box;
// inlining each one as a data: address avoids that.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Marked } from 'marked';

const guideFolder = fileURLToPath(new URL('./', import.meta.url));
const guideFile = `${guideFolder}guia-do-operador.md`;
const printStylesheetFile = `${guideFolder}guia-impressao.css`;
// The control page's bundled Inter (BAJAOVRLAY-71): the guide prints in it on every machine,
// so the page count the check measures is the same on CI as here. A face of the machine
// would be wider or narrower, and could push the guide onto a third page on one of them.
const bundledInterFile = fileURLToPath(
  new URL('../../apps/control/src/fonts/inter/inter-latin-wght-normal.woff2', import.meta.url),
);

// A picture of the guide, as the Markdown writes it: imagens/<name>.png.
const picturePathPattern = /^imagens\/[a-z-]+\.png$/;

/** The path of every picture the guide shows, in order (`imagens/console.png`). */
export function readPicturePathsOfTheGuide(): string[] {
  const markdownText = readFileSync(guideFile, 'utf8');
  const picturePaths: string[] = [];
  for (const match of markdownText.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    // The pattern's one group always matches; the check is for the type only.
    const picturePath = match[1];
    if (picturePath !== undefined) {
      picturePaths.push(picturePath);
    }
  }
  return picturePaths;
}

/** A picture of the guide as a data: address, read from docs/operador/imagens/. */
function readPictureAsDataAddress(picturePath: string): string {
  if (!picturePathPattern.test(picturePath)) {
    throw new Error(`the guide's pictures live in imagens/ as .png files, not ${picturePath}`);
  }
  const pictureBytes = readFileSync(`${guideFolder}${picturePath}`);
  return `data:image/png;base64,${pictureBytes.toString('base64')}`;
}

/**
 * The whole printable page: the guide's Markdown as HTML, in pt-BR, with the print
 * stylesheet and its pictures inlined. Throws when a picture is missing.
 */
export function buildPrintablePageOfTheGuide(): string {
  const markdownText = readFileSync(guideFile, 'utf8');
  const printStylesheet = readFileSync(printStylesheetFile, 'utf8');
  const bundledInterAsBase64 = readFileSync(bundledInterFile).toString('base64');
  const bundledInterFace = [
    '@font-face {',
    "  font-family: 'Inter';",
    `  src: url(data:font/woff2;base64,${bundledInterAsBase64}) format('woff2');`,
    '  font-weight: 100 900;',
    '}',
  ].join('\n');
  const markdownToHtml = new Marked({
    renderer: {
      // Each picture gets a class named after its file ("foto-console"), so the stylesheet
      // can give one picture more room than the others.
      image({ href, text }) {
        const pictureName = href.replace('imagens/', '').replace('.png', '');
        const dataAddress = readPictureAsDataAddress(href);
        return `<img class="foto-${pictureName}" src="${dataAddress}" alt="${text}">`;
      },
    },
  });
  const guideHtml = markdownToHtml.parse(markdownText, { async: false });
  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Guia do operador — BajaOvrLay</title>',
    `<style>${bundledInterFace}\n${printStylesheet}</style>`,
    '</head>',
    `<body>${guideHtml}</body>`,
    '</html>',
  ].join('\n');
}

/**
 * How many pages a PDF has: its page objects, each written `/Type /Page` (the page tree is
 * `/Type /Pages`, which is not counted). Chromium writes them uncompressed.
 */
export function countPagesOfPdf(pdfBytes: Buffer): number {
  const pdfText = pdfBytes.toString('latin1');
  const pageObjects = pdfText.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return pageObjects === null ? 0 : pageObjects.length;
}
