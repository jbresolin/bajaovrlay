/**
 * pt-BR catalog: every word the notice puts on air, every message it answers a renderer
 * with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in notice.ograf.json, since JSON cannot import.
 */
import type { NoticeKind } from './noticeModel.js';

/** The word in a penalty notice's head, one per kind race control can send. */
const noticeKindWords: Record<NoticeKind, string> = {
  penalty: 'PENALIDADE',
  warning: 'ADVERTÊNCIA',
  incident: 'INCIDENTE',
  notice: 'AVISO',
};

export const ptBR = {
  /** The green badge in a fastest lap's head. */
  fastestLapBadge: 'MELHOR VOLTA',
  /** The caption at the right of a fastest lap's head: the lap the time was set on. */
  lapNumberCaption: (lapNumber: number) => `VOLTA ${lapNumber}`,
  noticeKindWords,
  /** The caption at the right of a penalty notice's head: who the notice comes from. */
  raceControlCaption: 'DIREÇÃO DE PROVA',
  /** The accessible name of the warning triangle beside the kind word. */
  warningIconAlternativeText: 'Sinal de atenção',

  actionProblems: {
    notLoadedYet: 'O aviso ainda não foi carregado (load).',
    alreadyLoaded: 'O aviso já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O aviso já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o aviso tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O aviso não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do aviso.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — aviso',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    fastestLapButton: 'Variante: volta mais rápida',
    penaltyButton: 'Variante: penalidade',
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
