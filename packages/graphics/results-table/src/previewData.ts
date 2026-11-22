/**
 * The data preview.html shows and changes, and the browser tests open: the JSON in `?data=`
 * when there is one, or one of three pages of the Baja app as the results table shape
 * carries them (BAJAOVRLAY-83):
 * - 25SU's overall page during spoilers, as João's screenshot of 21 Nov shows it: no rank,
 *   Projeto and Total "SPOILERS", the rows in car order (seven columns; the numbers made up
 *   around the doc's one real row, packages/shared examples/bajaApp);
 * - 25SU's qualifying page (made up, resultado-25SU_CLE-prova.made-up.json): two laps in
 *   one cell, "%", "SIM"/"NÃO", "Larga em" ("1º", "-") (six columns);
 * - 26BR's real Enduro page (resultado-26BR_END.json, short names from equipes-26BR.json):
 *   38 teams, two pages.
 * Whether the data is valid is left to the graphic's own load(), so the preview shows
 * exactly the answer a renderer would get.
 */
import { ptBR } from './ptBR.js';
import type { ResultsTableData, ResultsTableEntry } from './resultsTableModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** One row of a page with the site's rank: rank, car, team, school, the cells. */
type RankedRow = [
  rank: number,
  carNumber: number,
  teamName: string,
  schoolName: string,
  cells: string[],
];

/** One row of a page during spoilers, with no rank: car, team, school, the cells. */
type UnrankedRow = [carNumber: number, teamName: string, schoolName: string, cells: string[]];

/** The overall page's value columns, as the site heads them. */
export const overallPageHeads = [
  'Segurança',
  'Projeto',
  'Dinâmicas',
  'Enduro',
  'Bônus 4x4',
  'Penalizações',
  'Total',
];

const overallRowsDuringSpoilers: UnrankedRow[] = [
  [1, 'Procobaja', 'UTFPR-CP', ['-20', 'SPOILERS', '203.44', '183.97', '0', '-25', 'SPOILERS']],
  [2, 'Sagui', 'UFPR', ['0', 'SPOILERS', '68.36', '259.92', '0', '', 'SPOILERS']],
  [3, 'Gralha Azul', 'UTFPR-PG', ['-15', 'SPOILERS', '74.06', '390.84', '80', '', 'SPOILERS']],
  [4, 'Sinuelo', 'FAHOR', ['-15', 'SPOILERS', '111.22', '324.63', '80', '', 'SPOILERS']],
  [5, 'Guaicurus', 'UFGD', ['-20', 'SPOILERS', '224.12', '17.75', '0', '', 'SPOILERS']],
  [6, 'Pelznickel', 'UNIFEBE', ['-20', 'SPOILERS', '119.36', '229.66', '0', '-10', 'SPOILERS']],
  [7, 'Imperador', 'UTFPR-CT', ['-20', 'SPOILERS', '137.29', '375.37', '150', '-10', 'SPOILERS']],
  [8, 'BajaSATC', 'SATC', ['-20', 'SPOILERS', '99.12', '364.27', '150', '-25', 'SPOILERS']],
  [9, 'Londribaja', 'UTFPR-LON', ['-5', 'SPOILERS', '216.7', '51.01', '80', '-25', 'SPOILERS']],
  [10, 'Coyote', 'UCS-CX', ['-5', 'SPOILERS', '171.67', '248.22', '150', '', 'SPOILERS']],
  [11, 'Tchê', 'UFRGS', ['-20', 'SPOILERS', '160.51', '363.36', '0', '', 'SPOILERS']],
  [12, 'Pato', 'UTFPR-PB', ['-15', 'SPOILERS', '226.19', '39.1', '0', '', 'SPOILERS']],
  [13, 'Bombaja', 'UFSM', ['0', 'SPOILERS', '164.62', '231.3', '0', '', 'SPOILERS']],
  [14, 'Univates', 'Univates', ['-15', 'SPOILERS', '196.87', '186.61', '80', '-25', 'SPOILERS']],
  [15, 'Bajagual', 'UCS-BG', ['-20', 'SPOILERS', '87.37', '388.58', '150', '', 'SPOILERS']],
  [16, 'CTJ', 'UFSC-JV', ['-15', 'SPOILERS', '161.92', '341.5', '150', '-25', 'SPOILERS']],
];

/** The qualifying page's value columns, as the site heads them. */
export const qualifyingPageHeads = [
  'Voltas',
  'Melhor volta',
  '% da média',
  'Classificado (≤115%)',
  'Larga em',
  'Pontos',
];

const qualifyingRows: RankedRow[] = [
  [1, 7, 'Imperador', 'UTFPR-CT', ['51.9 / 52.3', '51.9', '91.8%', 'SIM', '1º', '100']],
  [2, 5, 'Guaicurus', 'UFGD', ['52.7 / 53.0', '52.7', '93.2%', 'SIM', '2º', '94.5']],
  [3, 2, 'Sagui', 'UFPR', ['53.1', '53.1', '93.9%', 'SIM', '3º', '89']],
  [4, 11, 'Tchê', 'UFRGS', ['53.8 / 53.5', '53.5', '94.6%', 'SIM', '4º', '83.5']],
  [5, 9, 'Londribaja', 'UTFPR-LON', ['54.2', '54.2', '95.9%', 'SIM', '5º', '78']],
  [6, 16, 'CTJ', 'UFSC-JV', ['54.6 / 54.4', '54.4', '96.2%', 'SIM', '6º', '72.5']],
  [7, 1, 'Procobaja', 'UTFPR-CP', ['55.6 / 54.9', '54.9', '97.1%', 'SIM', '7º', '67']],
  [8, 13, 'Bombaja', 'UFSM', ['55.0 / 55.3', '55.0', '97.3%', 'SIM', '8º', '61.5']],
  [9, 8, 'BajaSATC', 'SATC', ['56.7 / 55.8', '55.8', '98.7%', 'SIM', '9º', '56']],
  [10, 3, 'Gralha Azul', 'UTFPR-PG', ['57.8 / 56.2', '56.2', '99.4%', 'SIM', '10º', '50.5']],
  [11, 15, 'Bajagual', 'UCS-BG', ['57.1', '57.1', '101.0%', 'SIM', '11º', '45']],
  [12, 10, 'Coyote', 'UCS-CX', ['59.6 / 58.1', '58.1', '102.8%', 'SIM', '12º', '39.5']],
  [13, 6, 'Pelznickel', 'UNIFEBE', ['58.9', '58.9', '104.2%', 'SIM', '13º', '34']],
  [14, 4, 'Sinuelo', 'FAHOR', ['61.0 / 60.4', '60.4', '106.8%', 'SIM', '14º', '28.5']],
  [15, 14, 'Univates', 'Univates', ['62.7 / 61.9', '61.9', '109.5%', 'SIM', '15º', '23']],
  [16, 12, 'Pato', 'UTFPR-PB', ['66.4', '66.4', '117.5%', 'NÃO', '-', '0']],
];

/** The Enduro page's value columns, as the site heads them. */
export const enduroPageHeads = ['Voltas', 'Pontos'];

const enduroRows: RankedRow[] = [
  [1, 6, 'Imperador', 'UTFPR', ['69', '400']],
  [2, 9, 'Caraubaja', 'UFERSA', ['69', '400']],
  [3, 7, 'Sinuelo', 'FAHOR', ['68', '394.2']],
  [4, 23, 'EESC', 'EESC', ['67', '388.41']],
  [5, 5, 'Poli', 'Poli', ['57', '330.43']],
  [6, 2, 'FEI', 'FEI', ['56', '324.64']],
  [7, 12, 'Car-Kará', 'UFRN', ['50', '289.86']],
  [8, 16, 'Forja', 'UFF-VR', ['50', '289.86']],
  [9, 53, 'ZABUMBAJA', 'UFRPE', ['49', '284.06']],
  [10, 8, 'Cactus', 'UFERSA', ['46', '266.67']],
  [11, 44, 'TEC Ilha', 'UNESP-IS', ['46', '266.67']],
  [12, 11, 'Parahybaja', 'UFCG', ['45', '260.87']],
  [13, 49, 'FHO', 'FHO', ['44', '255.07']],
  [14, 43, 'Velociraptor', 'UDESC', ['44', '255.07']],
  [15, 1, 'Baja UFMG', 'UFMG', ['43', '249.28']],
  [16, 14, 'Tuffão', 'UFF-Nit', ['39', '226.09']],
  [17, 17, 'Rampage', 'UFJF', ['38', '220.29']],
  [18, 28, 'Tatu', 'IFSP-Ser', ['37', '214.49']],
  [19, 33, 'PAC', 'UNESP-Bauru', ['36', '208.7']],
  [20, 31, 'Unicamp', 'UNICAMP', ['34', '197.1']],
  [21, 15, 'UFSCar', 'UFSCar', ['33', '191.3']],
  [22, 19, 'Piratas Cerrado', 'UnB', ['26', '150.72']],
  [23, 61, 'Pererecas', 'UFV', ['24', '139.13']],
  [24, 35, 'Carpoeira', 'UFBA', ['23', '133.33']],
  [25, 3, 'Komiketo', 'UFSJ', ['21', '121.74']],
  [26, 34, 'ITA', 'ITA', ['21', '121.74']],
  [27, 13, 'Cefast', 'CEFET-MG', ['20', '115.94']],
  [28, 26, 'Saci', 'UNIFEI', ['20', '115.94']],
  [29, 21, 'Mud Racing', 'FACENS', ['19', '110.14']],
  [30, 38, 'Tchê', 'UFRGS', ['18', '104.35']],
  [31, 4, 'Pato', 'UTFPR-PB', ['14', '81.16']],
  [32, 30, 'Mangue', 'UFPE', ['13', '75.36']],
  [33, 29, 'Buffalo', 'UFLA', ['13', '75.36']],
  [34, 32, 'Vitória', 'UFES', ['10', '57.97']],
  [35, 36, 'BAJAUEA', 'UEA', ['8', '46.38']],
  [36, 24, 'Sagui', 'UFPR', ['6', '34.78']],
  [37, 58, 'Maua', 'MAUA', ['6', '34.78']],
  [38, 47, 'Londribaja', 'UTFPR-Lon', ['2', '11.59']],
];

function buildRankedEntries(rows: RankedRow[]): ResultsTableEntry[] {
  return rows.map(([rank, carNumber, teamName, schoolName, cells]) => ({
    rank,
    carNumber,
    teamName,
    schoolName,
    cells,
  }));
}

/** 25SU's overall page during spoilers: no rank, the rows in car order. */
export function createOverallPageDuringSpoilers(): ResultsTableData {
  return {
    tableName: 'Geral',
    eventLine: ptBR.preview.sampleEventLine,
    columnHeads: [...overallPageHeads],
    entries: overallRowsDuringSpoilers.map(([carNumber, teamName, schoolName, cells]) => ({
      carNumber,
      teamName,
      schoolName,
      cells,
    })),
  };
}

/** 25SU's qualifying page, ranked by the site. */
export function createQualifyingPage(): ResultsTableData {
  return {
    tableName: 'Classificatória do Enduro',
    eventLine: ptBR.preview.sampleEventLine,
    columnHeads: [...qualifyingPageHeads],
    entries: buildRankedEntries(qualifyingRows),
  };
}

/** 26BR's Enduro page: 38 teams, two pages. */
export function createEnduroPage(): ResultsTableData {
  return {
    tableName: 'Enduro',
    eventLine: ptBR.preview.sampleEventLine,
    columnHeads: [...enduroPageHeads],
    entries: buildRankedEntries(enduroRows),
  };
}

/**
 * The data to load: the JSON in `?data=` when the address has one (a sentence when it is
 * not JSON), else the qualifying page.
 */
export function choosePreviewData(search: string): PreviewDataChoice {
  const dataText = new URLSearchParams(search).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createQualifyingPage() };
  }
  try {
    return { isReadable: true, data: JSON.parse(dataText) as unknown };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}
