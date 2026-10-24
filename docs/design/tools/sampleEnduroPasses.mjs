// Reads the enduro's passes (docs/design/sample_data/results/enduro_passes.xlsx: Carro,
// Volta, hora que passou, Tempo de volta) into the compact form enduroTiming.js works on:
// [carNumber, lap, msAfterMidnight, lapTimeMs or null], in the order of the sheet. The
// sheet writes moments and lap times as day fractions (Excel serials); lap 0 is the start,
// with "---" for its lap time.
import { resolve } from 'node:path';

import { readXlsxSheet } from './readXlsxSheet.mjs';

const dayInMs = 24 * 60 * 60 * 1000;

/** The passes, the start (the moment of lap 0) and the last crossing, in ms after midnight. */
export function readEnduroPasses() {
  const rows = readXlsxSheet(resolve('docs/design/sample_data/results/enduro_passes.xlsx'));
  const passes = rows.map((row) => {
    const dayFraction = row['hora que passou'] - Math.floor(row['hora que passou']);
    const crossedAtMs = Math.round(dayFraction * dayInMs);
    const lapTime = row['Tempo de volta'];
    const lapTimeMs = typeof lapTime === 'number' ? Math.round(lapTime * dayInMs) : null;
    return [row.Carro, row.Volta, crossedAtMs, lapTimeMs];
  });
  const startMs = Math.min(...passes.filter((pass) => pass[1] === 0).map((pass) => pass[2]));
  const lastCrossingMs = Math.max(...passes.map((pass) => pass[2]));
  const firstSerial = rows[0]['hora que passou'];
  const dayStartMs = Date.UTC(1899, 11, 30) + Math.floor(firstSerial) * dayInMs;
  return { passes, startMs, lastCrossingMs, dayStartMs };
}
