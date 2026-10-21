/**
 * pt-BR catalog: every word the positions tower puts on air (the head captions, the gap
 * in laps, the empty mark, the status icons' names), every message it answers a renderer
 * with and every label of its preview page, never written inline elsewhere. The
 * manifest's field titles are in positions-tower.ograf.json, since JSON cannot import.
 *
 * On-air words are written in lowercase here where the sentence needs it ("+2 voltas"):
 * the styles set the rows in caps (`text-transform`), and the face has no lowercase.
 */
import type { PositionStatus, TowerColumnKey } from './positionsTowerModel.js';

/** The caption over each column; the cue and status lanes carry none. */
const columnCaptions: Record<TowerColumnKey, string> = {
  pos: 'POS',
  cue: '',
  car: 'Nº',
  team: 'EQUIPE',
  laps: 'VOLTAS',
  gap: 'DIF.',
  interval: 'INTERV.',
  lastLap: 'ÚLT. VOLTA',
  bestLap: 'MELHOR',
  pitStops: 'PARADAS',
  fuelStops: 'ABAST.',
  status: '',
};

/**
 * The accessible name of each status icon. A running car and one not started yet show
 * no icon, so they have no name here (decision 14 of the context pack).
 */
const statusIconNames: Partial<Record<PositionStatus, string>> = {
  inPit: 'No box',
  stopped: 'Quebrado',
  retired: 'Abandonou',
  disqualified: 'Desclassificado',
};

export const ptBR = {
  columnCaptions,
  statusIconNames,
  /** The on-air mark for a value the source does not know; never a 0 or a blank. */
  emptyMark: '—',
  /** A gap in laps: the word is lowercase here, the styles set the row in caps. */
  gapInLaps: (laps: number) => (laps === 1 ? '+1 volta' : `+${laps} voltas`),
  /** A gap or interval in seconds, with no unit: the caps face would show an "S". */
  gapInSeconds: (secondsToTheTenth: string) => `+${secondsToTheTenth}`,
  /** The accessible name of the cue arrow drawn after a position change. */
  cueArrowNames: {
    up: 'Subiu',
    down: 'Desceu',
  },

  actionProblems: {
    notLoadedYet: 'A torre ainda não foi carregada (load).',
    alreadyLoaded: 'A torre já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A torre já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a torre tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A torre não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da torre.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — torre de posições',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    compactLayoutButton: 'Compacta',
    detailedLayoutButton: 'Detalhada',
    swapThirdAndFourthButton: 'Trocar 3º e 4º',
    newLeaderButton: 'Novo líder',
    carCrossesPageBoundaryButton: 'Carro 21 sobe para 20º',
    nextPageButton: 'Próxima página',
    firstPageOnlyButton: 'Só os 20 primeiros',
    cyclePagesButton: 'Alternar páginas',
    unreadableAddressData: 'O parâmetro ?data= do endereço não é um JSON válido.',
    lastAnswer: (actionName: string, statusCode: number, statusMessage: string | undefined) => {
      const statusText = `${actionName}: ${statusCode}`;
      const hasStatusMessage = statusMessage !== undefined && statusMessage !== '';
      if (!hasStatusMessage) {
        return statusText;
      }
      return `${statusText} — ${statusMessage}`;
    },
  },
} as const;
