/**
 * Item editor: the fields of the chosen graphic and what they open with (apps/control)
 *
 * What this module is for:
 *   The item editor draws the fields of a graphic from the graphic's manifest. At the
 *   moment it starts drawing a graphic, fillGraphicFieldsOfItemEditor decides
 *   three things together: which fields there are, what each opens with, and which
 *   stored values could not be shown. A new item opens with the manifest's defaults; a
 *   stored item opens with what it stores.
 *
 * What these tests prove:
 *   - A new race clock item opens with the manifest's defaults and with its reference
 *     moment left for the server to stamp at the take.
 *   - A stored race clock item opens with its stored values, each field in the kind it
 *     is stored in, and with nothing reported as unreadable.
 *   - A stored value the form cannot show is replaced by the default and its label is
 *     reported, so the panel can warn the operator.
 *   - A new item of another graphic (the interview lower third) gets that graphic's
 *     fields and defaults, with no code written for it.
 *   - A graphic whose manifest has no data schema has no fields at all.
 *
 * What these tests deliberately do not cover:
 *   - Reading a manifest into fields, and filling them, case by case:
 *     features/schemaForm (describeSchemaFormFromDataSchema.test.ts,
 *     buildSchemaFormValues.test.ts, buildSchemaFormValuesFromItemFields.test.ts).
 *   - When the panel starts a new form (another graphic chosen, graphics arriving late):
 *     ItemEditorPanelOtherGraphic.test.tsx and ItemEditorPanel.test.tsx.
 *   - An item whose graphic the server no longer has: the panel draws no fields for it
 *     and never calls this function (ItemEditorPanelOtherGraphic.test.tsx).
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { fillGraphicFieldsOfItemEditor } from './graphicFieldsOfItemEditor';
import { buildEnduranceStartClockItem } from './itemsLikeTheEditorSaves.testSupport';

describe('fillGraphicFieldsOfItemEditor', () => {
  it("opens a new race clock item with the manifest's defaults and the reference moment left to the take", () => {
    // Arrange: the race clock as the server registers it, and no stored item.
    const raceClockGraphic = buildRaceClockGraphic();

    // Act: generate and fill the fields for a new item.
    const graphicFields = fillGraphicFieldsOfItemEditor(raceClockGraphic, null);

    // Assert: seven fields, in the manifest's order, at the manifest's defaults; the
    // wall-clock field is "filled at the take" and every other field is typed.
    expect(
      graphicFields.description.fields.map((field) => field.key),
      'the fields must be the properties of the manifest, in its order',
    ).toEqual([
      'sessionName',
      'state',
      'clockMode',
      'referenceTimeMs',
      'referenceWallClockMs',
      'running',
      'lapsCompletedByLeader',
    ]);
    expect(
      graphicFields.formValues.values,
      'a new item must open with the defaults of the manifest',
    ).toMatchObject({
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'elapsed',
      referenceTimeMs: '0:00',
      running: false,
      lapsCompletedByLeader: null,
    });
    expect(
      graphicFields.formValues.kinds.referenceWallClockMs,
      'the reference moment of a new item must be left for the server to stamp',
    ).toBe('takeTime');
    expect(
      graphicFields.labelsOfFieldsThatCouldNotBeRead,
      'a new item has no stored value that could fail to be read',
    ).toEqual([]);
  });

  it('opens a stored race clock item with what it stores', () => {
    // Arrange: the item prepared for the endurance start: stopped at 240:00, counting down.
    const raceClockGraphic = buildRaceClockGraphic();
    const storedItem = buildEnduranceStartClockItem();

    // Act: generate and fill the fields for that item.
    const graphicFields = fillGraphicFieldsOfItemEditor(raceClockGraphic, storedItem);

    // Assert: the stored values, the time as mm:ss, the reference moment still left to
    // the take, and nothing to warn about.
    expect(
      graphicFields.formValues.values,
      'a stored item must open with the values it stores',
    ).toMatchObject({
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'remaining',
      referenceTimeMs: '240:00',
      running: false,
      lapsCompletedByLeader: null,
    });
    expect(
      graphicFields.formValues.kinds.referenceWallClockMs,
      'a field stored as "the moment of the take" must open as that',
    ).toBe('takeTime');
    expect(
      graphicFields.labelsOfFieldsThatCouldNotBeRead,
      'an item the form can show in full must report nothing',
    ).toEqual([]);
  });

  it('reports the label of a stored value the form cannot show, and opens it with the default', () => {
    // Arrange: the same item with a clock mode a script stored as "countdown", which is
    // not one of the two modes the manifest offers.
    const enduranceStartItem = buildEnduranceStartClockItem();
    const itemWithAModeTheFormCannotShow: Item = {
      ...enduranceStartItem,
      fields: {
        ...enduranceStartItem.fields,
        clockMode: { kind: 'literal', value: 'countdown' },
      },
    };

    // Act: generate and fill the fields for that item.
    const graphicFields = fillGraphicFieldsOfItemEditor(
      buildRaceClockGraphic(),
      itemWithAModeTheFormCannotShow,
    );

    // Assert: the field shows the manifest's default and is named for the warning.
    expect(
      graphicFields.formValues.values.clockMode,
      'a value that cannot be shown must open as the default of the manifest',
    ).toBe('elapsed');
    expect(
      graphicFields.labelsOfFieldsThatCouldNotBeRead,
      'the field must be reported by the label the operator sees',
    ).toEqual(['Modo do relógio']);
  });

  it('gives a new item of the interview lower third the fields and defaults of that graphic', () => {
    // Arrange: the second graphic, which exists only as a manifest.
    const lowerThirdGraphic = buildLowerThirdFixtureGraphic();

    // Act: generate and fill the fields for a new item.
    const graphicFields = fillGraphicFieldsOfItemEditor(lowerThirdGraphic, null);

    // Assert: the lower third's own defaults (its 8 000 ms on air shown as mm:ss).
    expect(
      graphicFields.formValues.values,
      'the fields must open with the defaults of the lower third’s manifest',
    ).toMatchObject({ equipe: 'baja-ufpr', duracaoMs: '0:08', destaque: false });
    expect(
      graphicFields.formValues.kinds,
      'the lower third has no wall-clock field, so every field is a typed value',
    ).toMatchObject({ nome: 'literal', equipe: 'literal', duracaoMs: 'literal' });
  });

  it('has no fields for a graphic whose manifest has no data schema', () => {
    // Arrange: the competition's logo, a graphic that shows no data.
    const competitionLogoGraphic: Graphic = {
      id: 'competition-logo',
      manifest: { id: 'baja-competition-logo', name: 'Logo da competição', main: 'logo.js' },
      defaultLayerId: 'bug',
      category: 'bug',
      thumbnailUrl: null,
      defaultFields: {},
    };

    // Act: generate and fill the fields for a new item.
    const graphicFields = fillGraphicFieldsOfItemEditor(competitionLogoGraphic, null);

    // Assert: nothing to draw and nothing to send, and that is not an error.
    expect(graphicFields.description.fields, 'without a data schema there are no fields').toEqual(
      [],
    );
    expect(graphicFields.formValues.values, 'a form without fields must hold no values').toEqual(
      {},
    );
  });
});
