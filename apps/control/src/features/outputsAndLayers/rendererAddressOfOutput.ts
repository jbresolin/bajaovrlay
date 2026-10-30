import { programOutputId } from '@bajaovrlay/shared';

/**
 * The address an OBS browser source loads to draw an output: `<origin>/render/` for
 * program, as every OBS setup made before outputs has it, and
 * `<origin>/render/?output=<id>` for any other. `origin` is the page's own
 * (`location.origin`): the server serves the control page and the renderer from the same
 * address, so this is the one OBS reaches too.
 */
export function buildRendererAddressOfOutput(origin: string, outputId: string): string {
  if (outputId === programOutputId) {
    return `${origin}/render/`;
  }
  return `${origin}/render/?output=${encodeURIComponent(outputId)}`;
}
