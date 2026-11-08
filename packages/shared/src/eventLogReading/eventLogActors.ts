import { z } from 'zod';

import { ptBREventLogReading } from './ptBREventLogReading.js';

/**
 * Who sent a command, as the history page sorts it (BAJAOVRLAY-30): an operator logged in
 * as Produtor or Dados (BAJAOVRLAY-29), the operator at a control page while the login is
 * off, a device of the command API, a trigger, a macro's runner, a data source's poller,
 * or the server by itself (the auto-out, the renderer's reports, the watchdog…).
 */
export const EventLogActorKindSchema = z.enum([
  'produtor',
  'dados',
  'operador',
  'api',
  'gatilho',
  'macro',
  'fonte',
  'sistema',
]);

/** One of EventLogActorKindSchema's values. */
export type EventLogActorKind = z.infer<typeof EventLogActorKindSchema>;

/** The pt-BR name of each kind, for the "Quem" filter. */
export const eventLogActorKindLabels: Record<EventLogActorKind, string> =
  ptBREventLogReading.actorKindLabels;

// The actor names the server signs with (apps/server/src/core/store/commandActors.ts). The
// trigger service's comes from BAJAOVRLAY-48 (`sistema:gatilhos`). The macro runner's
// prefix ends in a colon on purpose: `sistema:macro-watchdog` is the watchdog, not a macro.
// A logged-in operator signs with the role and the station (BAJAOVRLAY-29).
const producerPrefix = 'produtor:';
const dataRolePrefix = 'dados:';
const operatorPrefix = 'operador:';
const apiPrefix = 'api:';
const triggerServiceActor = 'sistema:gatilhos';
const macroRunnerPrefix = 'sistema:macro:';
const dataSourcePollerPrefix = 'sistema:fonte:';

/**
 * Who sent an event-log row, from its actor name: the kind, and the label the row shows
 * ("Produtor · Mesa 1", "Operador", "API · companion"). Anything not recognised, a
 * renderer and a monitor included, is "Sistema": the page never shows a raw actor name.
 */
export function readWhoSentEventLogRow(actor: string): {
  kind: EventLogActorKind;
  label: string;
} {
  const labels = ptBREventLogReading.actorKindLabels;
  if (actor.startsWith(producerPrefix)) {
    const station = actor.slice(producerPrefix.length);
    return {
      kind: 'produtor',
      label: ptBREventLogReading.roleAtStationLabel(labels.produtor, station),
    };
  }
  if (actor.startsWith(dataRolePrefix)) {
    const station = actor.slice(dataRolePrefix.length);
    return { kind: 'dados', label: ptBREventLogReading.roleAtStationLabel(labels.dados, station) };
  }
  if (actor.startsWith(operatorPrefix)) {
    return { kind: 'operador', label: labels.operador };
  }
  if (actor.startsWith(apiPrefix)) {
    const deviceName = actor.slice(apiPrefix.length);
    return { kind: 'api', label: ptBREventLogReading.apiDeviceLabel(deviceName) };
  }
  if (actor === triggerServiceActor) {
    return { kind: 'gatilho', label: labels.gatilho };
  }
  if (actor.startsWith(macroRunnerPrefix)) {
    return { kind: 'macro', label: labels.macro };
  }
  if (actor.startsWith(dataSourcePollerPrefix)) {
    return { kind: 'fonte', label: labels.fonte };
  }
  return { kind: 'sistema', label: labels.sistema };
}
