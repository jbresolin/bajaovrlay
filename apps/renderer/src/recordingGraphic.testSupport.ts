// Test support: a stand-in for a graphic and for the loader that brings it into the page,
// used by the instancePlayer tests. The stand-in graphic draws nothing; it writes down every
// lifecycle call the player makes, so a test can read back what was called and in which
// order. It is the unit-test cousin of test-fixtures/fake-graphic, which the browser tests
// load as a real module.
import type { GraphicLoader } from './graphicLoader.js';
import type { OGrafLoadParams } from './ografGraphicElement.js';

/** What a test gets: the loader to hand to the player, and what the graphics wrote down. */
export type RecordingGraphicLoader = {
  graphicLoader: GraphicLoader;
  /**
   * One sentence per lifecycle call, oldest first, written when the call is made:
   * `Enduro: load`, `Enduro: playAction`, `UFPR: stopAction (skipAnimation)`.
   */
  lifecycleCalls: string[];
  /** What each `load` was given, oldest first. */
  loadParams: OGrafLoadParams[];
  /** Lets every load that was told to wait (see below) finish. */
  releaseLoadsThatWait: () => void;
  /** Lets every play that was told to wait (see below) finish. */
  releasePlaysThatWait: () => void;
};

// A custom element tag can be registered only once per page, and every loader below
// registers its own element class, so each one needs a tag of its own. This counter is
// the one deliberate exception to "no shared mutable state" in the tests: it only keeps
// the tag names apart, and no test reads it or asserts on a tag.
let numberOfLoadersBuilt = 0;

/**
 * Builds a loader whose graphics write their calls on lists only this loader owns, so two
 * tests never see each other's calls. `nameByInstanceId` gives each instance the short
 * name used in the sentences.
 *
 * A test tells a graphic to misbehave through the data its instance carries:
 *   - `fakeGraphicLoadOutcome: 'rejects'` makes load throw,
 *   - `fakeGraphicLoadOutcome: 'answers-nothing'` makes load resolve with no answer,
 *   - `fakeGraphicLoadOutcome: 'waits-to-be-released'` keeps load pending until the test
 *     calls `releaseLoadsThatWait`, standing in for a slow graphic,
 *   - `fakeGraphicPlayOutcome: 'rejects'` makes playAction throw,
 *   - `fakeGraphicPlayOutcome: 'waits-to-be-released'` keeps playAction pending until the
 *     test calls `releasePlaysThatWait`, standing in for a long in-animation.
 */
export function createRecordingGraphicLoader(
  nameByInstanceId: Record<string, string>,
): RecordingGraphicLoader {
  const lifecycleCalls: string[] = [];
  const loadParams: OGrafLoadParams[] = [];
  let releaseLoadsThatWait: () => void = () => undefined;
  const loadsMayFinish = new Promise<void>((resolve) => {
    releaseLoadsThatWait = resolve;
  });
  let releasePlaysThatWait: () => void = () => undefined;
  const playsMayFinish = new Promise<void>((resolve) => {
    releasePlaysThatWait = resolve;
  });

  class RecordingGraphic extends HTMLElement {
    /** How the data given to load said playAction must go; read when it is played. */
    playOutcome: unknown = undefined;

    /** Writes the call down under the name of the instance this element draws. */
    recordCall(action: string, params: { skipAnimation?: boolean }): void {
      const instanceId = this.dataset.instanceId ?? '';
      const instanceName = nameByInstanceId[instanceId] ?? instanceId;
      const animationNote = params.skipAnimation === true ? ' (skipAnimation)' : '';
      lifecycleCalls.push(`${instanceName}: ${action}${animationNote}`);
    }

    async load(params: OGrafLoadParams): Promise<unknown> {
      this.recordCall('load', {});
      loadParams.push(params);
      this.playOutcome = params.data.fakeGraphicPlayOutcome;
      const loadOutcome = params.data.fakeGraphicLoadOutcome;
      if (loadOutcome === 'rejects') {
        throw new Error('O gráfico de teste foi instruído a falhar no load.');
      }
      if (loadOutcome === 'answers-nothing') {
        return undefined;
      }
      if (loadOutcome === 'waits-to-be-released') {
        await loadsMayFinish;
      }
      return { statusCode: 200 };
    }

    async playAction(params: { skipAnimation?: boolean }): Promise<unknown> {
      this.recordCall('playAction', params);
      if (this.playOutcome === 'rejects') {
        throw new Error('O gráfico de teste foi instruído a falhar no playAction.');
      }
      if (this.playOutcome === 'waits-to-be-released') {
        await playsMayFinish;
      }
      return { statusCode: 200, currentStep: 0 };
    }

    async updateAction(): Promise<unknown> {
      this.recordCall('updateAction', {});
      return { statusCode: 200 };
    }

    async stopAction(params: { skipAnimation?: boolean }): Promise<unknown> {
      this.recordCall('stopAction', params);
      return { statusCode: 200 };
    }

    async dispose(): Promise<unknown> {
      this.recordCall('dispose', {});
      return { statusCode: 200 };
    }
  }

  numberOfLoadersBuilt += 1;
  const tagName = `recording-graphic-${numberOfLoadersBuilt}`;
  customElements.define(tagName, RecordingGraphic);

  return {
    // Every graphic of the slice is drawn by the same recording element.
    graphicLoader: { defineGraphicElement: async () => tagName },
    lifecycleCalls,
    loadParams,
    releaseLoadsThatWait: () => releaseLoadsThatWait(),
    releasePlaysThatWait: () => releasePlaysThatWait(),
  };
}
