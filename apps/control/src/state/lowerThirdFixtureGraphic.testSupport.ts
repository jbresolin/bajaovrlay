// Test support: a second graphic for the graphics slice, so tests can prove the control
// page treats every graphic alike and holds nothing written for the race clock alone. It
// is a lower third (the name band under a person on screen). No such package exists yet:
// the graphic is registered here the way the server would register it once built, on the
// "Tarja" layer the server seeds. Each function builds new objects on every call, so no
// test can change what another test sees.
import type { Graphic, Instance } from '@bajaovrlay/shared';

import { buildLowerThirdFixtureDataSchema } from '@/features/schemaForm/lowerThirdFixtureSchema.testSupport';

/** The id of the lower third in the graphics slice (its package folder name). */
export const lowerThirdFixtureGraphicId = 'lower-third-fixture';

/** The lower third as the server would register it, with the fixture's data schema. */
export function buildLowerThirdFixtureGraphic(): Graphic {
  return {
    id: lowerThirdFixtureGraphicId,
    manifest: {
      id: 'baja-lower-third-fixture',
      name: 'Tarja de entrevista',
      main: 'lower-third-fixture.js',
      schema: buildLowerThirdFixtureDataSchema(),
    },
    defaultLayerId: 'lower-third',
    category: 'lower-third',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** What makes one lower third on air different from another in the tests. */
export type LowerThirdInstanceDescription = {
  id: string;
  layerId: string;
  resolvedData: Record<string, unknown>;
  takenAt: string;
};

/** A lower third on the program output, on air as the renderer reported it. */
export function buildLowerThirdFixtureInstanceOnProgram(
  description: LowerThirdInstanceDescription,
): Instance {
  return {
    ...description,
    graphicId: lowerThirdFixtureGraphicId,
    target: 'program',
    currentStep: 0,
    status: 'on-air',
  };
}
