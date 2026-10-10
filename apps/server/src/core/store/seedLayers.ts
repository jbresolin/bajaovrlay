import type { Layer } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * The fixed layers seeded on the first boot, bottom to top. The z-indexes leave gaps of
 * ten so a layer can be slotted in between later without renumbering the others.
 *
 * Every layer swaps graphics `out-then-in`, the safest policy: two graphics never
 * overlap on the same layer. The logo and the clock are `persistent`, the two things
 * meant to stay on screen across rundown items (the flag has no effect until M1).
 */
export const seededLayers: Layer[] = [
  {
    id: 'bug',
    name: ptBR.seededLayerNames.bug,
    zIndex: 10,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'ticker',
    name: ptBR.seededLayerNames.ticker,
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'clock',
    name: ptBR.seededLayerNames.clock,
    zIndex: 30,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'lower-third',
    name: ptBR.seededLayerNames.lowerThird,
    zIndex: 40,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'fullscreen',
    name: ptBR.seededLayerNames.fullscreen,
    zIndex: 50,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
];
