/**
 * CSV text in and out, by hand (the stack takes no CSV library for two short functions).
 * The rules are RFC 4180's: cells between separators, a cell in double quotes may hold
 * the separator, a line break and a quote written twice. On top of it, what a pt-BR
 * spreadsheet does: ";" as the separator, a byte-order mark at the start.
 */

/** One row read from a file: the line it starts on (the header is line 1) and its cells. */
export type CsvRow = { lineNumber: number; cells: string[] };

const byteOrderMark = '﻿';
const quote = '"';

/**
 * Reads CSV text into rows. The separator is ";" when the first line holds one, else ","
 * (Excel in pt-BR writes ";"; most other tools ","). A byte-order mark is dropped, CRLF
 * and LF both end a line, and a row whose cells are all empty is skipped. Each row keeps
 * the line it starts on, counting the line breaks inside quoted cells, so a reason can
 * say which line of the file to fix.
 */
export function readCsvText(text: string): CsvRow[] {
  const textWithoutMark = text.startsWith(byteOrderMark) ? text.slice(1) : text;
  const firstLine = textWithoutMark.split(/\r?\n/, 1)[0] ?? '';
  const separator = firstLine.includes(';') ? ';' : ',';

  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let isInsideQuotes = false;
  let lineNumber = 1;
  let lineNumberOfTheRow = 1;

  /** Ends the row being read, keeping it unless every cell is empty. */
  function endTheRow(): void {
    cells.push(cell);
    const isBlankRow = cells.every((cellText) => cellText.trim() === '');
    if (!isBlankRow) {
      rows.push({ lineNumber: lineNumberOfTheRow, cells });
    }
    cells = [];
    cell = '';
  }

  for (let index = 0; index < textWithoutMark.length; index += 1) {
    const character = textWithoutMark[index];
    const nextCharacter = textWithoutMark[index + 1];
    if (isInsideQuotes) {
      if (character === quote && nextCharacter === quote) {
        cell += quote;
        index += 1;
      } else if (character === quote) {
        isInsideQuotes = false;
      } else {
        if (character === '\n') {
          lineNumber += 1;
        }
        cell += character;
      }
      continue;
    }
    if (character === quote) {
      isInsideQuotes = true;
    } else if (character === separator) {
      cells.push(cell);
      cell = '';
    } else if (character === '\r' && nextCharacter === '\n') {
      // The \n that follows ends the row.
    } else if (character === '\n') {
      endTheRow();
      lineNumber += 1;
      lineNumberOfTheRow = lineNumber;
    } else {
      cell += character;
    }
  }
  const hasAnUnfinishedRow = cell !== '' || cells.length > 0;
  if (hasAnUnfinishedRow) {
    endTheRow();
  }
  return rows;
}

/**
 * Writes rows as CSV text for a pt-BR spreadsheet: a byte-order mark (so Excel reads the
 * accents as UTF-8), ";" between cells and CRLF at the end of each line. A cell holding a
 * ";", a quote or a line break is put in quotes, its quotes written twice.
 */
export function writeCsvText(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((cells) => cells.map(quoteCellWhenNeeded).join(';'));
  return `${byteOrderMark}${lines.map((line) => `${line}\r\n`).join('')}`;
}

/** The cell as written: in quotes when it holds a ";", a quote or a line break. */
function quoteCellWhenNeeded(cell: string): string {
  const needsQuotes = /[;"\r\n]/.test(cell);
  if (!needsQuotes) {
    return cell;
  }
  return `${quote}${cell.replaceAll(quote, quote + quote)}${quote}`;
}
