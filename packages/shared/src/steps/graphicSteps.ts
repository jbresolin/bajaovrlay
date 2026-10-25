import type { Graphic } from '../slices/graphic.js';
import type { Instance } from '../slices/instance.js';
import { findStepCounter } from './stepCounters.js';

/**
 * How many OGraf steps a graphic has, read from its manifest's `stepCount`: a whole number
 * of 1 or more. Anything else (left out, OGraf's -1 for "not known in advance", a typo)
 * reads as 1, a graphic with no "Próximo": a step the server cannot count could never be
 * offered honestly, and the operator still has "Limpar". An unknown graphic has 1 too.
 */
export function readStepCountOfGraphic(graphic: Graphic | undefined): number {
  const stepCount: unknown = graphic?.manifest.stepCount;
  const isCountOfSteps = typeof stepCount === 'number' && Number.isInteger(stepCount);
  if (!isCountOfSteps || stepCount < 1) {
    return 1;
  }
  return stepCount;
}

/**
 * How many steps this instance of the graphic has. A manifest with OGraf's `stepCount: -1`
 * ("dynamic") and a known `v_baja.stepCounter` counts them from the instance's data
 * (stepCounters.ts: the bracket, BAJAOVRLAY-25); any other reads the manifest's number
 * (readStepCountOfGraphic), so -1 with no counter, or an unknown one, is still 1.
 */
export function readStepCountOfInstance(instance: Instance, graphic: Graphic | undefined): number {
  const stepCounterName = graphic?.manifest.v_baja?.stepCounter;
  const isCountedFromTheData = graphic?.manifest.stepCount === -1 && stepCounterName !== undefined;
  if (isCountedFromTheData) {
    const stepCounter = findStepCounter(stepCounterName);
    if (stepCounter !== undefined) {
      return stepCounter(instance.resolvedData);
    }
  }
  return readStepCountOfGraphic(graphic);
}

/**
 * The step "Próximo" moves an instance to (BAJAOVRLAY-47: the podium reveals one card per
 * step; BAJAOVRLAY-25: the bracket one board or tree round), or undefined on its last step. Steps count from 0, so a graphic of 4 steps goes
 * 0, 1, 2, 3; past the last there is nothing to go to, and leaving the air is "Limpar".
 */
export function findNextStepOfInstance(
  instance: Instance,
  graphic: Graphic | undefined,
): number | undefined {
  const nextStep = instance.currentStep + 1;
  if (nextStep >= readStepCountOfInstance(instance, graphic)) {
    return undefined;
  }
  return nextStep;
}
