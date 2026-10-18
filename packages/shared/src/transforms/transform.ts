import type { z } from 'zod';

/**
 * Any value JSON can hold. A transform hands one of these back, because whatever it gives
 * goes on into a canonical shape, which is JSON from the source to the screen.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * What a transform answers: the value it made, or a pt-BR reason that quotes the value it
 * could not read ("\"4:3x.293\" não é um tempo de volta…"). Never a throw: the mapping
 * collects these reasons into the problems list the operator reads.
 */
export type TransformResult = { ok: true; value: JsonValue } | { ok: false; reason: string };

/**
 * One named, pure transform of the registry (architecture rule 5). `apply` reads no clock,
 * keeps no memory and never throws, so the same value and parameters always give the same
 * answer, on the server and in the browser alike.
 * What could go wrong: `apply` receives whatever the source sent, of any type, so each
 * transform checks the type itself before reading it.
 */
export type Transform = {
  /** The stable name a mapping rule points at, such as "lapTimeTextToMs". */
  id: string;
  /** The pt-BR name the operator picks in the dropdown. */
  label: string;
  /** One pt-BR sentence with an example, shown beside the dropdown. */
  description: string;
  /** The shape of the parameters, for the one transform that takes any (mapValues). */
  parametersSchema?: z.ZodType;
  /** Turns one value from the source into one value for the canonical shape. */
  apply: (value: unknown, parameters: unknown) => TransformResult;
};

/** Builds the answer of a transform that read its value. */
export function giveTransformedValue(value: JsonValue): TransformResult {
  return { ok: true, value };
}

/** Builds the answer of a transform that refused its value, with the pt-BR reason. */
export function refuseTransformValue(reason: string): TransformResult {
  return { ok: false, reason };
}
