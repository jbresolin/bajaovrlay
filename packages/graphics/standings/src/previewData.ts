/**
 * The data preview.html shows and changes: the JSON in `?data=` when there is one, or the
 * real overall standings of the 30th Baja SAE Brasil (docs/design/sample_data/results/
 * overall.csv: 54 teams, the four "Desclassificada" last, SEG. and PEN. negative, a blank
 * 4X4 shown "—"), with the team names and schools the design pages use
 * (docs/design/sample-data.json); the same teams with the total alone; and the enduro's
 * own table (33 teams, ties sharing a rank). Whether the data is valid is left to the
 * graphic's own load(), so the preview shows exactly the answer a renderer would get.
 * The browser tests open the preview with these same samples.
 */
import { ptBR } from './ptBR.js';
import type { ScorePart, StandingsData, StandingsEntry } from './standingsModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The overall score's parts in the export's order, labelled as the design's table heads them. */
export const overallScoreParts: ScorePart[] = [
  { partId: 'projeto', label: 'PROJETO' },
  { partId: 'dinamicas', label: 'DINÂM.' },
  { partId: 'enduro', label: 'ENDURO' },
  { partId: 'bonus4x4', label: '4X4' },
  { partId: 'seguranca', label: 'SEG.' },
  { partId: 'penalidade', label: 'PEN.' },
];

/** A part the export leaves blank for a team: the board shows "—". */
const blank = undefined;
/** The rank of a disqualified team: none ("Desclassificada" in the export). */
const disqualified = 'disqualified';

/** One line of overall.csv: rank, car, team, school, total, then the parts in the order above. */
type OverallExportRow = [
  rank: number | typeof disqualified,
  carNumber: number,
  teamName: string,
  schoolName: string,
  points: number,
  partPoints: Array<number | undefined>,
];

const overallExportRows: OverallExportRow[] = [
  [1, 2, 'Baja UFMG', 'UFMG', 921.8, [246.81, 227.49, 312.5, 150, -15, 0]],
  [2, 1, 'Equipe FEI Baja', 'FEI', 903.48, [235.55, 157.93, 375, 150, -15, 0]],
  [3, 10, 'Equipe Komiketo Baja', 'UFSJ', 891.59, [234.37, 147.22, 375, 150, -15, 0]],
  [4, 47, 'Pato Baja', 'UTFPR-PB', 889.75, [211.96, 167.79, 375, 150, -15, 0]],
  [5, 5, 'Poli Baja', 'Poli', 811.78, [243.39, 138.39, 300, 150, -20, 0]],
  [6, 8, 'Imperador', 'UTFPR-CWB', 802.48, [217.27, 162.71, 287.5, 150, -15, 0]],
  [7, 51, 'Sinuelo', 'FAHOR', 796.27, [138.03, 128.24, 400, 150, -20, 0]],
  [8, 13, 'Equipe Cactus Baja', 'UFERSA-Mos', 772.15, [187.86, 109.29, 350, 150, -25, 0]],
  [9, 9, 'CaraubajaSAE', 'UFERSA-Car', 735.09, [133.54, 154.05, 312.5, 150, -15, 0]],
  [10, 17, 'Bombaja UFSM', 'UFSM', 734.7, [194.51, 168.94, 306.25, 80, -15, 0]],
  [11, 21, 'Equipe Parahybaja', 'UFCG', 698.41, [153.21, 143.95, 281.25, 150, -30, 0]],
  [12, 3, 'Baja de Galpão - UNISC', 'UNISC', 656.17, [220.27, 54.65, 231.25, 150, 0, 0]],
  [13, 18, 'Car-Kará Baja SAE', 'UFRN', 616.91, [187.05, 151.11, 243.75, 80, -20, -25]],
  [14, 23, 'CEFAST BAJA SAE', 'CEFET-MG', 591.41, [186.6, 88.56, 181.25, 150, -15, 0]],
  [15, 28, 'Tuffão Baja SAE', 'UFF-Nit', 580.97, [177.7, 129.52, 143.75, 150, -20, 0]],
  [16, 24, 'Baja UFSCar', 'UFSCar', 550.86, [155.26, 66.85, 193.75, 150, -15, 0]],
  [17, 16, 'Forja Baja', 'UFF-VR', 526.84, [152.01, 64.83, 325, blank, -15, 0]],
  [18, 6, 'RAMPAGE BAJA UFJF', 'UFJF', 498.81, [216.39, 59.92, 87.5, 150, -15, 0]],
  [19, 36, 'Zebu Baja UFTM', 'UFTM', 476.92, [141.35, 68.07, 137.5, 150, -20, 0]],
  [20, 12, 'Kaizen Piratas do Cerrado', 'UnB', 462.57, [181.48, 104.84, 206.25, 0, -30, 0]],
  [21, 7, 'Reptiles Baja PUC-Rio', 'PUC-Rio', 451.14, [162.94, 96.95, 206.25, 0, -15, 0]],
  [22, 44, 'UFPBaja', 'UFPB', 375.04, [112.4, 121.39, 181.25, blank, -40, 0]],
  [23, 27, 'Baja Mud Racing', 'FACENS', 368.45, [100.22, 83.23, 200, blank, -15, 0]],
  [24, 19, 'ProcoBaja', 'UTFPR-CP', 364.96, [163.52, 92.69, 43.75, 80, -15, 0]],
  [25, 33, 'Corsários Baja', 'IFMG', 344.88, [112.27, 76.36, 181.25, blank, -25, 0]],
  [26, 32, 'Corisco Baja', 'UPE', 313.51, [114.85, 43.66, 175, blank, -20, 0]],
  [27, 29, 'Equipe UFSC Baja', 'UFSC-Fln', 269.07, [103.15, 147.17, 43.75, blank, -25, 0]],
  [28, 22, 'EESC USP TRACTIAN Baja', 'EESC', 235.69, [235.69, 0, 0, blank, 0, 0]],
  [29, 49, 'Baja Guaicurus', 'UFGD', 230.85, [97.01, 111.34, 37.5, blank, -15, 0]],
  [30, 31, 'Sagui Baja', 'UFPR', 222.78, [131.64, 88.64, 37.5, blank, -35, 0]],
  [31, 50, 'Mud Runner', 'CEFET-RJ', 216.41, [134.98, 66.43, 50, blank, -35, 0]],
  [32, 20, 'Saci baja SAE UNIFEI', 'UNIFEI', 171.66, [186.66, 0, 0, blank, -15, 0]],
  [33, 40, 'Gralha Azul', 'UTFPR-PG', 125.52, [50.52, 0, 0, 80, -5, 0]],
  [34, 39, 'CTJ Baja', 'UFSC-Jvl', 116.28, [71.11, 50.17, 25, blank, -30, 0]],
  [35, 38, 'Tatu Baja', 'IFSP-Ser', 115.17, [11.17, 70.25, 68.75, blank, -35, 0]],
  [36, 34, 'Buffalo Baja - UFLA', 'UFLA', 106.45, [109.09, 16.11, 31.25, blank, -50, 0]],
  [37, 4, 'Mangue Baja', 'UFPB', 100.63, [100.63, 0, 0, 0, 0, 0]],
  [38, 15, 'Unicamp Baja SAE', 'UNICAMP', 100.21, [105.21, 0, 0, blank, -5, 0]],
  [39, 25, 'Vitória Baja', 'UFES', 90.26, [95.26, 0, 0, blank, -5, 0]],
  [40, 11, 'PAC Baja', 'UNESP-Bauru', 90.15, [105.15, 0, 0, 0, -15, 0]],
  [41, 52, 'ITA Baja', 'ITA', 76.52, [116.52, 0, 0, blank, -40, 0]],
  [42, 54, 'UnBaja', 'UnB', 74.88, [109.88, 0, 0, blank, -35, 0]],
  [43, 45, 'Carpoeira Baja', 'UFBA', 74.59, [79.59, 0, 0, blank, -5, 0]],
  [44, 37, 'Minerva Baja', 'UFRJ', 73.04, [88.04, 0, 0, blank, -15, 0]],
  [45, 41, 'BAJAUEA', 'UEA', 59.72, [94.72, 0, 0, blank, -35, 0]],
  [46, 35, 'Piratas do Vale', 'UNESP-Guara', 56.4, [61.4, 0, 0, blank, -5, 0]],
  [47, 56, 'Equipe BAJA SAE UEM - Capibaja', 'UEM', 56.26, [66.26, 0, 0, blank, -10, 0]],
  [48, 14, 'Tchê Baja', 'UFRGS', 55.93, [65.93, 0, 0, 0, -10, 0]],
  [49, 43, 'BAJA Griffon', 'IFF', 33.33, [43.33, 0, 0, blank, -10, 0]],
  [50, 58, 'CajaBaja', 'IFPB', 32.34, [42.34, 0, 0, blank, -10, 0]],
  [disqualified, 30, 'Caledônia Racing Baja SAE', 'UERJ', 0, [0, 0, 0, blank, -5, 0]],
  [disqualified, 42, 'Garra Baja', 'USJT', 0, [0, 0, 0, blank, -5, 0]],
  [disqualified, 48, 'Baja Unileste', 'UNILESTE', 0, [0, 0, 0, blank, -5, 0]],
  [disqualified, 57, 'Equipistão', 'UniFAJ', 0, [0, 0, 0, blank, -10, 0]],
];

/** One line of the enduro's table: rank (ties share it), car, team, school, points. */
type EventRow = [
  rank: number,
  carNumber: number,
  teamName: string,
  schoolName: string,
  points: number,
];

const enduroRows: EventRow[] = [
  [1, 51, 'Sinuelo', 'FAHOR', 400],
  [2, 1, 'Equipe FEI Baja', 'FEI', 375],
  [2, 10, 'Equipe Komiketo Baja', 'UFSJ', 375],
  [2, 47, 'Pato Baja', 'UTFPR-PB', 375],
  [5, 13, 'Equipe Cactus Baja', 'UFERSA-Mos', 350],
  [6, 16, 'Forja Baja', 'UFF-VR', 325],
  [7, 2, 'Baja UFMG', 'UFMG', 312.5],
  [7, 9, 'CaraubajaSAE', 'UFERSA-Car', 312.5],
  [9, 17, 'Bombaja UFSM', 'UFSM', 306.25],
  [10, 5, 'Poli Baja', 'Poli', 300],
  [11, 8, 'Imperador', 'UTFPR-CWB', 287.5],
  [12, 21, 'Equipe Parahybaja', 'UFCG', 281.25],
  [13, 18, 'Car-Kará Baja SAE', 'UFRN', 243.75],
  [14, 3, 'Baja de Galpão - UNISC', 'UNISC', 231.25],
  [15, 12, 'Kaizen Piratas do Cerrado', 'UnB', 206.25],
  [15, 7, 'Reptiles Baja PUC-Rio', 'PUC-Rio', 206.25],
  [17, 27, 'Baja Mud Racing', 'FACENS', 200],
  [18, 24, 'Baja UFSCar', 'UFSCar', 193.75],
  [19, 23, 'CEFAST BAJA SAE', 'CEFET-MG', 181.25],
  [19, 44, 'UFPBaja', 'UFPB', 181.25],
  [19, 33, 'Corsários Baja', 'IFMG', 181.25],
  [22, 32, 'Corisco Baja', 'UPE', 175],
  [23, 28, 'Tuffão Baja SAE', 'UFF-Nit', 143.75],
  [24, 36, 'Zebu Baja UFTM', 'UFTM', 137.5],
  [25, 6, 'RAMPAGE BAJA UFJF', 'UFJF', 87.5],
  [26, 38, 'Tatu Baja', 'IFSP-Ser', 68.75],
  [27, 50, 'Mud Runner', 'CEFET-RJ', 50],
  [28, 19, 'ProcoBaja', 'UTFPR-CP', 43.75],
  [28, 29, 'Equipe UFSC Baja', 'UFSC-Fln', 43.75],
  [30, 49, 'Baja Guaicurus', 'UFGD', 37.5],
  [30, 31, 'Sagui Baja', 'UFPR', 37.5],
  [32, 34, 'Buffalo Baja - UFLA', 'UFLA', 31.25],
  [33, 39, 'CTJ Baja', 'UFSC-Jvl', 25],
];

/** Turns one export line into an entry of the canonical standings shape. */
function readOverallExportRow(row: OverallExportRow): StandingsEntry {
  const [rank, carNumber, teamName, schoolName, points, partPoints] = row;
  const pointsByPart: Record<string, number> = {};
  overallScoreParts.forEach((scorePart, partIndex) => {
    const partValue = partPoints[partIndex];
    if (partValue !== undefined) {
      pointsByPart[scorePart.partId] = partValue;
    }
  });
  if (rank === disqualified) {
    return { carNumber, teamName, schoolName, points, pointsByPart, isDisqualified: true };
  }
  return { rank, carNumber, teamName, schoolName, points, pointsByPart };
}

/** The 54 teams of the overall standings, the four disqualified last. */
export function createOverallStandingsEntries(): StandingsEntry[] {
  return overallExportRows.map(readOverallExportRow);
}

/** The overall table with its six parts: three pages of 20 (the preview starts here). */
export function createOverallStandingsWithParts(): StandingsData {
  return {
    entries: createOverallStandingsEntries(),
    scoreParts: overallScoreParts,
    title: ptBR.defaultTitle,
    eventLine: ptBR.preview.sampleEventLine,
  };
}

/** The same 54 teams with the total alone: the board in three columns. */
export function createOverallStandingsTotalOnly(): StandingsData {
  const entriesWithoutParts = createOverallStandingsEntries().map((entry) => {
    const entryWithoutParts = { ...entry };
    delete entryWithoutParts.pointsByPart;
    return entryWithoutParts;
  });
  return {
    entries: entriesWithoutParts,
    scoreParts: [],
    title: ptBR.defaultTitle,
    eventLine: ptBR.preview.sampleEventLine,
  };
}

/** The enduro's own table, 33 teams with ties: the board in columns, as standings-por-prova. */
export function createEnduroStandings(): StandingsData {
  const entries = enduroRows.map(([rank, carNumber, teamName, schoolName, points]) => ({
    rank,
    carNumber,
    teamName,
    schoolName,
    points,
  }));
  return {
    entries,
    scoreParts: [],
    title: ptBR.preview.enduroTitle,
    eventLine: ptBR.preview.sampleEventLine,
  };
}

/**
 * Disqualifies the team in row `rowNumber` (from 1) the way the source would send it: no
 * rank, "DESCL." as its total, moved after every other team. The ranks of the others are
 * left as they were (the preview does not re-rank). The list given is never changed.
 */
export function disqualifyTeamInRow(
  entries: readonly StandingsEntry[],
  rowNumber: number,
): StandingsEntry[] {
  const teamToDisqualify = entries[rowNumber - 1];
  if (teamToDisqualify === undefined) {
    return [...entries];
  }
  const disqualifiedTeam: StandingsEntry = { ...teamToDisqualify, isDisqualified: true };
  delete disqualifiedTeam.rank;
  const otherTeams = entries.filter((_entry, index) => index !== rowNumber - 1);
  return [...otherTeams, disqualifiedTeam];
}

/** Reads `?data=` from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createOverallStandingsWithParts() };
  }
  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}
