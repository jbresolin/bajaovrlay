/**
 * What an update rule hands back: the top-level fields the reducer lays over the data
 * on air. It holds the fields the rule was given, plus any the rule added or replaced.
 */
export type UpdateRuleResult = {
  fieldsToWrite: Record<string, unknown>;
};

/**
 * The work of one update rule. Pure: it reads no clock (the moment comes in as
 * `nowMs`), does no I/O and changes none of the objects it is given.
 * - `dataOnAir`: the instance's data before this update.
 * - `fieldsSent`: the fields the update writes, after null fields were taken out and
 *   the stamped fields were given the moment of the command.
 * - `keysStamped`: the fields the server stamped (the command's `takeTimeFieldKeys`).
 * - `keysCleared`: the fields the update sent as null.
 * - `nowMs`: the moment of the command, in wall-clock milliseconds.
 */
export type ApplyUpdateRule = (
  dataOnAir: Record<string, unknown>,
  fieldsSent: Record<string, unknown>,
  keysStamped: string[],
  keysCleared: string[],
  nowMs: number,
) => UpdateRuleResult;

/** One named update rule, as the registry lists it. */
export type UpdateRule = {
  /** The name a manifest writes in `v_baja.updateRule`. */
  name: string;
  /**
   * The properties the graphic's data schema must declare for the rule to make sense.
   * A manifest that names the rule without them is refused at every update.
   */
  schemaPropertiesNeeded: string[];
  applyRule: ApplyUpdateRule;
};
