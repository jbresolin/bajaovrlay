// Reads a CSV file into objects keyed by its header row, for the real sample data in
// docs/design/sample_data/results. Lenient on purpose: a quote inside a quoted field that is
// not followed by a comma or the end of the line is kept as a literal quote, because the
// exports carry such fields (teams.csv, team 11: "Universidade Estadual Paulista "Júlio de
// Mesquita Filho" "UNESP"").
import { readFileSync } from 'node:fs';

function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let isInsideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (!isInsideQuotes) {
      if (character === '"' && field === '') isInsideQuotes = true;
      else if (character === ',') {
        fields.push(field);
        field = '';
      } else field += character;
      continue;
    }
    if (character !== '"') {
      field += character;
      continue;
    }
    const characterAfterNext = line[index + 2];
    if (nextCharacter === '"' && (characterAfterNext === ',' || characterAfterNext === undefined)) {
      // `""` closing the field: a literal quote, then the closing one (team 11's "UNESP"").
      field += '"';
      isInsideQuotes = false;
      index += 1;
    } else if (nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (nextCharacter === ',' || nextCharacter === undefined) {
      isInsideQuotes = false;
    } else {
      field += '"';
    }
  }
  fields.push(field);
  return fields;
}

/** The rows of a CSV file as objects keyed by the header's names, every value trimmed. */
export function readCsvFile(filePath) {
  const lines = readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  const header = splitCsvLine(lines[0]).map((name) => name.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(header.map((name, index) => [name, (values[index] ?? '').trim()]));
  });
}
