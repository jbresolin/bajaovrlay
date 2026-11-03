/**
 * A trigger's data in the fields of a macro's take (apps/server, modules/triggers)
 *
 * What this module is for:
 *   A take step of a macro may fill any of its item's fields from "Dado do gatilho ›
 *   <chave>" (BAJAOVRLAY-48). The macro runner hands takeItem the step's trigger fields and
 *   the run's data; the take reads them once, at that step, and the values go on air as
 *   plain data, frozen like a snapshot binding. A required field whose key is missing stops
 *   the macro at that step with the reason, as any refused step does; an optional one is
 *   left out. A macro run by hand has no trigger data, so such a field is missing.
 *
 * What these tests prove:
 *   - Data { nome: "Ana Souza" } puts the lower third on air with that name, the item's
 *     other fields as the item has them.
 *   - A required key missing stops the macro at that step, with "Nome: o gatilho não trouxe
 *     o dado "nome"." on its button, and nothing on air.
 *   - An optional key missing leaves the field out: not the item's own value either.
 *   - A number fills a text field as its text (car 47 → "47").
 *   - The same macro run by hand stops at that step for the same reason.
 *   - An operator cannot send a take with a trigger fill: only the macro runner may.
 *
 * What these tests deliberately do not cover:
 *   - How the data got there (scene, call, event, time); triggerFiring.test.ts and the others.
 *   - Prévia of such a macro: it shows the items with their own values (not changed here).
 */
import type { MacroStep } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { triggerServiceActor } from '../../core/store/commandActors.js';
import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  interviewInTheBoxMacroId,
  interviewNameFromTheTriggerSteps,
  lowerThirdItemId,
  operatorActor,
  penaltyNoticeMacroId,
  readDataOnAirOnLayer,
  startTriggersOnTheStore,
  type TriggersOnTheStore,
} from './triggersOnTheStore.testSupport.js';

/** Creates an auto HTTP trigger for the macro, and fires it with `data` as the route does. */
function fireAnHttpTriggerFor(
  { store, passTime }: TriggersOnTheStore,
  macroId: string,
  data: Record<string, string | number>,
): void {
  const triggerId = createTrigger(store, {
    name: 'Botão da mesa',
    when: { kind: 'http' },
    macroId,
    mode: 'auto',
  });
  store.applyCommand(
    { type: 'fireTrigger', triggerId, triggerName: 'Botão da mesa', data, causedBy: 'api:d200' },
    triggerServiceActor,
  );
  passTime(100);
}

/** Where the macro's last run stopped, as its button says it. */
function readStopOfMacro(store: TriggersOnTheStore['store'], macroId: string) {
  const macroStop = store.readAllSlices().macroStops.find((stop) => stop.macroId === macroId);
  return macroStop === undefined
    ? undefined
    : { stepIndex: macroStop.stepIndex, reason: macroStop.reason };
}

describe('a take step filled from the trigger', () => {
  it('puts the lower third on air with the name the call carried', () => {
    // Arrange: "Entrevista no box" filling the name from `nome`.
    const triggersOnTheStore = startTriggersOnTheStore({
      macroSteps: { [interviewInTheBoxMacroId]: interviewNameFromTheTriggerSteps },
    });

    // Act: the call carries Ana Souza.
    fireAnHttpTriggerFor(triggersOnTheStore, interviewInTheBoxMacroId, { nome: 'Ana Souza' });

    // Assert: her name, and the item's own role.
    expect(
      readDataOnAirOnLayer(triggersOnTheStore.store, 'lower-third'),
      'the name must come from the call, the role from the item',
    ).toEqual({ name: 'Ana Souza', role: 'Entrevista' });
  });

  it('stops the macro at that step when a required key is missing, saying why', () => {
    // Arrange: the same macro.
    const triggersOnTheStore = startTriggersOnTheStore({
      macroSteps: { [interviewInTheBoxMacroId]: interviewNameFromTheTriggerSteps },
    });

    // Act: the call carries no name at all.
    fireAnHttpTriggerFor(triggersOnTheStore, interviewInTheBoxMacroId, { cargo: 'Piloto' });

    // Assert: stopped at step 0 with the field's title and the key; nothing on air.
    expect(
      readStopOfMacro(triggersOnTheStore.store, interviewInTheBoxMacroId),
      'the button must say where and why the macro stopped',
    ).toEqual({ stepIndex: 0, reason: 'Nome: o gatilho não trouxe o dado "nome".' });
    expect(
      readDataOnAirOnLayer(triggersOnTheStore.store, 'lower-third'),
      'a lower third with no name must never go on air',
    ).toBe(undefined);
  });

  it('leaves an optional field out when its key is missing, rather than the item’s value', () => {
    // Arrange: the penalty notice filling car, team and reason from the trigger.
    const triggersOnTheStore = startTriggersOnTheStore();

    // Act: the call carries the car only.
    fireAnHttpTriggerFor(triggersOnTheStore, penaltyNoticeMacroId, { carro: 47 });

    // Assert: car 47; no team and no reason (the item's "Penalidade aplicada" is not used).
    expect(
      readDataOnAirOnLayer(triggersOnTheStore.store, 'notice'),
      'an optional field the trigger did not bring is left out',
    ).toEqual({ variant: 'penalty', carNumber: 47 });
  });

  it('writes a number into a text field as its text', () => {
    // Arrange: the interview's name filled from `carro`, a number.
    const steps: MacroStep[] = [
      {
        kind: 'takeItem',
        itemId: lowerThirdItemId,
        triggerFields: { name: { kind: 'triggerData', key: 'carro' } },
      },
    ];
    const triggersOnTheStore = startTriggersOnTheStore({
      macroSteps: { [interviewInTheBoxMacroId]: steps },
    });

    // Act: the call carries car 47.
    fireAnHttpTriggerFor(triggersOnTheStore, interviewInTheBoxMacroId, { carro: 47 });

    // Assert: the name reads "47".
    expect(
      readDataOnAirOnLayer(triggersOnTheStore.store, 'lower-third')?.name,
      'a number must reach a text field as text',
    ).toBe('47');
  });
});

describe('the same macro run by hand', () => {
  it('stops at the step, because a macro run by hand has no trigger data', () => {
    // Arrange: "Entrevista no box" filling the name from the trigger.
    const { store, passTime } = startTriggersOnTheStore({
      macroSteps: { [interviewInTheBoxMacroId]: interviewNameFromTheTriggerSteps },
    });

    // Act: the operator presses the macro's button.
    applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: interviewInTheBoxMacroId });
    passTime(100);

    // Assert: stopped at the take, for the missing name.
    expect(
      readStopOfMacro(store, interviewInTheBoxMacroId),
      'by hand, a field from the trigger is missing',
    ).toEqual({ stepIndex: 0, reason: 'Nome: o gatilho não trouxe o dado "nome".' });
  });
});

describe('who may send a take with trigger data', () => {
  it('refuses it from an operator: only a macro’s runner fills a take from a trigger', () => {
    // Arrange: a store with the lower third item.
    const { store } = startTriggersOnTheStore();

    // Act: an operator page sends a take with a fill of its own.
    const outcome = store.applyCommand(
      {
        type: 'takeItem',
        itemId: lowerThirdItemId,
        triggerFill: {
          fields: { name: { kind: 'triggerData', key: 'nome' } },
          data: { nome: 'Nome digitado por fora' },
        },
      },
      operatorActor,
    );

    // Assert: not allowed.
    expect(outcome.ok === false && outcome.error.code, 'only the runner may fill a take').toBe(
      'NOT_ALLOWED',
    );
  });
});
