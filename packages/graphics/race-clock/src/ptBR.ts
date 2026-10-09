/**
 * pt-BR catalog: every word the race clock puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in race-clock.ograf.json, since JSON cannot import.
 */
import type { ClockMode, FlagState } from './raceClockModel.js';

const flagLabels: Record<FlagState, string> = {
  pre: 'PRÉ-LARGADA',
  green: 'VERDE',
  yellow: 'AMARELA',
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};

const clockModeCaptions: Record<ClockMode, string> = {
  elapsed: 'TEMPO DE PROVA',
  remaining: 'TEMPO RESTANTE',
};

export const ptBR = {
  flagLabels,
  clockModeCaptions,
  lapsCompletedByLeader: (laps: number) => (laps === 1 ? '1 VOLTA' : `${laps} VOLTAS`),

  actionProblems: {
    notLoadedYet: 'O relógio ainda não foi carregado (load).',
    alreadyLoaded: 'O relógio já foi carregado (load); crie outro para novos dados.',
    notOnAirYet: 'O relógio não está no ar: chame playAction antes de atualizar.',
    alreadyDisposed: 'O relógio já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o relógio tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O relógio não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do relógio.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — relógio de prova',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    flagButton: (flagLabel: string) => `Bandeira: ${flagLabel}`,
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
