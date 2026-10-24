/**
 * The lower third's DOM writer (packages/graphics/lower-third)
 *
 * What this module is for:
 *   lowerThirdView.ts draws the lower third's markup once (the name pill, and under it
 *   the role pill with the role, a dot and the team line) and afterwards writes the data
 *   into it in place. A person in Cadastros often has no team, and a guest typed by hand
 *   may have nothing but a name, so every missing part must leave the shorter layout,
 *   never an empty box on air.
 *
 * What these tests prove, in the pt-BR text a viewer reads:
 *   - With a role and a team line: the name pill, and the role pill with the role, the
 *     dot and the team line.
 *   - With a role only: the role pill holds the role alone, with no dot.
 *   - With a team line only: the role pill holds the team line alone, with no dot.
 *   - With a name only, or a role and team line of blanks: the role pill is hidden
 *     altogether (the `hidden` attribute, which takes it out of the layout), and its
 *     parts are emptied, so nothing of it is drawn.
 *   - Writing new data into the same parts redraws them in place, nothing rebuilt.
 *
 * What these tests deliberately do not cover:
 *   - How the pills look and where they sit; jsdom draws nothing.
 *     e2e/lowerThirdScreenshots.e2e.ts pins the lower third with and without a role on
 *     the grey and the black stage, and checks the role pill takes no room when absent.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { LowerThirdData } from './lowerThirdModel.js';
import {
  findLowerThirdParts,
  type LowerThirdParts,
  renderLowerThirdTemplate,
  writeLowerThirdData,
} from './lowerThirdView.js';

/** Draws the lower third's markup into a fresh container and returns its parts. */
function drawLowerThirdParts(): LowerThirdParts {
  const container = document.createElement('div');
  render(renderLowerThirdTemplate(), container);
  return findLowerThirdParts(container);
}

/**
 * Describes what a viewer sees: the text of every part that is shown, by part name, and
 * nothing for a hidden part or one inside the hidden role pill.
 */
function describeShownParts(parts: LowerThirdParts): Record<string, string> {
  const shownTextByPart: Record<string, string> = {};
  const partsToRead: Array<[string, HTMLElement, HTMLElement[]]> = [
    ['namePill', parts.namePill, []],
    ['role', parts.role, [parts.rolePill]],
    ['separator', parts.separator, [parts.rolePill]],
    ['teamLine', parts.teamLine, [parts.rolePill]],
  ];
  for (const [partName, part, containers] of partsToRead) {
    const isInsideAHiddenContainer = containers.some((container) => container.hidden);
    if (!part.hidden && !isInsideAHiddenContainer) {
      shownTextByPart[partName] = part.textContent ?? '';
    }
  }
  return shownTextByPart;
}

const layoutScenarios: Array<{
  name: string;
  data: LowerThirdData;
  expectedShownParts: Record<string, string>;
}> = [
  {
    // The design's own lower third: a team captain with her team.
    name: 'shows the name, then the role, a dot and the team line',
    data: { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' },
    expectedShownParts: {
      namePill: 'Mariana Costa',
      role: 'Capitã da equipe',
      separator: '·',
      teamLine: 'Baja UFMG · UFMG',
    },
  },
  {
    // The typical item: a person from Cadastros, a narrator with no team.
    name: 'shows the role alone in the role pill when there is no team line, with no dot',
    data: { name: 'Ana Paula Ribeiro', role: 'Narradora' },
    expectedShownParts: { namePill: 'Ana Paula Ribeiro', role: 'Narradora' },
  },
  {
    // A team line typed for a guest whose role the operator left out.
    name: 'shows the team line alone in the role pill when there is no role, with no dot',
    data: { name: 'Mariana Costa', teamLine: 'Baja UFMG · UFMG' },
    expectedShownParts: { namePill: 'Mariana Costa', teamLine: 'Baja UFMG · UFMG' },
  },
  {
    // A guest with nothing but a name: the name pill alone.
    name: 'shows the name pill alone when there is neither a role nor a team line',
    data: { name: 'Ana Paula Ribeiro' },
    expectedShownParts: { namePill: 'Ana Paula Ribeiro' },
  },
  {
    // Fields cleared by typing spaces count as missing, so no empty pill goes on air.
    name: 'treats a role and a team line of blanks as missing',
    data: { name: 'Ana Paula Ribeiro', role: '  ', teamLine: ' ' },
    expectedShownParts: { namePill: 'Ana Paula Ribeiro' },
  },
];

describe('the layout chosen from the data', () => {
  it.each(layoutScenarios)('$name', ({ data, expectedShownParts }) => {
    // Arrange: freshly drawn parts; the data comes from the scenario row above.
    const parts = drawLowerThirdParts();

    // Act: write the data into them.
    writeLowerThirdData(parts, data);

    // Assert: exactly the parts the data fills are shown, with their text.
    expect(describeShownParts(parts), 'only the parts the data fills may be shown').toEqual(
      expectedShownParts,
    );
  });
});

describe('a lower third with a name only', () => {
  it('hides the role pill and empties its parts, so nothing of it is drawn', () => {
    // Arrange: freshly drawn parts.
    const parts = drawLowerThirdParts();

    // Act: write a name with no role and no team line.
    writeLowerThirdData(parts, { name: 'Ana Paula Ribeiro' });

    // Assert: the role pill is out of the layout and holds no text that could show.
    expect(parts.rolePill.hidden, 'the role pill must be hidden, not an empty box').toBe(true);
    expect(
      [parts.role.textContent, parts.teamLine.textContent],
      'the hidden role pill must hold no leftover text',
    ).toEqual(['', '']);
  });
});

describe('writing new data into the same parts', () => {
  it('redraws in place: the role pill comes back with the new role, the elements unchanged', () => {
    // Arrange: parts showing a name only.
    const parts = drawLowerThirdParts();
    writeLowerThirdData(parts, { name: 'Ana Paula Ribeiro' });
    const rolePillBefore = parts.rolePill;

    // Act: write the same name with a role and a team line.
    writeLowerThirdData(parts, {
      name: 'Ana Paula Ribeiro',
      role: 'Narradora',
      teamLine: 'Transmissão oficial',
    });

    // Assert: the same role pill element is shown again, now with the role and team line.
    expect(parts.rolePill, 'the role pill must be the same element, not a rebuilt one').toBe(
      rolePillBefore,
    );
    expect(describeShownParts(parts), 'the role pill must come back with its text').toEqual({
      namePill: 'Ana Paula Ribeiro',
      role: 'Narradora',
      separator: '·',
      teamLine: 'Transmissão oficial',
    });
  });
});
