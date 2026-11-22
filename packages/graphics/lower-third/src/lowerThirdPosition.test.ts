/**
 * The lower third's place along the bottom: "Posição" (packages/graphics/lower-third,
 * BAJAOVRLAY-85)
 *
 * What this module is for:
 *   An item of the lower third ("Tarja") may say where it sits along the bottom of the
 *   stage: Esquerda (`left`, the design's own place), Centro (`center`) or Direita
 *   (`right`). Items saved before the setting existed say nothing, and must keep the left.
 *   lowerThirdModel.ts checks the value and picks the left when there is none;
 *   lowerThirdView.ts writes the choice on the box holding both pills as `data-position`,
 *   which lowerThirdStyles.ts turns into the place on the stage.
 *
 * What these tests prove:
 *   - Each of the three positions is accepted as sent, and data without a position too.
 *   - A position the graphic does not know (a typo, or a word in Portuguese) is refused
 *     with a pt-BR message naming the field "position".
 *   - Data without a position is placed on the left; data with one is placed there.
 *   - An update moves a lower third to another position and keeps its texts; an update
 *     sending the position as undefined (the operator cleared "Posição") puts it back
 *     on the left.
 *   - The view writes the chosen position on the pills' box, the left when none is
 *     given, and rewrites it in place when the data changes.
 *
 * What these tests deliberately do not cover:
 *   - Where the pills really land on the stage; jsdom draws nothing.
 *     e2e/lowerThirdPositions.e2e.ts measures each pill's x in Chromium for all three
 *     positions, and e2e/lowerThirdScreenshots.e2e.ts pins how they look.
 *   - The manifest's "position" field; lowerThirdManifest.test.ts and
 *     lowerThirdManifestDataAgreement.test.ts cover it.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import {
  choosePositionOfLowerThird,
  type LowerThirdData,
  mergePartialUpdateIntoLowerThirdData,
  parseCompleteLowerThirdData,
} from './lowerThirdModel.js';
import {
  findLowerThirdParts,
  type LowerThirdParts,
  renderLowerThirdTemplate,
  writeLowerThirdData,
} from './lowerThirdView.js';

/** Builds a narrator's lower third as an item saved before "Posição" existed sends it. */
function createNarratorDataWithoutPosition(): LowerThirdData {
  return { name: 'Ana Paula Ribeiro', role: 'Narradora' };
}

/** Draws the lower third's markup into a fresh container and returns its parts. */
function drawLowerThirdParts(): LowerThirdParts {
  const container = document.createElement('div');
  render(renderLowerThirdTemplate(), container);
  return findLowerThirdParts(container);
}

describe('checking the position in the data', () => {
  const acceptedPositionScenarios = [
    // Esquerda: the design's own place, chosen on purpose.
    { name: 'accepts the left ("Esquerda")', position: 'left' },
    // Centro: for a guest on the stage in the middle of the shot.
    { name: 'accepts the centre ("Centro")', position: 'center' },
    // Direita: for a person standing at the right of the shot.
    { name: 'accepts the right ("Direita")', position: 'right' },
  ];

  it.each(acceptedPositionScenarios)('$name', ({ position }) => {
    // Arrange: the narrator's data with the position from the scenario row above.
    const data = { ...createNarratorDataWithoutPosition(), position };

    // Act: check it as `load` does.
    const result = parseCompleteLowerThirdData(data);

    // Assert: accepted exactly as sent.
    expect(result, 'a known position must be accepted exactly as sent').toEqual({
      isValid: true,
      data,
    });
  });

  it('accepts data with no position, as items saved before the setting send it', () => {
    // Arrange: the narrator's data, without the field.
    const data = createNarratorDataWithoutPosition();

    // Act: check it as `load` does.
    const result = parseCompleteLowerThirdData(data);

    // Assert: accepted, with no position added to the data.
    expect(result, 'an item without "Posição" must still load').toEqual({ isValid: true, data });
  });

  const refusedPositionScenarios = [
    // A hand-written request in Portuguese: the values are the manifest's English words.
    { name: 'refuses the Portuguese word "direita"', position: 'direita' },
    // A plausible typo for the centre.
    { name: 'refuses "middle", which is not one of the three', position: 'middle' },
    // An empty text is not "no position": an absent field is how that is said.
    { name: 'refuses an empty position', position: '' },
  ];

  it.each(refusedPositionScenarios)('$name', ({ position }) => {
    // Arrange: the narrator's data with the bad position from the scenario row above.
    const data = { ...createNarratorDataWithoutPosition(), position };

    // Act: check it as `load` does.
    const result = parseCompleteLowerThirdData(data);

    // Assert: refused, and the pt-BR message names the field.
    expect(result, 'an unknown position must be refused, naming the field').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "position".',
    });
  });
});

describe('choosing where the lower third sits', () => {
  it('puts a lower third that names no position on the left, as before the setting', () => {
    // Arrange: the narrator's data, without a position.
    const data = createNarratorDataWithoutPosition();

    // Act: ask where it sits.
    const position = choosePositionOfLowerThird(data);

    // Assert: the left, where every lower third sat before BAJAOVRLAY-85.
    expect(position, 'no position must mean the left').toBe('left');
  });

  it('puts a lower third where its data asks', () => {
    // Arrange: the narrator's data, asking for the right.
    const data: LowerThirdData = { ...createNarratorDataWithoutPosition(), position: 'right' };

    // Act: ask where it sits.
    const position = choosePositionOfLowerThird(data);

    // Assert: the right, as asked.
    expect(position, 'the position in the data must be the one used').toBe('right');
  });
});

describe('changing the position with an update', () => {
  it('moves the lower third to the centre and keeps its texts', () => {
    // Arrange: the narrator on air on the left; the operator picks "Centro".
    const currentData = createNarratorDataWithoutPosition();
    const moveToTheCentre = { position: 'center' };

    // Act: merge the update into the current data.
    const result = mergePartialUpdateIntoLowerThirdData(currentData, moveToTheCentre);

    // Assert: now in the centre, the name and the role unchanged.
    expect(result, 'an update must move the lower third and keep its texts').toEqual({
      isValid: true,
      data: { name: 'Ana Paula Ribeiro', role: 'Narradora', position: 'center' },
    });
  });

  it('puts the lower third back on the left when the position is cleared', () => {
    // Arrange: the narrator on the right; the operator clears "Posição".
    const currentData: LowerThirdData = {
      ...createNarratorDataWithoutPosition(),
      position: 'right',
    };
    const clearedPosition = { position: undefined };

    // Act: merge the update, then ask where the result sits.
    const result = mergePartialUpdateIntoLowerThirdData(currentData, clearedPosition);
    const positionAfterTheUpdate = result.isValid
      ? choosePositionOfLowerThird(result.data)
      : 'refused';

    // Assert: accepted, and back on the left.
    expect(positionAfterTheUpdate, 'a cleared position must mean the left again').toBe('left');
  });
});

describe('the position written on the pills’ box', () => {
  it('marks the box "left" when the data names no position', () => {
    // Arrange: freshly drawn parts.
    const parts = drawLowerThirdParts();

    // Act: write the narrator's data, without a position.
    writeLowerThirdData(parts, createNarratorDataWithoutPosition());

    // Assert: the box says left, so the styles put it where it always was.
    expect(parts.pillsBox.dataset.position, 'no position must be drawn on the left').toBe('left');
  });

  it('rewrites the mark in place when the position changes', () => {
    // Arrange: parts showing the narrator in the centre.
    const parts = drawLowerThirdParts();
    writeLowerThirdData(parts, { ...createNarratorDataWithoutPosition(), position: 'center' });
    const pillsBoxBefore = parts.pillsBox;

    // Act: write the same narrator, now on the right.
    writeLowerThirdData(parts, { ...createNarratorDataWithoutPosition(), position: 'right' });

    // Assert: the same box, now marked right.
    expect(parts.pillsBox, 'the box must be the same element, not a rebuilt one').toBe(
      pillsBoxBefore,
    );
    expect(parts.pillsBox.dataset.position, 'the box must now say right').toBe('right');
  });
});
