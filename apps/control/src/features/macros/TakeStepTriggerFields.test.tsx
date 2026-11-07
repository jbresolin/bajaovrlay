/**
 * A take step's "Campos do gatilho" with long names (apps/control)
 *
 * What this module is for:
 *   Under a "Pôr item no ar" step of the macro editor, each field of the item's graphic says
 *   where its value comes from, and "Dado do gatilho › <chave>" takes a key typed by the
 *   operator (BAJAOVRLAY-48). The editor sits in the console's narrow right column, so a
 *   long key or a long field title is cut to fit its row (João's check of PR #43).
 *
 * What these tests prove:
 *   - A key too long for its box is still readable whole: the box's tooltip carries it.
 *   - A field title too long for its place is readable whole in its tooltip too.
 *
 * What these tests deliberately do not cover:
 *   - That every control stays inside the step's box at the column's width: jsdom draws
 *     no layout, so a real Chromium measures it in triggerFieldsFitTheirBox.e2e.ts.
 *   - Choosing the source and saving the step; MacroEditorPanelTriggerData.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TakeStepTriggerFields } from './TakeStepTriggerFields';

// A key as a timing system's webhook might name it: far longer than the box is wide.
const longTriggerKey = 'nome_do_piloto_entrevistado_no_box_da_equipe_42_baja_ufpr';
// A field title as a sponsor's graphic might name it.
const longFieldTitle = 'Nome do piloto entrevistado no box da equipe';

describe('the take step’s trigger fields with long names', () => {
  it('shows a long key whole in the tooltip of its box', () => {
    // Arrange: the lower third's "Nome" reading the trigger's long key.
    const fields = [{ fieldKey: 'name', title: 'Nome', isRequired: true }];

    // Act: draw the step's fields.
    render(
      <TakeStepTriggerFields
        stepNumber={1}
        fields={fields}
        triggerKeyByFieldKey={{ name: longTriggerKey }}
        onTriggerKeysChanged={vi.fn<(keys: Record<string, string>) => void>()}
      />,
    );

    // Assert: hovering the key's box shows the whole key.
    expect(
      screen.getByLabelText('Chave do gatilho para Nome no passo 1'),
      'a key cut by its box must be readable whole in its tooltip',
    ).toHaveAttribute('title', longTriggerKey);
  });

  it('shows a long field title whole in its tooltip', () => {
    // Arrange: one optional field with a long title, read from the item.
    const fields = [{ fieldKey: 'pilotName', title: longFieldTitle, isRequired: false }];

    // Act: draw the step's fields.
    render(
      <TakeStepTriggerFields
        stepNumber={1}
        fields={fields}
        triggerKeyByFieldKey={{ pilotName: 'piloto' }}
        onTriggerKeysChanged={vi.fn<(keys: Record<string, string>) => void>()}
      />,
    );

    // Assert: hovering the title shows it whole.
    expect(
      screen.getByText(longFieldTitle),
      'a title cut to fit its row must be readable whole in its tooltip',
    ).toHaveAttribute('title', longFieldTitle);
  });
});
