// The simulated live chat (BAJAOVRLAY-35): a fictional viewer's paid message about every
// five simulated minutes, drawn from the seed like the incidents, so the whole Super Chat
// flow (the inbox, Dados's approval, the Produtor's "No ar") can be rehearsed with no
// live stream. Answered only when the simulator's config switches it on.
import type { SuperChatEntry, SuperChatsShape } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { drawForRace, scaleDrawBetween } from './seededRandom.js';

// One Super Chat for every five simulated minutes: about 50 in a four-hour enduro.
const simulatedTimePerSuperChatMs = 5 * 60_000;

// Where in its five minutes a Super Chat comes: between 10 % and 90 %, never two together.
const earliestSuperChatInItsShare = 0.1;
const latestSuperChatInItsShare = 0.9;

/** How many Super Chats the shape keeps, newest last, like a live chat's recent messages. */
const superChatsKept = 20;

/** What the simulation needs: the race's seed, its speed and its wall-clock start. */
export type SimulatedSuperChatsSettings = {
  seed: number;
  speed: number;
  simulatedStartAtMs: number;
};

/**
 * The simulated Super Chats published by simulated time `elapsedSimulatedMs`, the newest
 * 20, oldest first. The n-th is drawn from the seed and n alone, so it is the same at
 * every poll and after a restart, with the same id (`simulador-<seed>-superchat-<n>`):
 * the inbox never lists it twice. Published at its wall-clock moment, worked out from the
 * race's start and speed. Pure.
 */
export function listSimulatedSuperChats(
  settings: SimulatedSuperChatsSettings,
  elapsedSimulatedMs: number,
): SuperChatEntry[] {
  const superChats: SuperChatEntry[] = [];
  const shareCountSoFar = Math.floor(elapsedSimulatedMs / simulatedTimePerSuperChatMs) + 1;
  for (let occurrenceNumber = 1; occurrenceNumber <= shareCountSoFar; occurrenceNumber += 1) {
    const atElapsedMs = drawMomentOfSuperChat(settings.seed, occurrenceNumber);
    if (atElapsedMs > elapsedSimulatedMs) {
      break;
    }
    superChats.push(buildSimulatedSuperChat(settings, occurrenceNumber, atElapsedMs));
  }
  return superChats.slice(-superChatsKept);
}

/** The superChats shape of the simulated chat, dated by its newest Super Chat. */
export function buildSimulatedSuperChatsShape(
  settings: SimulatedSuperChatsSettings,
  elapsedSimulatedMs: number,
): SuperChatsShape {
  const entries = listSimulatedSuperChats(settings, elapsedSimulatedMs);
  const newestSuperChat = entries.at(-1);
  // Dated by the newest message, not the poll, so a quiet chat answers the same shape.
  const updatedAtMs = newestSuperChat?.publishedAtMs ?? settings.simulatedStartAtMs;
  return { updatedAtMs, entries };
}

/** Simulated time of the n-th Super Chat: somewhere inside its own five minutes. */
function drawMomentOfSuperChat(seed: number, occurrenceNumber: number): number {
  const shareStartMs = (occurrenceNumber - 1) * simulatedTimePerSuperChatMs;
  const momentDraw = drawForRace(seed, occurrenceNumber, 'superChatMoment');
  const shareFraction = scaleDrawBetween(
    momentDraw,
    earliestSuperChatInItsShare,
    latestSuperChatInItsShare,
  );
  return Math.round(shareStartMs + simulatedTimePerSuperChatMs * shareFraction);
}

/** The n-th Super Chat: its viewer, amount and message drawn from the seed. */
function buildSimulatedSuperChat(
  settings: SimulatedSuperChatsSettings,
  occurrenceNumber: number,
  atElapsedMs: number,
): SuperChatEntry {
  const catalog = ptBR.youTube.simulatedSuperChats;
  const viewerName = pickFromList(
    catalog.viewerNames,
    drawForRace(settings.seed, occurrenceNumber, 'superChatViewer'),
  );
  const amount = pickFromList(
    catalog.amounts,
    drawForRace(settings.seed, occurrenceNumber, 'superChatAmount'),
  );
  const messageText = pickFromList(
    catalog.messages,
    drawForRace(settings.seed, occurrenceNumber, 'superChatMessage'),
  );
  const realTimeSinceTheStartMs = Math.round(atElapsedMs / settings.speed);
  return {
    messageId: `simulador-${String(settings.seed)}-superchat-${String(occurrenceNumber)}`,
    authorName: viewerName,
    amountText: `R$ ${String(amount.reais)},00`,
    amountMicros: amount.reais * 1_000_000,
    currency: 'BRL',
    tier: amount.tier,
    messageText,
    publishedAtMs: settings.simulatedStartAtMs + realTimeSinceTheStartMs,
  };
}

/** The element a draw in [0, 1) falls on in a list that is never empty. */
function pickFromList<Element>(list: readonly Element[], draw: number): Element {
  const index = Math.min(list.length - 1, Math.floor(draw * list.length));
  const element = list[index];
  if (element === undefined) {
    throw new Error('the simulator catalog lists must not be empty');
  }
  return element;
}
