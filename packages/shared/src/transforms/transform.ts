import type { z } from 'zod';

import type { BindableValueType } from '../dataShapes/bindablePaths.js';
import type { Team } from '../entities/team.js';

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
 * The two families of the registry, kept apart because each form offers one only:
 * - `mapping`: brings a source's own data into the canonical shapes (a flex source's
 *   mapping: "4:38.293" into 278 293 ms);
 * - `binding`: shapes canonical data for a graphic (an item field's binding: 278 293 ms
 *   into "4:38,2", the first six cars of the list).
 * A rule or a binding naming a transform of the other family is refused when saved.
 */
export type TransformFamily = 'mapping' | 'binding';

/**
 * What a binding transform may read besides its value and parameters: the entity library's
 * teams, read-only (BAJAOVRLAY-47, for withTeamLogos). It is handed in as plain data by
 * whoever resolves the binding (the take, the preview, the live refresh, the item editor),
 * so a transform that reads it is still pure: the same value, parameters and teams always
 * give the same answer. The other binding transforms ignore it.
 */
export type BindingTransformContext = {
  teams: readonly Team[];
};

/**
 * What every transform of the registry has (architecture rule 5). `apply` reads no clock,
 * keeps no memory and never throws, so the same value and parameters always give the
 * same answer, on the server and in the browser alike.
 * What could go wrong: `apply` receives whatever it is handed, of any type, so each
 * transform checks the type itself before reading it.
 */
type TransformOfEitherFamily = {
  /** The stable name a rule or a binding points at, such as "lapTimeTextToMs". */
  id: string;
  /** The pt-BR name the operator picks in the dropdown. */
  label: string;
  /** One pt-BR sentence with an example, shown beside the dropdown. */
  description: string;
  /** The shape of the parameters, for a transform that takes any (mapValues, topN…). */
  parametersSchema?: z.ZodType;
};

/** A transform that brings a source's data into a canonical shape (a flex mapping's). */
export type MappingTransform = TransformOfEitherFamily & {
  family: 'mapping';
  /** Turns one value into one value. */
  apply: (value: unknown, parameters: unknown) => TransformResult;
};

/**
 * A transform that shapes canonical data for a graphic (an item binding's). It says which
 * value types it reads, so the item editor offers it only on a path it can read, and which
 * it gives, so the editor offers it only for a field that type fits; topN gives back the
 * kind of list it was given ("sameAsTheValueRead").
 */
export type BindingTransform = TransformOfEitherFamily & {
  family: 'binding';
  valueTypesRead: BindableValueType[];
  valueTypeGiven: BindableValueType | 'sameAsTheValueRead';
  /**
   * True for a transform whose answer depends on the teams of the context (withTeamLogos):
   * a team edit in Cadastros then refreshes the live fields that use it. Left out: no.
   */
  readsTheTeams?: boolean;
  /** Turns one value into one value; `context` is read only by a transform that needs it. */
  apply: (value: unknown, parameters: unknown, context: BindingTransformContext) => TransformResult;
};

/** Any transform of the registry, told apart by `family`. */
export type Transform = MappingTransform | BindingTransform;

/** Builds the answer of a transform that read its value. */
export function giveTransformedValue(value: JsonValue): TransformResult {
  return { ok: true, value };
}

/** Builds the answer of a transform that refused its value, with the pt-BR reason. */
export function refuseTransformValue(reason: string): TransformResult {
  return { ok: false, reason };
}
