/**
 * Test support: viewers' Super Chats in the event inbox as the server sends them
 * (BAJAOVRLAY-35), from fictional viewers, never a real person's name, and the inbox's
 * slices with the seeded "Super Chat" item that the Super Chat rule names. Every function
 * builds fresh objects, so a test can change one thing.
 */
import type { InboxEvent, Item, Slices } from '@bajaovrlay/shared';

import {
  buildSlicesWithTheInbox,
  nowInTheInboxTests,
} from './eventsLikeTheServerSends.testSupport';

/** A moment `minutesAgo` minutes before nowInTheInboxTests, in ms. */
function minutesBeforeNowMs(minutesAgo: number): number {
  return nowInTheInboxTests.getTime() - minutesAgo * 60_000;
}

/** Torcida Pequi Off-Road's R$ 20,00, read from the live's chat, awaiting approval. */
export function buildSuperChatOfTorcidaPequiAwaitingApproval(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'youtube-ao-vivo:superChat:mensagem-pequi-0001',
    kind: 'superChat',
    sourceId: 'youtube-ao-vivo',
    detectedAtMs,
    payload: {
      authorName: 'Torcida Pequi Off-Road',
      amountText: 'R$ 20,00',
      messageText: 'Vai, Pequi! Abraço de Goiânia',
    },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** Ana do Paddock's R$ 5,00 without a message, awaiting approval. */
export function buildSuperChatWithoutAMessageAwaitingApproval(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'youtube-ao-vivo:superChat:mensagem-paddock-0002',
    kind: 'superChat',
    sourceId: 'youtube-ao-vivo',
    detectedAtMs,
    payload: { authorName: 'Ana do Paddock', amountText: 'R$ 5,00', messageText: '' },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** Torcida Carnaúba's R$ 50,00, approved by Dados a minute after it arrived. */
export function buildApprovedSuperChatOfTorcidaCarnauba(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'youtube-ao-vivo:superChat:mensagem-carnauba-0003',
    kind: 'superChat',
    sourceId: 'youtube-ao-vivo',
    detectedAtMs,
    payload: {
      authorName: 'Torcida Carnaúba Baja',
      amountText: 'R$ 50,00',
      messageText: 'Força, Carnaúba! Mossoró está com vocês',
    },
    status: 'approved',
    statusChanges: [
      { status: 'pending', atMs: detectedAtMs },
      { status: 'approved', atMs: detectedAtMs + 60_000 },
    ],
  };
}

/** The "Super Chat" template the server seeds, filled from the event's three fields. */
export function buildSuperChatItem(): Item {
  return {
    id: 'super-chat',
    home: { kind: 'eventTemplates' },
    order: 2,
    graphicId: 'super-chat',
    layerId: 'notice',
    label: 'Super Chat',
    color: 'neutral',
    notes: '',
    fields: {
      amountText: { kind: 'eventField', path: 'amountText' },
      authorName: { kind: 'eventField', path: 'authorName' },
      messageText: { kind: 'eventField', path: 'messageText' },
    },
  };
}

/** The inbox's slices with the "Super Chat" item, named by the Super Chat rule, and these events. */
export function buildSlicesWithTheInboxAndTheSuperChatItem(events: InboxEvent[]): Slices {
  const slices = buildSlicesWithTheInbox(events);
  return {
    ...slices,
    items: [...slices.items, buildSuperChatItem()],
    eventRules: slices.eventRules.map((rule) =>
      rule.kind === 'superChat' ? { ...rule, itemId: 'super-chat' } : rule,
    ),
  };
}
