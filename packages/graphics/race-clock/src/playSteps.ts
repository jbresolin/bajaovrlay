/**
 * The OGraf v1 rule for which step `playAction` goes to. Written out on its own so every
 * graphic copied from this one keeps the rule, whatever its number of steps.
 */

/** What playAction was asked, plus where the graphic is now. */
export type PlayActionRequest = {
  /** The step on air now; undefined when the graphic is not on air (the "start"). */
  currentStep: number | undefined;
  /** The manifest's stepCount. */
  stepCount: number;
  /** Absolute step to jump to; used when it is 0 or more. */
  goto?: number;
  /** Steps to move from the current one; 1 when not given. */
  delta?: number;
};

/** Where playAction should take the graphic. */
export type PlayActionTarget =
  { outcome: 'showStep'; step: number } | { outcome: 'goToEnd' } | { outcome: 'invalidStep' };

/**
 * Chooses the target step: `goto` when it is 0 or more, else current step + delta (the
 * start counts as step -1). A target at or past stepCount means "go to the end".
 */
export function choosePlayActionTarget(request: PlayActionRequest): PlayActionTarget {
  const stepBeforePlay = request.currentStep ?? -1;
  const delta = request.delta ?? 1;
  let targetStep = stepBeforePlay + delta;
  if (request.goto !== undefined && request.goto >= 0) {
    targetStep = request.goto;
  }

  if (targetStep < 0) {
    return { outcome: 'invalidStep' };
  }
  if (targetStep >= request.stepCount) {
    return { outcome: 'goToEnd' };
  }
  return { outcome: 'showStep', step: targetStep };
}
