// Reads the real results exports in docs/design/sample_data/results (BAJAOVRLAY-43) into
// plain records for buildSampleData.mjs: the teams (teams.csv), the overall scores
// (overall.csv) and the enduro penalties (penalizacoes.csv). Text is kept as the exports
// write it, trimmed; nothing is corrected here (the README lists what looked wrong).
import { resolve } from 'node:path';

import { readCsvFile } from './readCsvFile.mjs';

const resultsFolder = resolve('docs/design/sample_data/results');

/**
 * The teams by car number: full and short team name, short and full school name, city,
 * state, and whether disqualified. The export's test row ("Teste Baja", school NULL) is left out.
 */
export function readTeams() {
  const rows = readCsvFile(resolve(resultsFolder, 'teams.csv')).filter(
    (row) => row.escola_curto !== 'NULL',
  );
  return new Map(
    rows.map((row) => [
      Number(row.equipe_id),
      {
        carNumber: Number(row.equipe_id),
        teamName: row.equipe,
        teamShortName: row.equipe_curto,
        schoolName: row.escola_curto,
        schoolFullName: row.escola,
        city: row.cidade,
        state: row.estado,
        isDisqualified: row.desclassificado === '1',
      },
    ]),
  );
}

/** The overall score's parts, in the order a standings table shows them, with captions. */
export const overallScoreParts = [
  { key: 'projeto', column: 'Projeto', label: 'PROJETO' },
  { key: 'dinamicas', column: 'Dinâmicas', label: 'DINÂM.' },
  { key: 'enduro', column: 'Enduro', label: 'ENDURO' },
  { key: 'bonus4x4', column: 'Bônus 4x4', label: '4X4' },
  { key: 'seguranca', column: 'Segurança', label: 'SEG.' },
  { key: 'penalidade', column: 'Penalidade', label: 'PEN.' },
];

/**
 * The overall standings in rank order: rank (a number; tied teams share it), car, total,
 * each part's points (undefined where the export leaves the cell empty), and whether the
 * team was disqualified ("Desclassificada").
 */
export function readOverallStandings() {
  const rows = readCsvFile(resolve(resultsFolder, 'overall.csv'));
  const toPoints = (text) => (text === '' ? undefined : Number(text));
  return rows
    .map((row) => ({
      rank: Number.parseInt(row['Colocação'], 10),
      carNumber: Number(row['Número']),
      points: Number(row.Total),
      pointsByPart: Object.fromEntries(
        overallScoreParts.map((part) => [part.key, toPoints(row[part.column])]),
      ),
      isDisqualified: row['Situação'] === 'Desclassificada',
    }))
    .sort((first, second) => first.rank - second.rank || first.carNumber - second.carNumber);
}

/**
 * The enduro penalties as the export writes them: the car number, the school (the export's
 * own, in capitals), the track sector ("onde"), the reason and the time added, and when it
 * was posted. "Desviar de obstáculo deliberadamente (2 min)" splits into the reason and "2 min".
 */
export function readPenalties() {
  return readCsvFile(resolve(resultsFolder, 'penalizacoes.csv')).map((row) => {
    const match = /^(.*?)\s*\((\d+ min)\)$/.exec(row['Penalização']);
    return {
      postedAt: row['Hora Lançada'],
      carNumber: Number(row['#']),
      schoolName: row.Escola,
      sector: row.Onde,
      reason: match ? match[1] : row['Penalização'],
      penaltyTime: match ? match[2] : '',
    };
  });
}
