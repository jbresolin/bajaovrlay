import {
  type DetectedEvent,
  ptBRTriggers,
  type TriggerData,
  type TriggerDataEventKind,
} from '@bajaovrlay/shared';

/** What an inbox event is to the triggers: its kind in the brief's words, and its data. */
export type TriggerDataEventOfInboxEvent = { eventKind: TriggerDataEventKind; data: TriggerData };

/**
 * Reads an inbox event as a data event trigger sees it, or undefined for an event no
 * trigger waits for (a notice typed by the operator that is no penalty, a Super Chat).
 * The kinds, decided here once:
 * - `penalty`: any event that says it is a penalty, detected in a source or typed;
 * - `incident`: a detected incident that is not a penalty (a warning, an incident);
 * - `fastestLap` and `leaderChange`: the inbox's own kinds.
 * The data has pt-BR keys and only what the event carries: `tipo` always, then `carro`
 * `equipe`, `escola`, `motivo`, `punicao`, `volta`, `tempo` when present.
 */
export function readTriggerDataEventOfInboxEvent(
  event: DetectedEvent,
): TriggerDataEventOfInboxEvent | undefined {
  const eventKind = chooseTriggerDataEventKind(event);
  if (eventKind === undefined) {
    return undefined;
  }
  const payload = event.payload;
  const keysAndValues: Array<[string, string | number]> = [
    ['tipo', ptBRTriggers.dataEventKindLabels[eventKind]],
  ];
  // Every race event has a car (checkCarNumberForKind); only a Super Chat goes without,
  // and no trigger waits for one.
  if (payload.carNumber !== undefined) {
    keysAndValues.push(['carro', payload.carNumber]);
  }
  if (payload.teamName !== undefined) {
    keysAndValues.push(['equipe', payload.teamName]);
  }
  if (payload.schoolName !== undefined) {
    keysAndValues.push(['escola', payload.schoolName]);
  }
  if (payload.reason !== undefined) {
    keysAndValues.push(['motivo', payload.reason]);
  }
  if (payload.penaltyText !== undefined) {
    keysAndValues.push(['punicao', payload.penaltyText]);
  }
  if (payload.lapNumber !== undefined) {
    keysAndValues.push(['volta', payload.lapNumber]);
  }
  if (payload.lapTimeText !== undefined) {
    keysAndValues.push(['tempo', payload.lapTimeText]);
  }
  return { eventKind, data: Object.fromEntries(keysAndValues) };
}

/** The brief's kind of an inbox event, or undefined when it is none of the four. */
function chooseTriggerDataEventKind(event: DetectedEvent): TriggerDataEventKind | undefined {
  if (event.payload.noticeKind === 'penalty') {
    return 'penalty';
  }
  switch (event.kind) {
    case 'newIncident':
      return 'incident';
    case 'fastestLap':
      return 'fastestLap';
    case 'leaderChanged':
      return 'leaderChange';
    case 'manual':
    case 'superChat':
      return undefined;
  }
}
