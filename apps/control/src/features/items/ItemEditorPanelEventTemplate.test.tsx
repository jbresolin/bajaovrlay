/**
 * The item editor says what an event template is (apps/control)
 *
 * What this module is for:
 *   An item whose fields read an event is a template: it is the look of a kind of event,
 *   filled at each one (BAJAOVRLAY-67). Opened from "Regras" ("Editar aparência"), the
 *   editor says so in a banner worded per kind ("Modelo de evento: preenchido a cada…"),
 *   each field read from the event says "Do evento › Tempo da volta (texto)" with the value
 *   of the kind's sample event beside it, and the car picker (BAJAOVRLAY-66) gains a fourth
 *   way on a template, "Do evento": car, team and school read from the event, written as
 *   the same per-field event fields as before. A template whose car fields all read the
 *   event opens grouped on "Do evento", as the seeded notices do.
 *
 * What these tests prove:
 *   - Table-driven, the banner of each kind: "Penalidade" (incidents and typed events),
 *     "Volta mais rápida", a Super Chat template, and a template no rule uses yet; an
 *     ordinary item has none.
 *   - A field read from the event reads "Do evento › …" with the sample's value.
 *   - The seeded notices open with their car grouped on "Do evento", each car field read
 *     from the event with the sample's value.
 *   - A new template offers "Do evento", and saving stores the car, team and school as
 *     event fields; an item that is no template is not offered it.
 *
 * What these tests deliberately do not cover:
 *   - The other three ways of the car picker; ItemEditorPanelCarGroups.test.tsx.
 *   - The rest of the "Evento" kind; ItemEditorPanelEventFields.test.tsx.
 */
import type { Item } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import { buildEnduranceStartClockItem } from './itemsLikeTheEditorSaves.testSupport';
import {
  buildRulesNamingTheSeededTemplates,
  buildSeededFastestLapTemplate,
  buildSeededPenaltyTemplate,
  buildSlicesWithTheNoticeTemplates,
  noticeGraphicName,
} from './noticeTemplates.testSupport';

/** A race clock whose title reads a Super Chat's viewer: a template of the Super Chat rule. */
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

/** A copy of "Penalidade" no rule names yet, as "+ Novo modelo" leaves one. */
function buildPenaltyTemplateNoRuleUses(): Item {
  return {
    ...buildSeededPenaltyTemplate(),
    id: 'penalidade-reserva',
    label: 'Penalidade reserva',
    order: 3,
  };
}

/** The options a dropdown offers, by its accessible name, as the operator reads them. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

describe('the banner of an event template', () => {
  const bannerScenarios = [
    // Named by two rules: the incidents' and the typed events'.
    {
      name: 'says "Penalidade" is filled by every incident and every typed event',
      item: buildSeededPenaltyTemplate(),
      expectedBanner:
        'Modelo de evento: preenchido a cada ocorrência dos incidentes da fonte (penalidade, advertência ou incidente) e a cada evento digitado em "+ Evento" (penalidade ou aviso).',
    },
    // Named by the fastest laps' rule only.
    {
      name: 'says "Volta mais rápida" is filled by every new fastest lap',
      item: buildSeededFastestLapTemplate(),
      expectedBanner: 'Modelo de evento: preenchido a cada nova volta mais rápida, vinda da fonte.',
    },
    // Named by the Super Chat rule: a viewer's message, after a person's approval.
    {
      name: 'says a Super Chat template is filled by every approved Super Chat',
      item: buildSuperChatClockTemplate(),
      expectedBanner: 'Modelo de evento: preenchido a cada Super Chat aprovado.',
    },
    // A template "+ Novo modelo" made, before "Trocar" chose it for a rule.
    {
      name: 'says when no rule uses the template yet',
      item: buildPenaltyTemplateNoRuleUses(),
      expectedBanner:
        'Modelo de evento: nenhuma regra o usa ainda; escolha-o em "Trocar", nas regras dos eventos.',
    },
  ];

  it.each(bannerScenarios)('$name', ({ item, expectedBanner }) => {
    // Arrange: the rules name the seeded notices and, for Super Chats, the clock template.
    const slices = buildSlicesWithTheNoticeTemplates(
      [buildSuperChatClockTemplate(), buildPenaltyTemplateNoRuleUses()],
      buildRulesNamingTheSeededTemplates('relogio-super-chat'),
    );

    // Act: open the editor on the row's template.
    renderItemEditorPanelOnFakeServerWithSlices(item, slices);

    // Assert: the banner says what fills it.
    expect(
      screen.getByRole('note', { name: 'Modelo de evento' }).textContent,
      'the editor must say what this template is',
    ).toBe(expectedBanner);
  });

  it('shows no banner on an ordinary item', () => {
    // Arrange: the clock item of the enduro start, every field typed.
    const slices = buildSlicesWithTheNoticeTemplates();

    // Act: open the editor on it.
    renderItemEditorPanelOnFakeServerWithSlices(buildEnduranceStartClockItem(), slices);

    // Assert: no banner.
    expect(
      screen.queryByRole('note', { name: 'Modelo de evento' }),
      'an ordinary item is no template',
    ).toBeNull();
  });
});

describe('a field read from the event', () => {
  it('reads "Do evento › …" with the value of the sample event', () => {
    // Arrange: "Volta mais rápida", named by the fastest laps' rule.
    const slices = buildSlicesWithTheNoticeTemplates();

    // Act: open the editor on it.
    renderItemEditorPanelOnFakeServerWithSlices(buildSeededFastestLapTemplate(), slices);

    // Assert: the lap time and the lap read the sample fastest lap (4:38,2 on lap 34).
    expect(
      screen.getByText('Do evento › Tempo da volta (texto) · exemplo: 4:38,2'),
      'the lap time says where it comes from, with an example',
    ).toBeInTheDocument();
    expect(
      screen.getByText('Do evento › Volta · exemplo: 34'),
      'the lap says where it comes from, with an example',
    ).toBeInTheDocument();
  });
});

describe('the car of a template, "Do evento"', () => {
  const seededScenarios = [
    // The penalty's sample is car 47's incident.
    {
      name: '"Penalidade" opens grouped on "Do evento"',
      item: buildSeededPenaltyTemplate(),
      carNumber: '47',
    },
    // The fastest lap's sample is car 31's lap.
    {
      name: '"Volta mais rápida" opens grouped on "Do evento"',
      item: buildSeededFastestLapTemplate(),
      carNumber: '31',
    },
  ];

  it.each(seededScenarios)('$name', ({ item, carNumber }) => {
    // Arrange: the seeded notices, named by their rules.
    const slices = buildSlicesWithTheNoticeTemplates();

    // Act: open the editor on the row's template.
    renderItemEditorPanelOnFakeServerWithSlices(item, slices);

    // Assert: the car grouped on "Do evento", each field read from the sample event.
    expect(
      screen.getByRole('combobox', { name: 'Como escolher Carro' }).textContent,
      'a template whose car fields read the event opens grouped',
    ).toBe('Do evento');
    expect(
      within(screen.getByRole('list', { name: 'Valores agora' })).getByText(
        `Do evento › Carro · exemplo: ${carNumber}`,
      ),
      'the car field says where it comes from',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Campos separados — Carro' }),
      'it is grouped, not separate',
    ).not.toBeChecked();
  });

  it('is offered on a new template, and saving stores the car, team and school as event fields', async () => {
    // Arrange: a new item among the templates ("+ Novo modelo"), on the notice graphic.
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(
      null,
      buildSlicesWithTheNoticeTemplates(),
      { kind: 'eventTemplates' },
    );
    chooseGraphicInTheEditor(noticeGraphicName);
    typeIntoField('Rótulo', 'Aviso da direção');

    // Act: choose "Do evento" for the car, and save.
    chooseOptionInDropdown('Como escolher Carro', 'Do evento');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: a new template whose car, team and school read the event.
    expect(
      fakeServer.listCommandsReceived()[0],
      'the three car fields are stored as event fields',
    ).toMatchObject({
      type: 'createItem',
      home: { kind: 'eventTemplates' },
      fields: {
        carNumber: { kind: 'eventField', path: 'carNumber' },
        teamName: { kind: 'eventField', path: 'teamName' },
        schoolName: { kind: 'eventField', path: 'schoolName' },
      },
    });
  });

  it('is not offered on an item that is no template', () => {
    // Arrange: a new item of the main rundown, on the notice graphic.
    renderItemEditorPanelOnFakeServerWithSlices(null, buildSlicesWithTheNoticeTemplates());
    chooseGraphicInTheEditor(noticeGraphicName);

    // Act: read the ways the car may be chosen.
    const ways = readOptionsOfDropdown('Como escolher Carro');

    // Assert: the three of BAJAOVRLAY-66, no "Do evento".
    expect(ways, 'only a template reads its car from the event').toEqual([
      'Pelo número do carro',
      'Pelo lugar na corrida',
      'Digitado à mão',
    ]);
  });
});
