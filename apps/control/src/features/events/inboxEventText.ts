/**
 * How an inbox event reads on the page: what it is in a word ("Penalidade", "Volta mais
 * rápida"), Camadas' mark on the notice it put on air, and the history's details and
 * origin. Pure, from the pt-BR catalog.
 */
import type { DataSource, InboxEvent } from '@bajaovrlay/shared';

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
 * Who an event is about: "carro 47", or a Super Chat's viewer and amount ("Torcida Pequi
 * Off-Road · R$ 20,00", BAJAOVRLAY-35), which is about no car. Empty when it has neither,
 * which only a database edited by hand could hold.
 */
export function describeSubjectOfEvent(event: InboxEvent): string {
  const { carNumber, authorName, amountText } = event.payload;
  if (event.kind === 'superChat' && authorName !== undefined && amountText !== undefined) {
    return texts.superChatSubject(authorName, amountText);
  }
  return carNumber === undefined ? '' : texts.carSubject(carNumber);
}

/**
 * Camadas' mark on an instance an event put on air: "evento: penalidade · carro 47", or
 * "evento" alone when the event is no longer in the slice (it keeps the newest 200).
 */
export function describeEventMarkOnLayer(event: InboxEvent | undefined): string {
  if (event === undefined) {
    return texts.layerMarkerOfAnEventGone;
  }
  return texts.layerMarker(describeKindOfEvent(event), describeSubjectOfEvent(event));
}

/**
 * The history's details of an event: its reason, penalty and lap time, those it has,
 * joined ("Queima de largada · +30 segundos"); empty when it has none (a leader change).
 * A Super Chat's are its viewer, its amount and its message, so the search finds them.
 */
export function describeDetailsOfEvent(event: InboxEvent): string {
  const { reason, penaltyText, lapTimeText, authorName, amountText, messageText } = event.payload;
  const details = [reason, penaltyText, lapTimeText, authorName, amountText, messageText].filter(
    (detail) => detail !== undefined && detail !== '',
  );
  return details.join(texts.reviewPage.detailsSeparator);
}

/**
 * Where an event came from: "Digitado" for one typed with "+ Evento", otherwise its
 * source's name, or the source's id when the source has since been deleted.
 */
export function describeOriginOfEvent(event: InboxEvent, dataSources: DataSource[]): string {
  if (event.sourceId === null) {
    return texts.reviewPage.typedOrigin;
  }
  const source = dataSources.find((dataSource) => dataSource.id === event.sourceId);
  return source?.label ?? event.sourceId;
}
