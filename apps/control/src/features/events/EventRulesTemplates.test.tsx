/**
 * "Regras" shows each kind's template, and swaps, edits, previews and makes them
 * (apps/control)
 *
 * What this module is for:
 *   The event templates ("Penalidade", "Volta mais rápida", "Super Chat") used to sit on a
 *   quick-fire panel, buttons that refused every press. They are the look of each kind of
 *   event, so since BAJAOVRLAY-67 they live beside the rule that chooses them: each row of
 *   "Regras" says "Aparece como: Penalidade", and offers "Trocar" (any template the kind's
 *   events fill, or none), "Editar aparência" (the item editor, in the same box), "Prévia"
 *   (the template filled from the kind's sample event) and "+ Novo modelo" (a template on a
 *   graphic chosen there, its fields named like the kind's payload already read from the
 *   event).
 *
 * What these tests prove:
 *   - Each row says the template it appears as, or that it has none.
 *   - "Trocar" offers only the templates the kind's events fill; swapping and "Salvar"
 *     sends updateEventRule naming the new one.
 *   - "Prévia" sends previewItem of the template with the row's kind for its sample.
 *   - "Editar aparência" opens the item editor on the template, with its banner, and
 *     "Cancelar" brings the rules back.
 *   - "+ Novo modelo" offers the graphics a template of the kind can be made on, and saves
 *     a template in "Modelos de evento" whose fields read the event.
 *
 * What these tests deliberately do not cover:
 *   - Modes and times of a rule; EventRulesDialog.test.tsx.
 *   - The editor's own behaviour on a template; ItemEditorPanelEventTemplate.test.tsx.
 *   - The server's refusals; apps/server's eventTemplatesOffQuickFire.test.ts.
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildEnduranceStartClockItem } from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import {
  buildRulesNamingTheSeededTemplates,
  buildSeededPenaltyTemplate,
  buildSlicesWithTheNoticeTemplates,
} from '@/features/items/noticeTemplates.testSupport';
import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { EventReviewPage } from './EventReviewPage';

/** A race clock whose title reads a Super Chat's viewer: the Super Chat rule's template. */
function buildSuperChatClockTemplate(): Item {
  const clockItem = buildEnduranceStartClockItem();
  return {
    ...clockItem,
    id: 'relogio-super-chat',
    home: { kind: 'eventTemplates' },
    order: 2,
    label: 'Relógio do Super Chat',
    fields: { ...clockItem.fields, sessionName: { kind: 'eventField', path: 'authorName' } },
  };
}

/** A second penalty template, "Penalidade reserva", which no rule uses yet. */
function buildSparePenaltyTemplate(): Item {
  return {
    ...buildSeededPenaltyTemplate(),
    id: 'penalidade-reserva',
    label: 'Penalidade reserva',
    order: 3,
  };
}

/** The "Eventos" page with the notice templates and the clock one, and "Regras" open. */
function openTheRulesWithTheTemplates() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheNoticeTemplates(
      [buildSuperChatClockTemplate(), buildSparePenaltyTemplate()],
      buildRulesNamingTheSeededTemplates('relogio-super-chat'),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Regras' }));
  return controlPage;
}

/** The row of one kind of event in the rules, by its name. */
function findRuleRow(kindName: string) {
  return within(screen.getByRole('group', { name: kindName }));
}

/** The options a dropdown offers, by its accessible name, as the operator reads them. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

describe('the template of each rule', () => {
  it('says what each kind appears as, or that it has no template', () => {
    // Arrange: João's default rules, leader changes with no template.
    openTheRulesWithTheTemplates();

    // Act: read two rows.
    const incidentRowText = screen.getByRole('group', { name: 'Incidente' }).textContent;
    const leaderChangeRowText = screen.getByRole('group', { name: 'Mudança de líder' }).textContent;

    // Assert: the template's name, or "nenhum modelo".
    expect(incidentRowText, 'incidents appear as "Penalidade"').toContain(
      'Aparece como: Penalidade',
    );
    expect(leaderChangeRowText, 'leader changes have none yet').toContain(
      'Aparece como: nenhum modelo',
    );
  });

  const swapScenarios = [
    // A penalty template has nothing of a viewer's message, and the reverse.
    { kindName: 'Incidente', expected: ['Nenhum', 'Penalidade', 'Penalidade reserva'] },
    // A fastest lap carries no reason or penalty: only its own template.
    { kindName: 'Volta mais rápida', expected: ['Nenhum', 'Volta mais rápida'] },
    // A viewer's message: only the template reading the viewer.
    { kindName: 'Super Chat', expected: ['Nenhum', 'Relógio do Super Chat'] },
  ];

  it.each(swapScenarios)(
    'offers in "Trocar" of $kindName only the templates its events fill',
    ({ kindName, expected }) => {
      // Arrange: the rules open.
      openTheRulesWithTheTemplates();

      // Act: read the row's "Trocar".
      const options = readOptionsOfDropdown(`Trocar o modelo de ${kindName}`);

      // Assert: none, then the templates of the kind.
      expect(options, 'a template the kind cannot fill is never offered').toEqual(expected);
    },
  );

  it('swaps the template of typed events, and "Salvar" sends it', () => {
    // Arrange: the rules open.
    const { fakeServer } = openTheRulesWithTheTemplates();

    // Act: swap typed events to "Penalidade reserva" and save the row.
    chooseOptionInDropdown('Trocar o modelo de Evento digitado', 'Penalidade reserva');
    fireEvent.click(findRuleRow('Evento digitado').getByRole('button', { name: 'Salvar' }));

    // Assert: the rule sent naming the new template.
    expect(fakeServer.listCommandsReceived(), 'the row names the new template').toEqual([
      {
        type: 'updateEventRule',
        kind: 'manual',
        mode: 'ask',
        itemId: 'penalidade-reserva',
        durationMs: 10_000,
        maxAgeMs: null,
      },
    ]);
  });

  it("previews the template filled from the sample of the row's kind", () => {
    // Arrange: the rules open.
    const { fakeServer } = openTheRulesWithTheTemplates();

    // Act: "Prévia" on the typed events' row.
    fireEvent.click(findRuleRow('Evento digitado').getByRole('button', { name: 'Prévia' }));

    // Assert: a preview of "Penalidade" from a typed event's sample.
    expect(fakeServer.listCommandsReceived(), 'the template is previewed as a typed event').toEqual(
      [{ type: 'previewItem', itemId: 'penalidade', origin: 'manual', sampleEventKind: 'manual' }],
    );
  });
});

describe('"Editar aparência"', () => {
  it('opens the item editor on the template, and "Cancelar" brings the rules back', () => {
    // Arrange: the rules open.
    openTheRulesWithTheTemplates();

    // Act: "Editar aparência" on the incidents' row.
    fireEvent.click(findRuleRow('Incidente').getByRole('button', { name: 'Editar aparência' }));
    const labelInTheEditor = (screen.getByLabelText('Rótulo') as HTMLInputElement).value;
    const isTheBannerShown = screen.queryByRole('note', { name: 'Modelo de evento' }) !== null;
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert: the editor was on "Penalidade", saying it is a template; the rows are back.
    expect(labelInTheEditor, 'the editor opens on the row’s template').toBe('Penalidade');
    expect(isTheBannerShown, 'it says it is a template').toBe(true);
    expect(
      screen.getByRole('group', { name: 'Incidente' }),
      'the rules are back once the editor closes',
    ).toBeInTheDocument();
  });
});

describe('"+ Novo modelo"', () => {
  it('offers the graphics a template of the kind can be made on', () => {
    // Arrange: the rules open; the page knows the race clock, the lower third and the notice.
    openTheRulesWithTheTemplates();

    // Act: read the graphics offered for a new incidents' template.
    const options = readOptionsOfDropdown('Gráfico do novo modelo de Incidente');

    // Assert: the notice alone: no field of the clock or the lower third is named like a
    // field an incident carries.
    expect(options, 'only graphics an incident can fill').toEqual(['Aviso']);
  });

  it('saves a template in "Modelos de evento" whose fields read the event', async () => {
    // Arrange: the rules open, the notice chosen for a new incidents' template.
    const { fakeServer } = openTheRulesWithTheTemplates();
    chooseOptionInDropdown('Gráfico do novo modelo de Incidente', 'Aviso');

    // Act: "+ Novo modelo", name it, and save it.
    fireEvent.click(findRuleRow('Incidente').getByRole('button', { name: '+ Novo modelo' }));
    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: 'Penalidade grande' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: a new template, its incident fields read from the event.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived()[0], 'a new template is created').toMatchObject({
        type: 'createItem',
        home: { kind: 'eventTemplates' },
        graphicId: 'notice',
        layerId: 'notice',
        label: 'Penalidade grande',
        fields: {
          carNumber: { kind: 'eventField', path: 'carNumber' },
          teamName: { kind: 'eventField', path: 'teamName' },
          schoolName: { kind: 'eventField', path: 'schoolName' },
          noticeKind: { kind: 'eventField', path: 'noticeKind' },
          reason: { kind: 'eventField', path: 'reason' },
          penaltyText: { kind: 'eventField', path: 'penaltyText' },
        },
      });
    });
  });
});
