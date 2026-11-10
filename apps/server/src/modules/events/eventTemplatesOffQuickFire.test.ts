/**
 * Event templates never sit on a quick-fire panel (apps/server)
 *
 * What this module is for:
 *   An item with an "Evento" field is a template: it goes on air only through an event, so
 *   as a quick-fire button it refused every press and read as clutter (BAJAOVRLAY-67). It
 *   now lives in a home of its own, "Modelos de evento" (`{ kind: 'eventTemplates' }`),
 *   shown beside each rule in "Regras". The item commands keep it there: a template may not
 *   be created on, moved to or turned into a button of a panel, and an item that no event
 *   fills may not be put among the templates.
 *
 * What these tests prove:
 *   - createItem of a template on "Atalhos" is refused (TEMPLATE_NOT_ON_QUICK_FIRE), with a
 *     pt-BR reason naming the item and saying where it belongs.
 *   - moveItemToHome of the seeded "Penalidade" to "Atalhos" is refused the same way.
 *   - updateItemFields giving a button of "Atalhos" an "Evento" field is refused the same way.
 *   - createItem of a template in "Modelos de evento" is accepted, after the seeded three.
 *   - createItem of an item no event fills in "Modelos de evento" is refused
 *     (ITEM_NOT_FILLED_BY_EVENT), and so is taking a template's last "Evento" field away.
 *   - An ordinary item on "Atalhos" is still accepted.
 *
 * What these tests deliberately do not cover:
 *   - The one-time move of an older database; eventTemplatesLeaveQuickFireAtBoot.test.ts.
 *   - The control page, which offers no panel for a template; its own tests.
 */
import type { Item, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  createPlainClockItem,
  openEventInboxOnTheStore,
  operatorActor,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';

/** A typed green enduro on the race clock, the only graphic these tests build. */
function buildTypedEnduroFields(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'remaining' },
    referenceTimeMs: { kind: 'literal', value: 4_560_000 },
    referenceWallClockMs: { kind: 'literal', value: Date.parse(startOfTheTests) },
    running: { kind: 'literal', value: true },
  };
}

/** The same clock with its title read from the event's team: a template. */
function buildClockFieldsReadingTheTeam(): ItemFields {
  return { ...buildTypedEnduroFields(), sessionName: { kind: 'eventField', path: 'teamName' } };
}

/** The pt-BR reason a template on a panel is refused with, for this item's label. */
function reasonForATemplateOnAPanel(itemLabel: string): string {
  return `"${itemLabel}" é um modelo de evento e não fica num painel de atalhos: ele entra no ar pela aba Eventos, e sua aparência se escolhe em Regras.`;
}

/** The event templates, in "Modelos de evento", first to last. */
function listEventTemplateIds(items: Item[]): string[] {
  return items
    .filter((item) => item.home.kind === 'eventTemplates')
    .sort((first, second) => first.order - second.order)
    .map((item) => item.id);
}

describe('a template and the quick-fire panels', () => {
  it('refuses to create a template on "Atalhos"', () => {
    // Arrange: a new database.
    const { stateStore } = openEventInboxOnTheStore();

    // Act: create a clock reading the event's team on "Atalhos".
    const outcome = stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio da equipe',
        fields: buildClockFieldsReadingTheTeam(),
      },
      operatorActor,
    );

    // Assert: refused, naming the item and where it belongs.
    expect(outcome, 'a template may not become a button').toEqual({
      ok: false,
      error: {
        code: 'TEMPLATE_NOT_ON_QUICK_FIRE',
        message: reasonForATemplateOnAPanel('Relógio da equipe'),
      },
    });
  });

  it('refuses to move the seeded "Penalidade" to "Atalhos"', () => {
    // Arrange: a new database, its "Penalidade" among the templates.
    const { stateStore } = openEventInboxOnTheStore();

    // Act: move it to "Atalhos".
    const outcome = stateStore.applyCommand(
      {
        type: 'moveItemToHome',
        itemId: 'penalidade',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        order: 0,
      },
      operatorActor,
    );

    // Assert: refused, and it stays a template.
    expect(outcome, 'a template may not be moved onto a panel').toEqual({
      ok: false,
      error: {
        code: 'TEMPLATE_NOT_ON_QUICK_FIRE',
        message: reasonForATemplateOnAPanel('Penalidade'),
      },
    });
    expect(
      listEventTemplateIds(stateStore.readAllSlices().items),
      '"Penalidade" stays among the templates',
    ).toContain('penalidade');
  });

  it('refuses to give a button of "Atalhos" an "Evento" field', () => {
    // Arrange: an ordinary clock button on "Atalhos".
    const { stateStore } = openEventInboxOnTheStore();
    const itemId = createPlainClockItem(stateStore, 'Relógio do enduro');

    // Act: make its title read the event's team.
    const outcome = stateStore.applyCommand(
      {
        type: 'updateItemFields',
        itemId,
        fields: { sessionName: { kind: 'eventField', path: 'teamName' } },
      },
      operatorActor,
    );

    // Assert: refused: it would turn into a template on a panel.
    expect(outcome, 'a button may not turn into a template').toEqual({
      ok: false,
      error: {
        code: 'TEMPLATE_NOT_ON_QUICK_FIRE',
        message: reasonForATemplateOnAPanel('Relógio do enduro'),
      },
    });
  });

  it('still accepts an ordinary item on "Atalhos"', () => {
    // Arrange: a new database.
    const { stateStore } = openEventInboxOnTheStore();

    // Act: create a clock with every field typed on "Atalhos".
    const outcome = stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio do enduro',
        fields: buildTypedEnduroFields(),
      },
      operatorActor,
    );

    // Assert: accepted, as always.
    expect(outcome.ok, 'an ordinary button is unaffected').toBe(true);
  });
});

describe('the home "Modelos de evento"', () => {
  it('accepts a new template, after the seeded three', () => {
    // Arrange: a new database with its three seeded templates.
    const { stateStore } = openEventInboxOnTheStore();

    // Act: "+ Novo modelo" creates a clock reading the event's team.
    const outcome = stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'eventTemplates' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio da equipe',
        fields: buildClockFieldsReadingTheTeam(),
      },
      operatorActor,
    );

    // Assert: accepted, the fourth template.
    expect(outcome.ok, 'a template belongs here').toBe(true);
    expect(
      listEventTemplateIds(stateStore.readAllSlices().items),
      'the new template comes after the seeded ones',
    ).toEqual(['volta-mais-rapida', 'penalidade', 'super-chat', outcome.ok ? outcome.createdItemId : '']);
  });

  it('refuses an item no event fills', () => {
    // Arrange: a new database.
    const { stateStore } = openEventInboxOnTheStore();

    // Act: create a clock with every field typed among the templates.
    const outcome = stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'eventTemplates' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio do enduro',
        fields: buildTypedEnduroFields(),
      },
      operatorActor,
    );

    // Assert: refused: nothing would ever show it.
    expect(outcome, 'a template is an item an event fills').toEqual({
      ok: false,
      error: {
        code: 'ITEM_NOT_FILLED_BY_EVENT',
        message:
          'O item "Relógio do enduro" não é preenchido por um evento: escolha um item com campos "Evento".',
      },
    });
  });

  it("refuses to take a template's last \"Evento\" field away", () => {
    // Arrange: a new template whose title alone reads the event.
    const { stateStore } = openEventInboxOnTheStore();
    const created = stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'eventTemplates' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio da equipe',
        fields: buildClockFieldsReadingTheTeam(),
      },
      operatorActor,
    );
    const itemId = created.ok ? created.createdItemId : undefined;

    // Act: type the title instead.
    const outcome = stateStore.applyCommand(
      {
        type: 'updateItemFields',
        itemId,
        fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
      },
      operatorActor,
    );

    // Assert: refused: it would stay among the templates with nothing an event fills.
    expect(outcome.ok ? 'ok' : outcome.error.code, 'a template keeps an "Evento" field').toBe(
      'ITEM_NOT_FILLED_BY_EVENT',
    );
  });
});
