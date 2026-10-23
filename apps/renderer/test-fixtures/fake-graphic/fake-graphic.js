/**
 * The fake graphic: a minimal OGraf graphic used only by the renderer's Playwright tests.
 * It draws its data as plain text and writes down every lifecycle call, so a test can read
 * back exactly what the renderer did and in which order.
 *
 * Plain JavaScript on purpose: this file is served as it is, like the built `main` file
 * of a real package, with no build step in between.
 *
 * What a test can read: `window.__fakeGraphicCalls`, a list with two records per call,
 * `{ instanceId, action, moment: 'called', params }` when the renderer calls and
 * `{ ..., moment: 'finished' }` when the call resolves. `instanceId` is the element's
 * `data-instance-id`, which the renderer sets. The two records of a `load` also carry
 * `themeTokenAtLoad`: the value of the theme token `--panel-base` on :root at the moment
 * load was called (empty when the theme was not on the page yet).
 *
 * What a test can set:
 *   - `window.__fakeGraphicDelayInMilliseconds`: how long every call takes (default 0),
 *     standing in for an animation.
 *   - `fakeGraphicLoadOutcome` in the data given to load: `'rejects'` makes load throw,
 *     `'refuses'` makes it answer 400, like a graphic that does not accept its data,
 *     `'answers-nothing'` makes it draw its data and resolve with no answer object,
 *     which OGraf v1 allows and a renderer must count as `{ statusCode: 200 }`.
 *   - `fakeGraphicDisposeOutcome: 'answers-nothing'` in the data given to load: dispose
 *     then resolves with no answer object, like an `async dispose()` without a `return`,
 *     which is allowed in the same way.
 */

/** Resolves after the delay the test asked for, standing in for an animation. */
function waitForTheConfiguredDelay() {
  const delayInMilliseconds = window.__fakeGraphicDelayInMilliseconds ?? 0;
  return new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
}

export default class FakeGraphic extends HTMLElement {
  /**
   * Writes one record of a call on the list the tests read. A load record also carries
   * the theme token seen on :root at that moment (`themeTokenAtLoad`); other calls pass none.
   */
  recordCall(action, moment, params, themeTokenAtLoad) {
    window.__fakeGraphicCalls ??= [];
    const record = { instanceId: this.dataset.instanceId ?? null, action, moment, params };
    if (themeTokenAtLoad !== undefined) {
      record.themeTokenAtLoad = themeTokenAtLoad;
    }
    window.__fakeGraphicCalls.push(record);
  }

  /** Records the call, waits the configured delay, records that it finished. */
  async recordAndWait(action, params, themeTokenAtLoad) {
    this.recordCall(action, 'called', params, themeTokenAtLoad);
    await waitForTheConfiguredDelay();
    this.recordCall(action, 'finished', params, themeTokenAtLoad);
  }

  async load(params) {
    // The renderer promises every graphic that the theme's tokens are on :root before
    // load is called (apps/renderer/index.html links them before its script). One token
    // is written down with the call, so e2e/themeOnRoot.e2e.ts can check the promise at
    // the very moment it matters, not later.
    const themeTokenAtLoad = getComputedStyle(document.documentElement)
      .getPropertyValue('--panel-base')
      .trim();
    await this.recordAndWait('load', params, themeTokenAtLoad);
    const loadOutcome = params.data?.fakeGraphicLoadOutcome;
    if (loadOutcome === 'rejects') {
      throw new Error('O gráfico de teste foi instruído a falhar no load.');
    }
    if (loadOutcome === 'refuses') {
      return { statusCode: 400, statusMessage: 'O gráfico de teste recusou os dados.' };
    }
    this.currentData = { ...params.data };
    this.textContent = JSON.stringify(this.currentData);
    if (loadOutcome === 'answers-nothing') {
      return undefined;
    }
    return { statusCode: 200 };
  }

  async playAction(params) {
    await this.recordAndWait('playAction', params);
    return { statusCode: 200, currentStep: 0 };
  }

  async updateAction(params) {
    await this.recordAndWait('updateAction', params);
    this.currentData = { ...this.currentData, ...params.data };
    this.textContent = JSON.stringify(this.currentData);
    return { statusCode: 200 };
  }

  async stopAction(params) {
    await this.recordAndWait('stopAction', params);
    return { statusCode: 200 };
  }

  async customAction(params) {
    await this.recordAndWait('customAction', params);
    return { statusCode: 404, statusMessage: 'O gráfico de teste não tem ações próprias.' };
  }

  async dispose(params) {
    await this.recordAndWait('dispose', params);
    if (this.currentData?.fakeGraphicDisposeOutcome === 'answers-nothing') {
      return undefined;
    }
    return { statusCode: 200 };
  }
}
