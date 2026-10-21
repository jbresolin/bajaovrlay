// Test support: a positions tower for the graphics slice, registered the way the server
// registers a built package, on the "Torre" layer the server seeds. Its data schema is
// the fixture of features/schemaForm (a list of cars with a suggested binding, a layout
// dropdown and column switches), not the real tower's manifest, so a reworded manifest
// does not break the item editor's tests. Each function builds new objects on every call.
import type { Graphic } from '@bajaovrlay/shared';

import { buildPositionsTowerFixtureDataSchema } from '@/features/schemaForm/positionsTowerFixtureSchema.testSupport';

/** The id of the tower in the graphics slice (its package folder name). */
export const positionsTowerFixtureGraphicId = 'positions-tower-fixture';

/** The tower as the server would register it, with the fixture's data schema. */
export function buildPositionsTowerFixtureGraphic(): Graphic {
  return {
    id: positionsTowerFixtureGraphicId,
    manifest: {
      id: 'baja-positions-tower-fixture',
      name: 'Torre de posições',
      main: 'positions-tower-fixture.js',
      schema: buildPositionsTowerFixtureDataSchema(),
      v_baja: { defaultLayerId: 'tower', category: 'positions' },
    },
    defaultLayerId: 'tower',
    category: 'positions',
    thumbnailUrl: null,
    defaultFields: {},
  };
}
