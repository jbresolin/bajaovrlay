import { z } from 'zod';

import { ptBRDataShapes } from './ptBRDataShapes.js';

/**
 * One viewer's paid message on the live chat (a YouTube Super Chat, BAJAOVRLAY-35), as the
 * YouTube source reads it. Only paid text messages: Super Stickers and memberships are
 * left out. No picture of the viewer: graphics never fetch, and the brief keeps avatars out.
 */
export const SuperChatEntrySchema = z.object({
  /**
   * YouTube's own id of the message, stable for ever: the event inbox keys the event by
   * it, so the same Super Chat read again after a restart is one event.
   */
  messageId: z.string().min(1),
  /** The viewer's name on YouTube, as YouTube shows it. */
  authorName: z.string().min(1),
  /** The amount as YouTube writes it ("R$ 50,00"), never re-formatted here. */
  amountText: z.string().min(1),
  /** The amount in millionths of the currency's unit: R$ 50,00 is 50 000 000. */
  amountMicros: z.number().int().min(0),
  /** The ISO 4217 code YouTube answers ("BRL"). */
  currency: z.string().min(1),
  /** YouTube's tier of the amount, from 1; kept for sorting, never shown in YouTube's colours. */
  tier: z.number().int().min(0),
  /** What the viewer wrote; empty when they paid without a message. */
  messageText: z.string(),
  /** When YouTube says it was published, in ms since 1970. */
  publishedAtMs: z.number().int().min(0),
});

/** One Super Chat that has passed SuperChatEntrySchema. */
export type SuperChatEntry = z.infer<typeof SuperChatEntrySchema>;

/**
 * The superChats shape: the newest Super Chats the source has read from one live chat,
 * oldest first. The one rule across entries: an id appears once, because the inbox keys
 * events by it. Not bindable by a graphic: a Super Chat reaches the air only as an event
 * a person approved.
 */
export const SuperChatsShapeSchema = z
  .object({
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    entries: z.array(SuperChatEntrySchema),
  })
  .superRefine((superChats, context) => {
    const messageIdsSeen = new Set<string>();
    superChats.entries.forEach((entry, index) => {
      if (messageIdsSeen.has(entry.messageId)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'messageId'],
          message: ptBRDataShapes.shapeRuleReasons.superChatListedTwice(entry.messageId),
        });
      }
      messageIdsSeen.add(entry.messageId);
    });
  });

/** Super Chats that have passed SuperChatsShapeSchema. */
export type SuperChatsShape = z.infer<typeof SuperChatsShapeSchema>;
