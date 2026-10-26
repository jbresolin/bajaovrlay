/**
 * The data preview.html shows: the JSON in `?data=` when there is one, or a sample.
 * - The real Super Prime of the 30ª Competição (the default): the shared sample
 *   brackets.super-prime.json, made from docs/design/sample_data/results/super_prime.md,
 *   with the title the design pages give it. Its seven steps are bracket-passo-1 to -7.
 * - `?results=board` and `?results=tree`: the six states of sheet-bracket-results (a time,
 *   a best of 3, a plain win, a W.O. by absence, a W.O. with no opponent, undecided), as a
 *   round board of six matches and as a tree. The Super Prime had no timed results, so
 *   the timed rows use sample times, as the design's sheet does.
 * Whether the data is valid is left to the graphic's own load(), so the preview shows
 * exactly the answer a renderer would get. The browser tests open these same samples.
 */
import superPrimeSample from '@bajaovrlay/shared/samples/brackets.super-prime.json';

import type { BracketData, BracketMatchData, BracketRoundData } from './bracketModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The real Super Prime as the item's binding hands it over: its rounds, the design's title. */
export function createTheRealSuperPrime(): BracketData {
  return { rounds: structuredClone(superPrimeSample.rounds), title: ptBR.preview.sampleTitle };
}

const corisco = { carNumber: 32, teamName: 'Corisco', schoolName: 'UPE' };
const buffalo = { carNumber: 34, teamName: 'Buffalo', schoolName: 'UFLA' };
const bombaja = { carNumber: 17, teamName: 'Bombaja', schoolName: 'UFSM' };
const caraubaja = { carNumber: 9, teamName: 'Caraubaja', schoolName: 'UFERSA-Car' };
const bajaUfmg = { carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG' };

/** The six states of sheet-bracket-results, top to bottom, as matches. */
export function createTheSixResultStates(): BracketMatchData[] {
  return [
    {
      matchId: 'tempo',
      carA: { ...corisco, timeMs: 71_340 },
      carB: { ...buffalo, timeMs: 74_910 },
      winnerCarNumber: 32,
    },
    {
      matchId: 'melhor-de-3',
      bestOf: 3,
      carA: { ...bombaja, wins: 2 },
      carB: { ...caraubaja, wins: 1 },
      winnerCarNumber: 17,
    },
    { matchId: 'vitoria-sem-numero', carA: corisco, carB: buffalo, winnerCarNumber: 32 },
    {
      matchId: 'wo-por-ausencia',
      walkover: true,
      carA: corisco,
      carB: buffalo,
      winnerCarNumber: 32,
    },
    { matchId: 'wo-sem-adversario', walkover: true, carA: bajaUfmg, winnerCarNumber: 2 },
    { matchId: 'antes-de-decidir', carA: corisco, carB: buffalo },
  ];
}

/** The six states as one round board: six matches make a board, not a tree. */
export function createResultStatesOnABoard(): BracketData {
  const round: BracketRoundData = { name: 'Resultados', matches: createTheSixResultStates() };
  return { rounds: [round], title: ptBR.preview.sampleTitle };
}

/**
 * The six states as a tree: the first four as the quarter-finals, the bye and the undecided
 * match as the semifinals, so the tree's second step shows them all.
 */
export function createResultStatesInATree(): BracketData {
  const states = createTheSixResultStates();
  return {
    rounds: [
      { name: 'Quartas de final', matches: states.slice(0, 4) },
      { name: 'Semifinal', matches: states.slice(4) },
    ],
    title: ptBR.preview.sampleTitle,
  };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const results = searchParameters.get('results');
    if (results === 'board') {
      return { isReadable: true, data: createResultStatesOnABoard() };
    }
    if (results === 'tree') {
      return { isReadable: true, data: createResultStatesInATree() };
    }
    return { isReadable: true, data: createTheRealSuperPrime() };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}
