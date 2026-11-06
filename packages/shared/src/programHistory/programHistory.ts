import { z } from 'zod';

import { reportKeysListedTwice } from '../entities/entityKeysListedOnce.js';
import { ptBRProgramHistory } from './ptBRProgramHistory.js';

/**
 * How many changes each layer remembers (BAJAOVRLAY-30). An undo goes back one change at a
 * time, and ten presses back is far past any mistake the operator still wants to put right.
 */
export const programHistoryLimitPerLayer = 10;

/**
 * What a layer's program output showed before one change: nothing ("vazio"), or an item.
 * For an item, `typedValues` are the values on air that do not read a source now: the
 * item's literal and event fields and every field changed on air, a field that had no
 * value written as null. Its bound, library and take-time fields are left out, so an undo
 * reads them again as a take does. `itemLabel` is the item's name at that moment, for the
 * "Desfazer" tooltip, also after the item is renamed or deleted.
 */
export const ProgramHistoryShownSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('empty') }),
  z.object({
    kind: z.literal('item'),
    itemId: z.string().min(1),
    graphicId: z.string().min(1),
    itemLabel: z.string().min(1),
    typedValues: z.record(z.string(), z.unknown()),
    /** The instance's "alterado no ar" list, carried back so Camadas shows the chip again. */
    fieldsChangedOnAir: z.array(z.string().min(1)).optional(),
    /** An event's own time on air (Instance.autoOutAfterMs), carried back with it. */
    autoOutAfterMs: z.number().int().positive().optional(),
  }),
]);

/** One of ProgramHistoryShownSchema's values. */
export type ProgramHistoryShown = z.infer<typeof ProgramHistoryShownSchema>;

/**
 * One change of a layer's program output: what it showed before, and which change it was.
 * Every layer a command changed gets an entry with the same `changeNumber`, so "Desfazer
 * última" after a "Limpar tudo" puts every layer back in one press.
 */
export const ProgramHistoryEntrySchema = z.object({
  /** Counts up by one per command that changed program; the newest is the highest. */
  changeNumber: z.number().int().positive(),
  /** When the change happened, as an ISO 8601 timestamp (the event-log row's ts). */
  changedAt: z.iso.datetime(),
  shownBefore: ProgramHistoryShownSchema,
});

/** An entry that has passed ProgramHistoryEntrySchema. */
export type ProgramHistoryEntry = z.infer<typeof ProgramHistoryEntrySchema>;

/** One layer's remembered changes, oldest first, at most programHistoryLimitPerLayer. */
export const LayerProgramHistorySchema = z.object({
  layerId: z.string().min(1),
  entries: z.array(ProgramHistoryEntrySchema).max(programHistoryLimitPerLayer),
});

/** A layer's history that has passed LayerProgramHistorySchema. */
export type LayerProgramHistory = z.infer<typeof LayerProgramHistorySchema>;

/**
 * The `programHistory` slice: one entry per layer that has something to undo, each layer
 * once. Saved, so a refresh or a restart keeps it; screens never receive it.
 */
export const ProgramHistorySchema = z
  .array(LayerProgramHistorySchema)
  .superRefine((layerHistories, context) => {
    reportKeysListedTwice(
      layerHistories.map((layerHistory) => layerHistory.layerId),
      'layerId',
      ptBRProgramHistory.layerListedTwice,
      context,
    );
  });

/** The programHistory slice after validation. */
export type ProgramHistory = z.infer<typeof ProgramHistorySchema>;
