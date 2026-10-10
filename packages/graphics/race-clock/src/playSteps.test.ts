/**
 * Choosing the step for playAction (packages/graphics/race-clock)
 *
 * What this module is for:
 *   OGraf graphics are built from steps. `playAction` either jumps to a step (`goto`) or
 *   moves by some steps (`delta`, 1 by default), and a target past the last step means
 *   "go to the end", i.e. take the graphic off air. The race clock has one step, but
 *   every later graphic copies this file, so the rule from the OGraf v1 spec is written
 *   out once here.
 *
 * What these tests prove:
 *   - From the start (nothing on air), a plain play shows step 0.
 *   - Playing again on a one-step graphic goes to the end, as the spec says.
 *   - `goto` wins over `delta`, and a negative target is refused.
 *
 * What these tests deliberately do not cover:
 *   - The animations that follow from the decision; the component and the Playwright
 *     tests cover those.
 */
import { describe, expect, it } from 'vitest';

import { choosePlayActionTarget } from './playSteps.js';

const playTargetScenarios = [
  {
    // The everyday case: the operator takes the clock to air.
    name: 'shows step 0 when played from the start',
    request: { currentStep: undefined, stepCount: 1 },
    expected: { outcome: 'showStep', step: 0 },
  },
  {
    // Spec rule: the target is current step + delta; 0 + 1 is past the only step.
    name: 'goes to the end when played again while on air',
    request: { currentStep: 0, stepCount: 1, delta: 1 },
    expected: { outcome: 'goToEnd' },
  },
  {
    // `goto` is absolute and must win over any delta sent alongside it.
    name: 'uses goto instead of delta when both are sent',
    request: { currentStep: 0, stepCount: 1, goto: 0, delta: 1 },
    expected: { outcome: 'showStep', step: 0 },
  },
  {
    // A goto past the last step also means the end.
    name: 'goes to the end on a goto past the last step',
    request: { currentStep: undefined, stepCount: 1, goto: 3 },
    expected: { outcome: 'goToEnd' },
  },
  {
    // From the start, -1 + (-1) is -2: there is no such step.
    name: 'refuses a target before the first step',
    request: { currentStep: undefined, stepCount: 1, delta: -1 },
    expected: { outcome: 'invalidStep' },
  },
] as const;

describe('choosePlayActionTarget', () => {
  it.each(playTargetScenarios)('$name', ({ request, expected }) => {
    // Arrange: the request comes from the scenario row above.

    // Act: decide where playAction should take the graphic.
    const target = choosePlayActionTarget(request);

    // Assert: the decision follows the OGraf v1 step rule.
    expect(target, 'playAction must follow the OGraf v1 step rule').toEqual(expected);
  });
});
