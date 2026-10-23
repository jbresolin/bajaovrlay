/**
 * Items filled by an event, through a real store (apps/server)
 *
 * What this module is for:
 *   An item whose fields read the event it shows (kind `eventField`, "Evento" in the item
 *   editor) is a template: showEvent fills it from the event's payload; a take of its
 *   own (Space, a shortcut button, a macro step) is refused, since it has nothing to show;
 *   "Prévia" fills it from a sample event of its rule's kind, so the operator sees the
 *   look, and "Tomar" on that sample is refused. "Prévia" of an event in the inbox fills
 *   it from that event, and "Tomar" then shows the event.
 *
 * What these tests prove (the race clock stands in for the notice: its title reads the
 * team, its laps the lap):
 *   - Showing a penalty fills the title with car 47's team and the laps with its lap.
 *   - Taking the item by itself is refused with "Este item é preenchido por um evento".
 *   - Its Prévia shows the sample fastest lap's team, and "Tomar" on it is refused.
 *   - Prévia of the penalty shows the penalty's team; "Tomar" puts it on air as the event,
 *     with the rule's duration, and the event is on air.
 *   - An item reading both the event and the entity library (BAJAOVRLAY-19) shows the
 *     penalty with its title from the library's schedule and its laps from the event, the
 *     title kept live on air; with the schedule's record deleted, showing the penalty is
 *     refused with ENTITY_NOT_RESOLVED and the penalty still waits.
 *   - An event lacking what a required field reads is refused, naming the field.
 *   - Saving an event field whose payload field does not fit is refused, naming both.
 *
 * What these tests deliberately do not cover:
 *   - Which payload fields fit which graphic fields; eventFieldValue.test.ts in shared.
 *   - The notice graphic itself; packages/graphics/notice.
 */
import { describe, expect, it } from 'vitest';

import {
  buildBlockingWarningOfCar38,
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  operatorActor,
  pollTheSimulator,
  readEvent,
} from './eventInboxOnTheStore.testSupport.js';

/** The id the inbox gives car 47's start penalty from the simulator. */
const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/** The title reads the event's team, the laps its lap. */
const fieldsReadFromTheEvent = {
  sessionName: { kind: 'eventField' as const, path: 'teamName' as const },
  lapsCompletedByLeader: { kind: 'eventField' as const, path: 'lapNumber' as const },
};

/** Saturday's enduro, 10:00 to 14:00 in Brasília, as the Programação tab holds it. */
const saturdayEnduroSlot = {
  slotId: 'enduro-sabado',
  sessionName: 'Enduro de Resistência',
  sessionKind: 'enduro',
  startsAtMs: Date.parse('2026-11-14T13:00:00.000Z'),
  endsAtMs: Date.parse('2026-11-14T17:00:00.000Z'),
  place: 'Pista principal',
} as const;

/** A field that reads the name of Saturday's enduro from the library ("Cadastro"). */
const fieldReadFromSaturdaysEnduro = {
  kind: 'entity',
  entityType: 'scheduleSlot',
  slotId: 'enduro-sabado',
  attribute: 'sessionName',
} as const;

/**
 * An inbox whose incidents and fastest laps are shown with a race clock item filled by the
 * event ("Relógio — aviso de evento"), with car 47's penalty waiting.
 */
function openInboxWithATemplateItem(): EventInboxOnTheStore & { itemId: string } {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(
    inbox.stateStore,
    'Relógio — aviso de evento',
    fieldsReadFromTheEvent,
  );
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'fastestLap', itemId });
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });
  pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
  pollTheSimulator(
    inbox,
    buildShapesWithCar31Leading([buildStartPenaltyOfCar47(), buildBlockingWarningOfCar38()]),
  );
  return { ...inbox, itemId };
}

/** The instance on the clock layer of this output, if any. */
function readClockLayer(inbox: EventInboxOnTheStore, target: 'program' | 'preview') {
  return inbox.stateStore
    .readAllSlices()
    .instances.find((instance) => instance.layerId === 'clock' && instance.target === target);
}

describe('an item filled by an event', () => {
  it("fills its fields from the penalty's payload when the penalty is shown", () => {
    // Arrange: the template item and car 47's penalty waiting.
    const inbox = openInboxWithATemplateItem();

    // Act: "No ar".
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Assert: the title is car 47's team, the laps its lap 1.
    const resolvedData = readClockLayer(inbox, 'program')?.resolvedData;
    expect(resolvedData?.sessionName, "the title must read the event's team").toBe('Carnaúba Baja');
    expect(resolvedData?.lapsCompletedByLeader, "the laps must read the event's lap").toBe(1);
  });

  it('refuses a take of the item by itself', () => {
    // Arrange: the template item.
    const inbox = openInboxWithATemplateItem();

    // Act: take it as Space or a shortcut button would.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'takeItem', itemId: inbox.itemId },
      operatorActor,
    );

    // Assert: refused in pt-BR; nothing on air.
    expect(outcome, 'a template has nothing to show by itself').toEqual({
      ok: false,
      error: {
        code: 'ITEM_FILLED_BY_EVENT',
        message: 'Este item é preenchido por um evento: ele entra no ar pela aba Eventos.',
      },
    });
    expect(readClockLayer(inbox, 'program'), 'nothing may go on air').toBe(undefined);
  });

  it("previews the item filled from its rule's sample event, and refuses Tomar on it", () => {
    // Arrange: the template item, named by the fastest lap's rule only (the incidents'
    // rule is given no item).
    const inbox = openInboxWithATemplateItem();
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId: null });

    // Act: "Prévia" of the item, then "Tomar".
    applyOrThrow(inbox.stateStore, { type: 'previewItem', itemId: inbox.itemId });
    const preview = readClockLayer(inbox, 'preview');
    const takeOutcome = inbox.stateStore.applyCommand(
      { type: 'takePreview', layerId: 'clock' },
      operatorActor,
    );

    // Assert: the sample fastest lap's team and lap, and the sample never reaches the air.
    expect(preview?.resolvedData.sessionName, 'the sample team must fill the title').toBe(
      'Acauã Baja',
    );
    expect(preview?.resolvedData.lapsCompletedByLeader, 'the sample lap').toBe(34);
    expect(takeOutcome, 'a sample must never go on air').toEqual({
      ok: false,
      error: {
        code: 'ITEM_FILLED_BY_EVENT',
        message: 'Este item é preenchido por um evento: ele entra no ar pela aba Eventos.',
      },
    });
  });

  it('previews an event with its own data, and Tomar shows the event', () => {
    // Arrange: the template item and car 47's penalty waiting.
    const inbox = openInboxWithATemplateItem();

    // Act: "Prévia" of the penalty in the Eventos tab, then "Tomar".
    applyOrThrow(inbox.stateStore, {
      type: 'previewItem',
      itemId: inbox.itemId,
      eventId: startPenaltyEventId,
    });
    const preview = readClockLayer(inbox, 'preview');
    applyOrThrow(inbox.stateStore, { type: 'takePreview', layerId: 'clock' });

    // Assert: the penalty's team in Prévia; on air as the event, with its rule's 10 s.
    expect(preview?.resolvedData.sessionName, "the preview must show the penalty's team").toBe(
      'Carnaúba Baja',
    );
    const onAir = readClockLayer(inbox, 'program');
    expect(onAir?.eventId, 'Tomar must put the event on air').toBe(startPenaltyEventId);
    expect(onAir?.autoOutAfterMs, "with its rule's duration").toBe(10_000);
    expect(readEvent(inbox.stateStore, startPenaltyEventId)?.status, 'the event is on air').toBe(
      'onAir',
    );
  });

  it('refuses to show an event that lacks what a required field reads', () => {
    // Arrange: an item whose required title reads the penalty, for car 38's warning,
    // which has none.
    const inbox = openInboxWithATemplateItem();
    const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — punição', {
      sessionName: { kind: 'eventField', path: 'penaltyText' },
    });
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });

    // Act: "No ar" on the warning.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'showEvent', eventId: 'simulador-enduro:incident:ocorrencia-0012' },
      operatorActor,
    );

    // Assert: refused, naming the field and what the event lacks.
    expect(outcome, 'a required field must not go on air empty').toEqual({
      ok: false,
      error: {
        code: 'EVENT_FIELD_NOT_FILLED',
        message: 'Título: o evento não traz "Punição".',
      },
    });
  });

  it('fills an item that reads both the event and the entity library', () => {
    // Arrange: Saturday's enduro in the library's schedule, and an item whose title reads
    // that session from the library and whose laps read the event's lap, shown for the
    // incidents.
    const inbox = openInboxWithATemplateItem();
    applyOrThrow(inbox.stateStore, {
      type: 'upsertEntity',
      entityType: 'scheduleSlot',
      record: saturdayEnduroSlot,
    });
    const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — enduro e evento', {
      sessionName: fieldReadFromSaturdaysEnduro,
      lapsCompletedByLeader: { kind: 'eventField', path: 'lapNumber' },
    });
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });

    // Act: "No ar" on car 47's penalty.
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Assert: the title from the library, the laps from the event, and the title kept live
    // so an edit in Cadastros reaches the notice on air.
    const onAir = readClockLayer(inbox, 'program');
    expect(onAir?.resolvedData.sessionName, 'the title must read the library').toBe(
      'Enduro de Resistência',
    );
    expect(onAir?.resolvedData.lapsCompletedByLeader, "the laps must read the event's lap").toBe(1);
    const keptEntityFields = inbox.stateStore
      .readAllSlices()
      .instanceBindings.find((entry) => entry.instanceId === onAir?.id)?.entityFields;
    expect(keptEntityFields, 'the title must stay live on air').toEqual([
      { fieldKey: 'sessionName', entityReference: fieldReadFromSaturdaysEnduro },
    ]);
  });

  it('refuses to show the event when the record the item reads is gone', () => {
    // Arrange: the same item, with Saturday's enduro deleted from the library afterwards.
    const inbox = openInboxWithATemplateItem();
    applyOrThrow(inbox.stateStore, {
      type: 'upsertEntity',
      entityType: 'scheduleSlot',
      record: saturdayEnduroSlot,
    });
    const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — enduro e evento', {
      sessionName: fieldReadFromSaturdaysEnduro,
      lapsCompletedByLeader: { kind: 'eventField', path: 'lapNumber' },
    });
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });
    applyOrThrow(inbox.stateStore, {
      type: 'deleteEntity',
      entityType: 'scheduleSlot',
      slotId: 'enduro-sabado',
    });

    // Act: "No ar" on car 47's penalty.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'showEvent', eventId: startPenaltyEventId },
      operatorActor,
    );

    // Assert: refused as any take reading a missing record is, the title named first, and
    // the penalty still waits.
    expect(outcome, 'a title read from a deleted record must not go on air').toEqual({
      ok: false,
      error: {
        code: 'ENTITY_NOT_RESOLVED',
        message: 'Título: lê uma sessão excluída da programação.',
      },
    });
    expect(readEvent(inbox.stateStore, startPenaltyEventId)?.status, 'the penalty waits').toBe(
      'pending',
    );
  });

  it('refuses to save an event field whose payload field does not fit', () => {
    // Arrange: a fresh store.
    const inbox = openEventInboxOnTheStore();

    // Act: create a clock whose time reads the team's name.
    const outcome = inbox.stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio — errado',
        fields: { referenceTimeMs: { kind: 'eventField', path: 'teamName' } },
      },
      operatorActor,
    );

    // Assert: refused, the field's title first.
    expect(outcome, 'a text cannot fill a time').toEqual({
      ok: false,
      error: {
        code: 'INVALID_EVENT_FIELD',
        message: 'Tempo de referência: o campo do evento "Equipe" não cabe neste campo do gráfico.',
      },
    });
  });
});
