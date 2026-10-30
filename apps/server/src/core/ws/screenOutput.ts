import { programOutputId } from '@bajaovrlay/shared';

/**
 * The output a screen draws, from the `output` field of its address
 * (`/ws?role=renderer&output=pip`, or `/api/v1/state?role=renderer&output=pip`): that
 * output, or program when the field is missing or empty, so an OBS source set up before
 * outputs existed (BAJAOVRLAY-49) keeps drawing program. An id no output has is kept as
 * it is: the screen then gets no layer and draws nothing, which beats putting program's
 * graphics in the wrong OBS scene because of a typo.
 */
export function readOutputIdOfAScreen(outputInTheAddress: string | null): string {
  if (outputInTheAddress === null || outputInTheAddress === '') {
    return programOutputId;
  }
  return outputInTheAddress;
}

/**
 * The `output` field of an upgrade request's address, read as readOutputIdOfAScreen does;
 * program when the target is not a URL (`new URL` throws on targets such as `http://[`,
 * and a throw inside the hub's connection listener would crash the server).
 */
export function readOutputIdFromRequestTarget(requestTarget: string | undefined): string {
  try {
    const address = new URL(requestTarget ?? '/', 'http://localhost');
    return readOutputIdOfAScreen(address.searchParams.get('output'));
  } catch {
    return programOutputId;
  }
}
