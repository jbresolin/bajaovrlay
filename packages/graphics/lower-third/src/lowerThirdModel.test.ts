/**
 * Lower third data model (packages/graphics/lower-third)
 *
 * What this module is for:
 *   Everything the lower third shows comes from one small data object: a person's name
 *   and, optionally, their role and a team line. The renderer sends the whole object to
 *   `load` and then the changed fields to `updateAction` (a field the operator emptied is
 *   sent as `undefined`). This module checks that data, merges the changes in, and
 *   explains in pt-BR what is wrong when the data is bad, so the graphic can answer 400
 *   instead of throwing.
 *
 * What these tests prove:
 *   - A complete lower third is accepted as it is, and so is the bare minimum: a name.
 *   - Data missing the name, with a name of blanks, with a role that is not text, with a
 *     field the graphic does not know, or that is not an object at all is refused with a
 *     pt-BR message naming the field.
 *   - A partial update changes only the fields it carries and keeps every other field; a
 *     field sent as `undefined` is cleared; an update that clears the name is refused.
 *   - A bad partial update leaves nothing half-applied.
 *
 * What these tests deliberately do not cover:
 *   - That the manifest's JSON Schema agrees with these rules;
 *     lowerThirdManifestDataAgreement.test.ts runs the same payloads through both.
 *   - What the component answers on the wire (status codes); lower-third.test.ts does.
 */
import { describe, expect, it } from 'vitest';

import {
  type LowerThirdData,
  mergePartialUpdateIntoLowerThirdData,
  parseCompleteLowerThirdData,
} from './lowerThirdModel.js';

/** Builds a team captain's lower third: Mariana Costa, captain of Baja UFMG. */
function createTeamCaptainData(): LowerThirdData {
  return { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' };
}

describe('parseCompleteLowerThirdData', () => {
  const acceptedDataScenarios = [
    // The everyday lower third, every field filled.
    { name: 'accepts a complete lower third unchanged', data: createTeamCaptainData() },
    // A narrator from Cadastros: a name and a role, no team.
    {
      name: 'accepts a name with a role and no team line',
      data: { name: 'Ana Paula Ribeiro', role: 'Narradora' },
    },
    // A guest the operator types by hand with nothing but a name.
    { name: 'accepts the bare minimum: a name', data: { name: 'Ana Paula Ribeiro' } },
  ];

  it.each(acceptedDataScenarios)('$name', ({ data }) => {
    // Arrange: the data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteLowerThirdData(data);

    // Assert: it is valid and comes back exactly as sent.
    expect(result, 'correct data must be accepted exactly as sent').toEqual({
      isValid: true,
      data,
    });
  });

  const refusedDataScenarios = [
    {
      // The name is what the lower third is for; without it there is nothing to show.
      name: 'refuses data missing the name',
      data: { role: 'Narradora' },
      expectedProblem: 'Falta o campo obrigatório "name".',
    },
    {
      // An empty name would put an empty pill on air.
      name: 'refuses an empty name',
      data: { name: '' },
      expectedProblem: 'Valor inválido no campo "name".',
    },
    {
      // A name of spaces is just as empty on air.
      name: 'refuses a name of blanks',
      data: { name: '   ', role: 'Narradora' },
      expectedProblem: 'Valor inválido no campo "name".',
    },
    {
      // A number where the role goes is a binding to the wrong attribute (a car number).
      name: 'refuses a role that is not text',
      data: { name: 'Mariana Costa', role: 2 },
      expectedProblem: 'Valor inválido no campo "role".',
    },
    {
      // A typo in a field name would otherwise be silently ignored.
      name: 'refuses a field the graphic does not know, such as a typo',
      data: { name: 'Mariana Costa', team: 'Baja UFMG' },
      expectedProblem: 'Campo desconhecido nos dados: "team".',
    },
    {
      // Something that is not an object at all, such as a name sent on its own.
      name: 'refuses something that is not a data object',
      data: 'Mariana Costa',
      expectedProblem: 'Dados inválidos: era esperado um objeto com os dados da tarja.',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, expectedProblem }) => {
    // Arrange: the bad data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteLowerThirdData(data);

    // Assert: it is refused with a pt-BR message that names the problem.
    expect(result, 'bad data must be refused with a pt-BR message naming the field').toEqual({
      isValid: false,
      problem: expectedProblem,
    });
  });
});

describe('mergePartialUpdateIntoLowerThirdData', () => {
  it('changes only the fields the update carries and keeps the rest', () => {
    // Arrange: the captain on air; the operator corrects her role.
    const currentData = createTeamCaptainData();
    const roleUpdate = { role: 'Piloto' };

    // Act: merge the update into the current data.
    const result = mergePartialUpdateIntoLowerThirdData(currentData, roleUpdate);

    // Assert: only the role changed; the name and the team line are untouched.
    expect(result, 'a partial update must change only the fields it carries').toEqual({
      isValid: true,
      data: { name: 'Mariana Costa', role: 'Piloto', teamLine: 'Baja UFMG · UFMG' },
    });
  });

  it('clears a field the update sends as undefined, as the renderer does for an emptied field', () => {
    // Arrange: the captain on air; the operator empties the team line.
    const currentData = createTeamCaptainData();
    const clearedTeamLineUpdate = { teamLine: undefined };

    // Act: merge the update into the current data.
    const result = mergePartialUpdateIntoLowerThirdData(currentData, clearedTeamLineUpdate);

    // Assert: the team line is gone; the name and the role stay.
    expect(result.isValid, 'clearing an optional field must be accepted').toBe(true);
    expect(
      result.isValid ? result.data.teamLine : 'refused',
      'a field sent as undefined must be cleared, not kept',
    ).toBeUndefined();
    expect(
      result.isValid ? result.data.role : 'refused',
      'the role must survive clearing the team line',
    ).toBe('Capitã da equipe');
  });

  it('refuses an update that clears the name, and leaves the current data untouched', () => {
    // Arrange: the captain on air; an update that would empty the required name.
    const currentData = createTeamCaptainData();
    const clearedNameUpdate = { name: undefined, role: 'Piloto' };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoLowerThirdData(currentData, clearedNameUpdate);

    // Assert: refused, naming the field; the current data was not changed.
    expect(result, 'clearing the name must be refused with a pt-BR message').toEqual({
      isValid: false,
      problem: 'Falta o campo obrigatório "name".',
    });
    expect(currentData, 'a refused update must not apply even its good fields').toEqual(
      createTeamCaptainData(),
    );
  });

  it('refuses an update carrying a field the graphic does not know', () => {
    // Arrange: an update with a field from the notice.
    const currentData = createTeamCaptainData();
    const updateForAnotherGraphic = { carNumber: 2 };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoLowerThirdData(currentData, updateForAnotherGraphic);

    // Assert: refused, naming the unknown field.
    expect(result, 'an unknown field must be refused, not ignored').toEqual({
      isValid: false,
      problem: 'Campo desconhecido nos dados: "carNumber".',
    });
  });
});
