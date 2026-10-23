/**
 * How an inbox event reads on the page: what it is in a word ("Penalização", "Volta mais
 * rápida") and Camadas' mark on the notice it put on air. Pure, from the pt-BR catalog.
 */
import type { InboxEvent } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.events;

/**
 * What an event is, in a word: an incident or a typed event by what its notice says
 * (a warning is not a penalty), any other kind by its kind.
 */
export function describeKindOfEvent(event: InboxEvent): string {
  switch (event.kind) {
    case 'fastestLap':
    case 'leaderChanged':
    case 'superChat':
      return texts.kindWords[event.kind];
    case 'newIncident':
    case 'manual':
      return texts.noticeKindWords[event.payload.noticeKind ?? 'penalty'];
  }
}

/**
 * Camadas' mark on an instance an event put on air: "evento: penalização · carro 47", or
 * "evento" alone when the event is no longer in the slice (it keeps the newest 200).
 */
export function describeEventMarkOnLayer(event: InboxEvent | undefined): string {
  if (event === undefined) {
    return texts.layerMarkerOfAnEventGone;
  }
  return texts.layerMarker(describeKindOfEvent(event), event.payload.carNumber);
}
