import { z } from 'zod';

/**
 * What a console showed on the program output of the layer it takes on, at the press
 * (BAJAOVRLAY-69): the id of the instance it showed there, or null when it showed the layer
 * empty. The server compares it with what is on air when the take arrives: a different
 * instance, put there by another console moments ago, means this operator never saw it,
 * and the take is refused rather than replacing it unseen.
 * Left out of a command, the sender said nothing about what it saw (the command API, a
 * Companion button, a macro's step), and the take is never refused for this.
 */
export const InstanceIdSeenOnAirSchema = z.string().min(1).nullable();

/** An InstanceIdSeenOnAirSchema value: an instance id, or null for "the layer was empty". */
export type InstanceIdSeenOnAir = z.infer<typeof InstanceIdSeenOnAirSchema>;

/**
 * The same, for "Tomar tudo", layer by layer: for each layer it takes, keyed by layer id,
 * what the console showed on that layer's program output. A layer missing from the record
 * is taken as if nothing were said about it.
 */
export const InstanceIdsSeenOnAirByLayerSchema = z.record(
  z.string().min(1),
  InstanceIdSeenOnAirSchema,
);

/** An InstanceIdsSeenOnAirByLayerSchema value. */
export type InstanceIdsSeenOnAirByLayer = z.infer<typeof InstanceIdsSeenOnAirByLayerSchema>;
