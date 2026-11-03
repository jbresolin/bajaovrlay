/**
 * The two rules that keep triggers out of loops (apps/server, modules/triggers)
 *
 * What this module is for:
 *   A macro can switch OBS's scene, and a scene change can fire a trigger that runs a
 *   macro. Without a rule, "Box entered → go to Box" would chain or loop. BAJAOVRLAY-48
 *   sets two rules, written next to the code in fireTrigger.ts:
 *   1. a scene change made by a macro's own obsScene step fires no obsScene trigger. It is
 *      told apart by the switch's actor (`requestedBy` on the obs slice's scene switch),
 *      never by timing;
 *   2. a trigger never fires from a macro that a trigger started: a firing whose cause is
 *      the runner of such a run is dropped, whatever the trigger's kind.
 *
 * What these tests prove:
 *   - Box entered by hand in OBS and by the operator's own scene button fires; Box entered
 *     by a macro's step does not.
 *   - The rule follows the switch, not the clock: a later entry made in OBS by hand, right
 *     after the macro's, fires.
 *   - A switch is used up once OBS has answered it: a switch to the scene already on
 *     Program, one OBS never answered, or one another cut overtook is never blamed for a
 *     later cut by hand. OBS reporting the scene before its answer still counts as the
 *     macro's.
 *   - A firing caused by a run a trigger started is dropped, and leaves no row.
 *
 * What these tests deliberately do not cover:
 *   - The real OBS connection; the switch's answer and the new scene are reported here as
 *     the connection reports them (`sistema:obs`). modules/obs has its own tests.
 */
import { describe, expect, it } from 'vitest';

import { obsConnectionActor, triggerServiceActor } from '../../core/store/commandActors.js';
import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  goToTheBoxMacroId,
  interviewInTheBoxMacroId,
  operatorActor,
  readEventLogFrom,
  readFirings,
  reportObsShowing,
  startTriggersOnTheStore,
  type TriggersOnTheStore,
} from './triggersOnTheStore.testSupport.js';

/** "Entrou no box": the trigger every rule-1 test watches; it asks, so firings are counted. */
const boxEnteredRunsTheInterview = {
  name: 'Entrou no box',
  when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
  macroId: interviewInTheBoxMacroId,
  mode: 'ask',
};

/**
 * OBS answers the latest switch "done" and reports Box on Program, as the server's OBS
 * connection does once OBS has switched.
 */
function letObsFinishTheSwitchToTheBox(store: TriggersOnTheStore['store']): void {
  const switchNumber = store.readAllSlices().obs.sceneSwitch?.number ?? 0;
  store.applyCommand(
    { type: 'recordObsSceneSwitchAnswer', number: switchNumber, isDone: true, refusalReason: null },
    obsConnectionActor,
  );
  reportObsShowing(store, 'Box');
}

describe('rule 1: a macro’s own scene switch fires no scene trigger', () => {
  const whoMovesToTheBox = [
    // The director cuts in OBS itself: a real scene change, so the trigger fires.
    {
      name: 'fires when the director cuts to Box in OBS',
      moveToTheBox: ({ store }: TriggersOnTheStore) => reportObsShowing(store, 'Box'),
      expectedFirings: 1,
    },
    // The operator's scene button on the console: a person decided, so it fires too.
    {
      name: 'fires when the operator presses the Box scene button',
      moveToTheBox: ({ store }: TriggersOnTheStore) => {
        applyAsTheOperatorOrThrow(store, { type: 'switchObsScene', sceneName: 'Box' });
        letObsFinishTheSwitchToTheBox(store);
      },
      expectedFirings: 1,
    },
    // The rule itself: the switch's actor is a macro's runner, so nothing fires.
    {
      name: 'fires nothing when a macro’s step switches to Box',
      moveToTheBox: ({ store, passTime }: TriggersOnTheStore) => {
        applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: goToTheBoxMacroId });
        passTime(100);
        letObsFinishTheSwitchToTheBox(store);
      },
      expectedFirings: 0,
    },
  ];

  it.each(whoMovesToTheBox)('$name', ({ moveToTheBox, expectedFirings }) => {
    // Arrange: the Box trigger, and OBS on the track.
    const triggersOnTheStore = startTriggersOnTheStore();
    createTrigger(triggersOnTheStore.store, boxEnteredRunsTheInterview);
    reportObsShowing(triggersOnTheStore.store, 'Pista');

    // Act: Box is entered this row's way.
    moveToTheBox(triggersOnTheStore);
    triggersOnTheStore.passTime(100);

    // Assert: fired or not, by who moved.
    expect(
      readFirings(triggersOnTheStore.store).length,
      'only a change no macro made may fire a scene trigger',
    ).toBe(expectedFirings);
  });

  it('follows the switch, not the clock: Box entered by hand right after the macro’s fires', () => {
    // Arrange: the Box trigger; a macro has just switched to Box.
    const triggersOnTheStore = startTriggersOnTheStore();
    const { store, passTime } = triggersOnTheStore;
    createTrigger(store, boxEnteredRunsTheInterview);
    reportObsShowing(store, 'Pista');
    applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: goToTheBoxMacroId });
    passTime(100);
    letObsFinishTheSwitchToTheBox(store);
    passTime(100);

    // Act: half a second later the director cuts to Pista and back to Box in OBS.
    passTime(500);
    reportObsShowing(store, 'Pista');
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: the macro's entry fired nothing; the director's, moments later, fired.
    expect(
      readFirings(store).length,
      'the second entry was made by hand, so it must fire however soon it came',
    ).toBe(1);
  });
});

/** OBS answers the latest switch: done, or refused with this reason. */
function letObsAnswerTheLatestSwitch(
  store: TriggersOnTheStore['store'],
  refusalReason: string | null,
): void {
  const switchNumber = store.readAllSlices().obs.sceneSwitch?.number ?? 0;
  store.applyCommand(
    {
      type: 'recordObsSceneSwitchAnswer',
      number: switchNumber,
      isDone: refusalReason === null,
      refusalReason,
    },
    obsConnectionActor,
  );
}

describe('rule 1: a switch is used up once OBS has answered it', () => {
  const howTheMacrosSwitchEnded = [
    // The reviewer's case: Box is already on Program, so OBS answers "feita" and nothing
    // changes. Minutes later the director cuts to Pista and back to Box by hand: that
    // entry is the director's, and must not be blamed on the old switch.
    {
      name: 'a switch to the scene already on Program blames no later cut',
      sceneOnProgramAtTheStart: 'Box',
      switchAndWhatFollows: ({ store, passTime }: TriggersOnTheStore) => {
        applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: goToTheBoxMacroId });
        passTime(100);
        letObsAnswerTheLatestSwitch(store, null);
        passTime(180_000);
        reportObsShowing(store, 'Pista');
        reportObsShowing(store, 'Box');
      },
      expectedFirings: 1,
    },
    // OBS is frozen: the connection gives up at its time limit and refuses the switch. A
    // later cut to Box by hand is the director's.
    {
      name: 'a switch OBS never answered blames no later cut',
      sceneOnProgramAtTheStart: 'Pista',
      switchAndWhatFollows: ({ store, passTime }: TriggersOnTheStore) => {
        applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: goToTheBoxMacroId });
        passTime(100);
        letObsAnswerTheLatestSwitch(store, 'O OBS não respondeu a tempo à troca para "Box".');
        passTime(60_000);
        reportObsShowing(store, 'Box');
      },
      expectedFirings: 1,
    },
    // OBS answers "feita", but the director's cut to Câmera 2 lands in the same instant
    // and Box never shows. The switch is spent; the director's later Box fires.
    {
      name: 'a switch another cut overtook blames no later cut',
      sceneOnProgramAtTheStart: 'Pista',
      switchAndWhatFollows: ({ store, passTime }: TriggersOnTheStore) => {
        applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: goToTheBoxMacroId });
        passTime(100);
        letObsAnswerTheLatestSwitch(store, null);
        reportObsShowing(store, 'Câmera 2');
        passTime(30_000);
        reportObsShowing(store, 'Box');
      },
      expectedFirings: 1,
    },
    // The same moment, the other way round: OBS reports Box before it answers the switch.
    // The switch was still waiting, so Box is the macro's and fires nothing.
    {
      name: 'a switch whose scene is reported before its answer still blames that change',
      sceneOnProgramAtTheStart: 'Pista',
      switchAndWhatFollows: ({ store, passTime }: TriggersOnTheStore) => {
        applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: goToTheBoxMacroId });
        passTime(100);
        reportObsShowing(store, 'Box');
        letObsAnswerTheLatestSwitch(store, null);
      },
      expectedFirings: 0,
    },
  ];

  it.each(howTheMacrosSwitchEnded)(
    '$name',
    ({ sceneOnProgramAtTheStart, switchAndWhatFollows, expectedFirings }) => {
      // Arrange: the Box trigger, and OBS on this row's scene.
      const triggersOnTheStore = startTriggersOnTheStore();
      createTrigger(triggersOnTheStore.store, boxEnteredRunsTheInterview);
      reportObsShowing(triggersOnTheStore.store, sceneOnProgramAtTheStart);

      // Act: "Ir para o box" switches, OBS answers this row's way, and what follows happens.
      switchAndWhatFollows(triggersOnTheStore);
      triggersOnTheStore.passTime(100);

      // Assert: only an entry into Box the macro did not make fired.
      expect(
        readFirings(triggersOnTheStore.store).length,
        'a switch OBS has answered must never be blamed for a later cut by hand',
      ).toBe(expectedFirings);
    },
  );
});

describe('rule 2: a trigger never fires from a macro that a trigger started', () => {
  it('drops a firing whose cause is the runner of a run a trigger started, and logs nothing', () => {
    // Arrange: a 5 s wait in "Ir para o box", started by an HTTP trigger; a second HTTP
    // trigger that would run the interview.
    const { store, passTime } = startTriggersOnTheStore({
      macroSteps: { [goToTheBoxMacroId]: [{ kind: 'wait', ms: 5_000 }] },
    });
    const cameraTriggerId = createTrigger(store, {
      name: 'Câmera do box',
      when: { kind: 'http' },
      macroId: goToTheBoxMacroId,
      mode: 'auto',
    });
    const interviewTriggerId = createTrigger(store, {
      name: 'Entrevista pela mesa',
      when: { kind: 'http' },
      macroId: interviewInTheBoxMacroId,
      mode: 'ask',
    });
    store.applyCommand(
      {
        type: 'fireTrigger',
        triggerId: cameraTriggerId,
        triggerName: 'Câmera do box',
        data: {},
        causedBy: 'api:companion',
      },
      triggerServiceActor,
    );
    passTime(100);

    // Act: something that run caused reaches the interview trigger. Today a scene switch is
    // the only thing a macro does that a trigger sees, and rule 1 drops it first; this rule
    // keeps the guarantee for any kind added later.
    store.applyCommand(
      {
        type: 'fireTrigger',
        triggerId: interviewTriggerId,
        triggerName: 'Entrevista pela mesa',
        data: {},
        causedBy: `sistema:macro:${goToTheBoxMacroId}`,
      },
      triggerServiceActor,
    );

    // Assert: only the camera trigger's firing exists, and the log has one firing row.
    expect(
      readFirings(store).map((firing) => firing.triggerName),
      'nothing a trigger-started run causes may fire another trigger',
    ).toEqual(['Câmera do box']);
    expect(
      readEventLogFrom(store, 'fireTrigger').filter((row) => row.endsWith('fireTrigger')),
      'the dropped firing must leave no row',
    ).toEqual([`${triggerServiceActor} fireTrigger`]);
  });

  it('still fires from a macro the operator ran by hand, when it is not a scene switch', () => {
    // Arrange: the same wait, run by hand this time; the interview's HTTP trigger.
    const { store, passTime } = startTriggersOnTheStore({
      macroSteps: { [goToTheBoxMacroId]: [{ kind: 'wait', ms: 5_000 }] },
    });
    const interviewTriggerId = createTrigger(store, {
      name: 'Entrevista pela mesa',
      when: { kind: 'http' },
      macroId: interviewInTheBoxMacroId,
      mode: 'ask',
    });
    store.applyCommand({ type: 'runMacro', macroId: goToTheBoxMacroId }, operatorActor);
    passTime(100);

    // Act: a firing whose cause is that hand-run macro's runner.
    store.applyCommand(
      {
        type: 'fireTrigger',
        triggerId: interviewTriggerId,
        triggerName: 'Entrevista pela mesa',
        data: {},
        causedBy: `sistema:macro:${goToTheBoxMacroId}`,
      },
      triggerServiceActor,
    );

    // Assert: it fires: rule 2 is about runs a trigger started, not every run.
    expect(readFirings(store).length, 'a hand-run macro is no loop').toBe(1);
  });
});
