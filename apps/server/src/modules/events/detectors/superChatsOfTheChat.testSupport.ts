// Test support for the Super Chat detector: fictional viewers' paid messages on the live
// chat of the enduro (BAJAOVRLAY-35), and the superChats shape a YouTube source answers.
// Every function builds fresh objects on each call.
import type { SuperChatEntry, SuperChatsShape } from '@bajaovrlay/shared';

/** 15:00:00 UTC on 14 August 2027, the enduro day: when the tests' poll arrives. */
export const pollArrivedAtMs = Date.parse('2027-08-14T15:00:00.000Z');

/** A fictional viewer's Super Chat published `minutesBeforeThePoll` before the poll. */
export function buildSuperChat(
  messageId: string,
  authorName: string,
  minutesBeforeThePoll: number,
): SuperChatEntry {
  return {
    messageId,
    authorName,
    amountText: 'R$ 20,00',
    amountMicros: 20_000_000,
    currency: 'BRL',
    tier: 2,
    messageText: `Vai, Baja! Um abraço de ${authorName}`,
    publishedAtMs: pollArrivedAtMs - minutesBeforeThePoll * 60_000,
  };
}

/** The superChats shape listing these Super Chats, oldest first, as of the poll. */
export function buildSuperChats(entries: SuperChatEntry[]): SuperChatsShape {
  return { updatedAtMs: pollArrivedAtMs, entries };
}

/** Torcida Pequi's R$ 20,00, two minutes before the poll. */
export function buildSuperChatOfTorcidaPequi(): SuperChatEntry {
  return buildSuperChat('mensagem-pequi-0001', 'Torcida Pequi Off-Road', 2);
}

/** Ana do Paddock's, forty minutes before the poll: older than the first poll's window. */
export function buildSuperChatOfAnaDoPaddock(): SuperChatEntry {
  return buildSuperChat('mensagem-paddock-0002', 'Ana do Paddock', 40);
}

/** Família Carnaúba's, just now. */
export function buildSuperChatOfFamiliaCarnauba(): SuperChatEntry {
  return buildSuperChat('mensagem-carnauba-0003', 'Família Carnaúba', 0);
}
