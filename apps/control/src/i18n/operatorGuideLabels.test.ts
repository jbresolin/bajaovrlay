/**
 * Every label the operator guide quotes is a label the operator can find (BAJAOVRLAY-31)
 *
 * What this module is for:
 *   docs/operador/guia-do-operador.md is the one printed sheet a volunteer runs a race day
 *   with, and docs/operador/ensaio.md the rehearsal that proves it. Both name buttons, tabs
 *   and messages by their exact words, always between straight double quotes ("Tomar").
 *   A label renamed in the code would leave the printed sheet pointing at a button that no
 *   longer exists, so this test reads both files and checks every quoted text against the
 *   pt-BR catalogs: the control page's (src/i18n/ptBR.ts), the server's
 *   (apps/server/src/core/messages/ptBR.ts: the seeded panels, items, layers and trigger)
 *   and the names of the graphics (each packages/graphics/<name>/*.ograf.json).
 *
 * What these tests prove:
 *   - Every quoted text in the guide and in the rehearsal is, word for word, a fixed text of
 *     one of those catalogs.
 *   - The reading works: it finds "Verificar servidor" in the guide, and it reports a quoted
 *     text no catalog holds.
 *
 * What these tests deliberately do not cover:
 *   - Texts the catalogs build from a value ("Fontes: 1 ok", "Passo 2 de 5"): the guide
 *     writes those without quotes, and nothing here checks them.
 *   - Whether the guide describes the page truly: the pictures are retaken from the real
 *     page (docs/operador/screenshots.e2e.ts), and the rehearsal is the real proof.
 *   - That the guide fits on two A4 pages: docs/operador/guidePrintsOnTwoPages.e2e.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ptBR as ptBRServer } from '../../../server/src/core/messages/ptBR';
import { ptBR as ptBRControlPage } from './ptBR';

// Paths from this file's folder: under jsdom, Vite would turn `new URL(..., import.meta.url)`
// into an address the page would fetch, not a path on the disk.
const repoRootFolder = join(import.meta.dirname, '..', '..', '..', '..');
const operatorGuideFile = join(repoRootFolder, 'docs', 'operador', 'guia-do-operador.md');
const rehearsalFile = join(repoRootFolder, 'docs', 'operador', 'ensaio.md');
const graphicsFolder = join(repoRootFolder, 'packages', 'graphics');

// A quoted label: straight double quotes around text on one line.
const quotedLabelPattern = /"([^"\n]+)"/g;

/** Every text between straight double quotes in a Markdown text, in order, repeats kept. */
function findQuotedLabels(markdownText: string): string[] {
  const labels: string[] = [];
  for (const match of markdownText.matchAll(quotedLabelPattern)) {
    // The pattern's one group always matches; the check is for the type only.
    const label = match[1];
    if (label !== undefined) {
      labels.push(label);
    }
  }
  return labels;
}

/**
 * Every fixed text of a catalog, at any depth. A text the catalog builds with a function
 * is left out on purpose: its words depend on the value it is given.
 */
function collectFixedTextsOfCatalog(catalogPart: unknown, texts: Set<string>): Set<string> {
  if (typeof catalogPart === 'string') {
    texts.add(catalogPart);
    return texts;
  }
  const isObjectOrList = typeof catalogPart === 'object' && catalogPart !== null;
  if (isObjectOrList) {
    for (const value of Object.values(catalogPart)) {
      collectFixedTextsOfCatalog(value, texts);
    }
  }
  return texts;
}

/** The name of every graphic, as its OGraf manifest gives it (what "Gráfico" lists). */
function readNamesOfEveryGraphic(): string[] {
  const names: string[] = [];
  for (const packageFolder of readdirSync(graphicsFolder, { withFileTypes: true })) {
    if (!packageFolder.isDirectory()) {
      continue;
    }
    const folder = join(graphicsFolder, packageFolder.name);
    const manifestFileNames = readdirSync(folder).filter((fileName) =>
      fileName.endsWith('.ograf.json'),
    );
    for (const manifestFileName of manifestFileNames) {
      const manifest = JSON.parse(readFileSync(join(folder, manifestFileName), 'utf8')) as {
        name: string;
      };
      names.push(manifest.name);
    }
  }
  return names;
}

/** Every label the operator can read: both catalogs' fixed texts and the graphics' names. */
function collectEveryLabelOfThePtBRCatalogs(): Set<string> {
  const labels = new Set<string>();
  collectFixedTextsOfCatalog(ptBRControlPage, labels);
  collectFixedTextsOfCatalog(ptBRServer, labels);
  for (const graphicName of readNamesOfEveryGraphic()) {
    labels.add(graphicName);
  }
  return labels;
}

/** The quoted labels of a Markdown text that no catalog holds, each once, in order. */
function findLabelsMissingFromTheCatalogs(markdownText: string, catalogLabels: Set<string>) {
  const missingLabels = findQuotedLabels(markdownText).filter((label) => !catalogLabels.has(label));
  return [...new Set(missingLabels)];
}

const documentsThatQuoteLabels = [
  // The printed sheet: the one a rename must never leave behind.
  { name: 'the operator guide', file: operatorGuideFile },
  // The rehearsal tells both volunteers which button to press at every step.
  { name: 'the rehearsal script', file: rehearsalFile },
];

describe('the labels quoted in the operator guide and the rehearsal', () => {
  it.each(documentsThatQuoteLabels)('are all labels of the pt-BR catalogs in $name', ({ file }) => {
    // Arrange: the document as written, and every label the catalogs hold.
    const markdownText = readFileSync(file, 'utf8');
    const catalogLabels = collectEveryLabelOfThePtBRCatalogs();

    // Act: look for quoted texts that no catalog holds.
    const missingLabels = findLabelsMissingFromTheCatalogs(markdownText, catalogLabels);

    // Assert: there are none.
    expect(
      missingLabels,
      'a quoted label must match a catalog word for word: fix the document, or write it without quotes if it is not a label',
    ).toEqual([]);
  });
});

describe('reading the quoted labels', () => {
  it('finds "Verificar servidor" in the guide and in the control page catalog', () => {
    // Arrange: the guide as written, and every label the catalogs hold.
    const markdownText = readFileSync(operatorGuideFile, 'utf8');
    const catalogLabels = collectEveryLabelOfThePtBRCatalogs();

    // Act: read the guide's quoted labels.
    const guideLabels = findQuotedLabels(markdownText);

    // Assert: the menu entry is among them and among the catalog's, so the test above is
    // not passing because it read nothing.
    expect(guideLabels, 'the guide quotes the menu entry "Verificar servidor"').toContain(
      'Verificar servidor',
    );
    expect(catalogLabels.has('Verificar servidor'), 'the catalog holds it').toBe(true);
  });

  it('reports a quoted label that no catalog holds, once, and passes the real ones', () => {
    // Arrange: a line that quotes two real labels and one made up, the made-up one twice.
    const markdownText =
      'Clique em "Tomar", depois em "Tomar agora mesmo" e de novo em "Tomar agora mesmo", e "Limpar".';
    const catalogLabels = collectEveryLabelOfThePtBRCatalogs();

    // Act: look for quoted texts that no catalog holds.
    const missingLabels = findLabelsMissingFromTheCatalogs(markdownText, catalogLabels);

    // Assert: only the made-up label, once.
    expect(missingLabels, 'only the label no catalog holds is reported').toEqual([
      'Tomar agora mesmo',
    ]);
  });

  it('counts the seeded trigger of the server and a graphic name as labels', () => {
    // Arrange: nothing beyond the catalogs and the graphics.

    // Act: collect every label.
    const catalogLabels = collectEveryLabelOfThePtBRCatalogs();

    // Assert: the server's seeded trigger and the race clock's name are there.
    expect(
      catalogLabels.has('Patrocinadores a cada 30 min'),
      'the trigger the server seeds is a label the operator reads',
    ).toBe(true);
    expect(
      catalogLabels.has('Relógio de prova'),
      'a graphic name is a label the item editor shows',
    ).toBe(true);
  });
});
