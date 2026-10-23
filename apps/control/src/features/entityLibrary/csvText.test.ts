/**
 * Reading and writing CSV text (apps/control)
 *
 * What this module is for:
 *   The Cadastros page imports and exports each tab as CSV (BAJAOVRLAY-19). A file comes
 *   from a spreadsheet: Excel in pt-BR separates cells with ";", other tools with ",",
 *   cells may be quoted, and Excel adds a byte-order mark. The reader takes all of that
 *   and keeps each row's line number, so the preview can say "linha 4". The writer
 *   writes what Excel in pt-BR opens as columns: ";", a byte-order mark, quotes where a
 *   cell needs them.
 *
 * What these tests prove:
 *   - Rows separated by ";" and by "," are read, the separator taken from the header.
 *   - A quoted cell may hold the separator, a doubled quote and a line break; the row's
 *     line number is the line it starts on.
 *   - A byte-order mark, CRLF line ends and blank lines are taken in stride.
 *   - The writer puts a byte-order mark first, separates with ";", quotes a cell with a
 *     ";", a quote or a line break, and what it writes reads back the same.
 *
 * What these tests deliberately do not cover:
 *   - What the cells mean; entityCsvImport.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readCsvText, writeCsvText } from './csvText';

describe('readCsvText', () => {
  it('reads rows separated by ";" with their line numbers', () => {
    // Arrange: two teams as Excel in pt-BR saves them.
    const text = 'carro;equipe\n42;Baja UFPR\n7;Juriti Off-Road\n';

    // Act: read it.
    const rows = readCsvText(text);

    // Assert: the header on line 1, then each team on its line.
    expect(rows, 'the rows with their line numbers').toEqual([
      { lineNumber: 1, cells: ['carro', 'equipe'] },
      { lineNumber: 2, cells: ['42', 'Baja UFPR'] },
      { lineNumber: 3, cells: ['7', 'Juriti Off-Road'] },
    ]);
  });

  it('reads rows separated by "," when the header has no ";"', () => {
    // Arrange: the same teams, from a tool that uses commas.
    const text = 'carro,equipe\n42,Baja UFPR\n';

    // Act: read it.
    const rows = readCsvText(text);

    // Assert: split on the comma.
    expect(
      rows.map((row) => row.cells),
      'the cells',
    ).toEqual([
      ['carro', 'equipe'],
      ['42', 'Baja UFPR'],
    ]);
  });

  it('reads a quoted cell with a separator, a doubled quote and a line break', () => {
    // Arrange: a place with a ";" and a quote, a name across two lines, then a team.
    const text =
      'id;sessao;local\n' +
      'premiacao;"Premiação ""geral""";"Palco; área\ncoberta"\n' +
      'enduro;Enduro;Pista\n';

    // Act: read it.
    const rows = readCsvText(text);

    // Assert: one cell each; the next row starts on line 4, after the line break.
    expect(rows, 'quoted cells read whole').toEqual([
      { lineNumber: 1, cells: ['id', 'sessao', 'local'] },
      { lineNumber: 2, cells: ['premiacao', 'Premiação "geral"', 'Palco; área\ncoberta'] },
      { lineNumber: 4, cells: ['enduro', 'Enduro', 'Pista'] },
    ]);
  });

  it('takes a byte-order mark, CRLF line ends and blank lines in stride', () => {
    // Arrange: a file as Excel on Windows writes it, with a blank line in the middle.
    const text = '﻿carro;equipe\r\n42;Baja UFPR\r\n\r\n7;Juriti Off-Road\r\n';

    // Act: read it.
    const rows = readCsvText(text);

    // Assert: no mark in the first cell, no blank row, the last team on line 4.
    expect(rows, 'the rows').toEqual([
      { lineNumber: 1, cells: ['carro', 'equipe'] },
      { lineNumber: 2, cells: ['42', 'Baja UFPR'] },
      { lineNumber: 4, cells: ['7', 'Juriti Off-Road'] },
    ]);
  });
});

describe('writeCsvText', () => {
  it('writes a byte-order mark, ";" between cells and quotes where needed', () => {
    // Arrange: a header and a row whose place holds a ";" and a quote.
    const header = ['id', 'sessao', 'local'];
    const rows = [['premiacao', 'Premiação', 'Palco "A"; coberto']];

    // Act: write it.
    const text = writeCsvText(header, rows);

    // Assert: the mark first, CRLF line ends, the one cell quoted.
    expect(text, 'what Excel in pt-BR opens as columns').toBe(
      '﻿id;sessao;local\r\npremiacao;Premiação;"Palco ""A""; coberto"\r\n',
    );
  });

  it('writes what reads back the same', () => {
    // Arrange: cells with every character that needs care.
    const header = ['id', 'nome'];
    const rows = [
      ['narrador-joao', 'João "JB" Bresolin'],
      ['juiz-1', 'Carla; Menezes\nsegunda linha'],
    ];

    // Act: write it, then read it again.
    const cellsReadBack = readCsvText(writeCsvText(header, rows)).map((row) => row.cells);

    // Assert: the same cells.
    expect(cellsReadBack, 'a round trip keeps every cell').toEqual([header, ...rows]);
  });
});
