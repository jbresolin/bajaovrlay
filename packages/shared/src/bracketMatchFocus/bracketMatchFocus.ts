import { z } from 'zod';

/**
 * The two slots of the match focus: `current` is "agora" (the match bug's), `upNext` is
 * "a seguir" (the card's).
 */
export const BracketMatchSlotSchema = z.enum(['current', 'upNext']);

/** One of BracketMatchSlotSchema's values. */
export type BracketMatchSlot = z.infer<typeof BracketMatchSlotSchema>;

/**
 * The match focus of one source's brackets (BAJAOVRLAY-65): which match is "agora" and
 * which "a seguir", each the operator's choice or empty. It belongs to the session the
 * source was sending when the operator chose: once the source sends another session (the
 * simulator restarted, the next Super Prime), this focus reads as empty for it, never as
 * a match of another day. A chosen match the source stops listing reads as empty too
 * (focusedBracketMatch.ts); the id stays here, so the page can say which one went.
 */
export const BracketMatchFocusSchema = z.object({
  /** The data source whose brackets the focus points into. */
  sourceId: z.string().min(1),
  /** The brackets' session (`sessionId` of the shape) when the operator chose. */
  sessionId: z.string().min(1),
  /** The match "agora", by its `matchId`; left out when the slot is empty. */
  currentMatchId: z.string().min(1).optional(),
  /** The match "a seguir", by its `matchId`; left out when the slot is empty. */
  upNextMatchId: z.string().min(1).optional(),
});

/** One source's match focus, after validation. */
export type BracketMatchFocus = z.infer<typeof BracketMatchFocusSchema>;

/**
 * The `bracketMatchFocuses` slice: at most one focus per source (a source sends one
 * session's brackets at a time). Saved, so a restart keeps "agora" on air; screens never
 * receive it, since graphics get resolved data.
 */
export const BracketMatchFocusesSchema = z
  .array(BracketMatchFocusSchema)
  .superRefine((focuses, context) => {
    const sourceIdsSeen = new Set<string>();
    focuses.forEach((focus, index) => {
      if (sourceIdsSeen.has(focus.sourceId)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'sourceId'],
          message: `a source has one match focus; "${focus.sourceId}" is listed twice`,
        });
      }
      sourceIdsSeen.add(focus.sourceId);
    });
  });

/** The `bracketMatchFocuses` slice, after validation. */
export type BracketMatchFocuses = z.infer<typeof BracketMatchFocusesSchema>;
