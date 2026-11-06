/**
 * "Exportar CSV" of the history (apps/control)
 *
 * What this module is for:
 *   The "Histórico" page hands over exactly the rows its filters show as a CSV, written
 *   like the Cadastros CSVs, so the producer can file the day's log or open it in a
 *   spreadsheet after the show (BAJAOVRLAY-30).
 *
 * What these tests prove:
 *   - The text opens with UTF-8's byte-order mark, separates cells with ";" and ends lines
 *     with CRLF; its header is "Linha;Data e hora;Quem;O que aconteceu;Recusado".
 *   - Each row carries its number, its moment on the operator's clock, who sent it, the
 *     sentence (put in quotes, since it holds quotes) and "sim" or "não" for a refusal.
 *
 * What these tests deliberately do not cover:
 *   - Which rows the filters keep; HistoryPage.test.tsx.
 *   - Quoting rules in general; entityLibrary's csvText.test.ts.
 */
import type { DescribedEventLogEntry } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { writeHistoryCsvText } from './historyCsv';

/** Two rows as the page shows them: Companion's take, and a refused take of the operator. */
function buildTwoRowsShown(): DescribedEventLogEntry[] {
  return [
    {
      id: 44,
      ts: '2026-11-05T14:03:00.000Z',
      who: { kind: 'operador', label: 'Operador' },
      sentence: 'Recusado: Tomou item excluído (item-tarja-apagada) — O item não existe.',
      isRefusal: true,
      group: 'takesAndClears',
      layerIds: [],
    },
    {
      id: 42,
      ts: '2026-11-05T14:01:00.000Z',
      who: { kind: 'api', label: 'API · companion' },
      sentence: 'Tomou "Tarja – Ana Souza" na camada Tarja (Programa)',
      isRefusal: false,
      group: 'takesAndClears',
      layerIds: ['lower-third'],
    },
  ];
}

/** The moment as the operator's clock writes it, so the test holds in any time zone. */
function writeMomentAsTheClockDoes(isoMoment: string): string {
  return new Date(isoMoment).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

describe('writeHistoryCsvText', () => {
  it('writes the rows shown as a pt-BR spreadsheet reads them', () => {
    // Arrange: the two rows the page shows.
    const rowsShown = buildTwoRowsShown();

    // Act: write the CSV.
    const csvText = writeHistoryCsvText(rowsShown);

    // Assert: the mark, the header and the two rows, in the order shown.
    expect(csvText, 'the CSV must be what a pt-BR spreadsheet opens with its accents').toBe(
      '﻿' +
        'Linha;Data e hora;Quem;O que aconteceu;Recusado\r\n' +
        `44;${writeMomentAsTheClockDoes('2026-11-05T14:03:00.000Z')};Operador;` +
        'Recusado: Tomou item excluído (item-tarja-apagada) — O item não existe.;sim\r\n' +
        `42;${writeMomentAsTheClockDoes('2026-11-05T14:01:00.000Z')};API · companion;` +
        '"Tomou ""Tarja – Ana Souza"" na camada Tarja (Programa)";não\r\n',
    );
  });
});
