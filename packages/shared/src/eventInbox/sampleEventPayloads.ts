import type { InboxEventKind, InboxEventPayload } from './inboxEvent.js';

/**
 * A realistic event of each kind, for "Prévia" of a template item: the operator sees the
 * look of a penalty or a fastest lap before any happens. Never on air: a preview filled
 * from a sample cannot be taken ("Tomar" is refused). Fictional cars, like the simulator's.
 */
const sampleEventPayloadsByKind: Record<InboxEventKind, InboxEventPayload> = {
  newIncident: {
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    noticeKind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
    lapNumber: 1,
  },
  fastestLap: {
    carNumber: 31,
    teamName: 'Acauã Baja',
    schoolName: 'Mauá',
    lapNumber: 34,
    lapTimeMs: 278_291,
    lapTimeText: '4:38,2',
  },
  leaderChanged: { carNumber: 31, teamName: 'Acauã Baja', schoolName: 'Mauá', lapNumber: 34 },
  manual: {
    carNumber: 12,
    teamName: 'Gralha Azul Baja',
    schoolName: 'UTFPR',
    noticeKind: 'notice',
    reason: 'Carro parado na reta dos boxes',
  },
  superChat: {
    carNumber: 52,
    teamName: 'Pequi Off-Road',
    schoolName: 'UFG',
    noticeKind: 'notice',
    reason: 'Vai, Pequi! Abraço da torcida de Goiânia',
  },
};

/** The sample event of a kind, a fresh copy each time. */
export function readSampleEventPayload(kind: InboxEventKind): InboxEventPayload {
  return { ...sampleEventPayloadsByKind[kind] };
}
