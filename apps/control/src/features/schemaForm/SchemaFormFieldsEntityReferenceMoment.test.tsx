/**
 * "Valor agora" of a moment read from Cadastros (apps/control)
 *
 * What this module is for:
 *   The countdown's start (`startsAtMs`, a whole number marked `v_baja.unit: "epochMs"`,
 *   BAJAOVRLAY-46) is usually read from a slot of the schedule: Cadastro › Sessão da
 *   programação › Início. The "Valor agora" line under it must read like the Programação
 *   tab, "30/03/2025 10:00", not thirteen digits of milliseconds (gate 2 of PR #28).
 *
 * What these tests prove:
 *   - The start of the enduro's slot reads "Valor agora: 30/03/2025 10:00" on the
 *     countdown's start field, on this computer's clock, as Cadastros writes it.
 *   - The session's name on the text field beside it still reads as it is.
 *
 * What these tests deliberately do not cover:
 *   - The other attributes and the image thumbnail; SchemaFormFieldsEntityReference.test.tsx.
 */
import type { EntityLibrary } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  chooseOptionInDropdown,
  renderSchemaFormOnTestPage,
} from './schemaFormOnTestPage.testSupport';

/** The countdown's two fields as its manifest declares them: the session and its start. */
function describeCountdownForm() {
  return describeSchemaFormFromDataSchema({
    type: 'object',
    properties: {
      sessionName: { type: 'string', title: 'Sessão', gddType: 'single-line' },
      startsAtMs: { type: 'integer', title: 'Largada', minimum: 0, v_baja: { unit: 'epochMs' } },
    },
    required: ['sessionName', 'startsAtMs'],
    additionalProperties: false,
  });
}

/** Sunday's enduro at 10:00 on this computer's clock, the one slot of the schedule. */
function buildLibraryWithTheEnduro(): EntityLibrary {
  return {
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [
      {
        slotId: 'enduro',
        sessionName: 'Enduro de Resistência',
        sessionKind: 'enduro',
        startsAtMs: new Date(2025, 2, 30, 10, 0).getTime(),
      },
    ],
  };
}

/** Sets one field to read an attribute of the enduro's slot. */
function readFieldFromTheEnduro(fieldTitle: string, attribute: string): void {
  chooseOptionInDropdown(`Como preencher ${fieldTitle}`, 'Cadastro');
  chooseOptionInDropdown(`Tipo de cadastro de ${fieldTitle}`, 'Sessão da programação');
  fireEvent.change(screen.getByLabelText(`Buscar cadastro de ${fieldTitle}`), {
    target: { value: 'Enduro' },
  });
  chooseOptionInDropdown(`Cadastro de ${fieldTitle}`, 'Programação: Enduro de Resistência');
  chooseOptionInDropdown(`Campo do cadastro de ${fieldTitle}`, attribute);
}

describe('"Valor agora" of a slot read from Cadastros', () => {
  it('writes the start as a date and time, the name as it is', () => {
    // Arrange: the countdown's form with the schedule handed, as the item editor does.
    const description = describeCountdownForm();
    renderSchemaFormOnTestPage({
      description,
      formValues: buildEmptySchemaFormValues(description),
      entityLibrary: buildLibraryWithTheEnduro(),
    });

    // Act: both fields read the enduro's slot, the start from "Início".
    readFieldFromTheEnduro('Sessão', 'Sessão');
    readFieldFromTheEnduro('Largada', 'Início');

    // Assert: the start as Cadastros writes it, the name as it is.
    expect(
      screen.getByText('Valor agora: 30/03/2025 10:00'),
      'the start reads as a date and time',
    ).toBeInTheDocument();
    expect(
      screen.getByText('Valor agora: Enduro de Resistência'),
      'the name reads as it is',
    ).toBeInTheDocument();
  });
});
