// Reads the first sheet of an .xlsx workbook into rows of cell values, with no dependency:
// an .xlsx file is a zip of XML parts, and Node's zlib inflates zip entries. Enough for the
// real sample data (enduro_passes.xlsx: numbers, shared strings, dates as day serials); it
// does not read formulas' text, styles or more than one sheet.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

// The zip's central directory lists every entry with its offset; its end record sits in the
// last 64 KB of the file and starts with the signature 0x06054b50.
function readZipEntries(zipBytes) {
  const searchStart = Math.max(0, zipBytes.length - 65557);
  let endRecord = -1;
  for (let offset = zipBytes.length - 22; offset >= searchStart; offset -= 1) {
    if (zipBytes.readUInt32LE(offset) === 0x06054b50) {
      endRecord = offset;
      break;
    }
  }
  if (endRecord === -1) throw new Error('Not a zip file: no central directory.');
  const entryCount = zipBytes.readUInt16LE(endRecord + 10);
  let offset = zipBytes.readUInt32LE(endRecord + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    const method = zipBytes.readUInt16LE(offset + 10);
    const compressedSize = zipBytes.readUInt32LE(offset + 20);
    const nameLength = zipBytes.readUInt16LE(offset + 28);
    const extraLength = zipBytes.readUInt16LE(offset + 30);
    const commentLength = zipBytes.readUInt16LE(offset + 32);
    const localHeader = zipBytes.readUInt32LE(offset + 42);
    const name = zipBytes.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localHeader });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntryText(zipBytes, entry) {
  const nameLength = zipBytes.readUInt16LE(entry.localHeader + 26);
  const extraLength = zipBytes.readUInt16LE(entry.localHeader + 28);
  const dataStart = entry.localHeader + 30 + nameLength + extraLength;
  const data = zipBytes.subarray(dataStart, dataStart + entry.compressedSize);
  const bytes = entry.method === 0 ? data : inflateRawSync(data);
  return bytes.toString('utf8');
}

const decodeXml = (text) =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

/**
 * The first sheet's rows as objects keyed by the first row's values (the header); a cell is
 * a string (shared or inline text) or a number, and an empty row is left out.
 */
export function readXlsxSheet(filePath) {
  const zipBytes = readFileSync(filePath);
  const entries = readZipEntries(zipBytes);
  const sharedStringsEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings =
    sharedStringsEntry === undefined
      ? []
      : [...readZipEntryText(zipBytes, sharedStringsEntry).matchAll(/<si>(.*?)<\/si>/gs)].map(
          (match) =>
            decodeXml([...match[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')),
        );
  const sheet = readZipEntryText(zipBytes, entries.get('xl/worksheets/sheet1.xml'));
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>(.*?)<\/row>/gs)) {
    const cells = {};
    for (const cellMatch of rowMatch[1].matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs,
    )) {
      const [, column, attributes, body = ''] = cellMatch;
      const valueMatch = /<v>(.*?)<\/v>/s.exec(body);
      const inlineMatch = /<t[^>]*>(.*?)<\/t>/s.exec(body);
      if (attributes.includes('t="s"') && valueMatch)
        cells[column] = sharedStrings[Number(valueMatch[1])];
      else if (attributes.includes('t="inlineStr"') && inlineMatch)
        cells[column] = decodeXml(inlineMatch[1]);
      else if (valueMatch) cells[column] = Number(valueMatch[1]);
    }
    if (Object.keys(cells).length > 0) rows.push(cells);
  }
  const [headerRow, ...dataRows] = rows;
  const columns = Object.keys(headerRow);
  return dataRows.map((row) =>
    Object.fromEntries(columns.map((column) => [headerRow[column], row[column]])),
  );
}
