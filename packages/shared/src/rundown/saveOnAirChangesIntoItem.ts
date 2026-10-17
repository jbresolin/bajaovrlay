import { z } from 'zod';

/**
 * What to store for a clock's wall-clock moment (a field whose schema says
 * `v_baja.role: "wallClock"`, such as the race clock's `referenceWallClockMs`) when it is
 * among the fields saved: `keepMoment` stores the moment on air as a typed number, so every
 * take continues that very clock ("Continuar este relógio": right for clearing a clock and
 * bringing it back); `atTake` stores it as takeTime, so every take starts the clock when
 * it goes on air ("Começar na entrada no ar": right for a reusable item).
 */
export const WallClockFieldsChoiceSchema = z.enum(['keepMoment', 'atTake']);

/** One of WallClockFieldsChoiceSchema's values. */
export type WallClockFieldsChoice = z.infer<typeof WallClockFieldsChoiceSchema>;

/**
 * "Salvar no item" on a Camadas row: writes the fields the instance lists as changed on
 * air (`fieldsChangedOnAir`), with the values on air now, into the item it was taken
 * from, as typed values, and empties the list, so the next take of the item shows the
 * same thing. Refused for an instance with no item (INSTANCE_WITHOUT_ITEM), one whose
 * item was deleted (ITEM_NOT_FOUND) and one with nothing changed (NOTHING_CHANGED_ON_AIR).
 */
export const SaveOnAirChangesIntoItemCommandSchema = z.object({
  type: z.literal('saveOnAirChangesIntoItem'),
  instanceId: z.string().min(1),
  /**
   * Required on purpose, even when no clock field changed: the server never chooses for
   * the operator what a clock does at the next take. The page sends `keepMoment` when it
   * did not have to ask; the choice then changes nothing.
   */
  wallClockFields: WallClockFieldsChoiceSchema,
});

/** A saveOnAirChangesIntoItem command after validation. */
export type SaveOnAirChangesIntoItemCommand = z.infer<typeof SaveOnAirChangesIntoItemCommandSchema>;
