import { z } from 'zod';

/**
 * The six colours an operator can give an item to find it at a glance in the rundown.
 * They are names with a meaning, not colour values: the control page maps each name to
 * one of its design tokens, so a theme change never touches stored items.
 * The order here is the order the colour picker shows them in.
 * What could go wrong: removing or renaming a name makes every stored item that uses
 * it fail ItemSchema, and a stored slice that fails its schema stops the server's boot.
 */
export const ItemColorSchema = z.enum([
  /** No particular meaning; what a new item gets. */
  'neutral',
  /** Informative items, such as a schedule or a session title. */
  'info',
  /** Things going well, such as a green flag or a result confirmed. */
  'success',
  /** Items that need care, such as a yellow flag. */
  'warning',
  /** Items for a serious moment, such as a red flag or an interruption. */
  'danger',
  /** The items the show is built around, such as a podium. */
  'highlight',
]);

/** One of ItemColorSchema's six names. */
export type ItemColor = z.infer<typeof ItemColorSchema>;

/** The colour a new item gets when its creator does not choose one. */
export const defaultItemColor: ItemColor = 'neutral';
