/**
 * The plumbing of every graphic's preview.html: the stage the graphic is put on, the row of
 * buttons, the line showing the last OGraf answer, and `data-preview-state` on <body>
 * (loading, busy, onAir, offAir or error), which the Playwright tests wait on. Each graphic's
 * previewPage.ts decides which buttons exist and what they send; this module only runs them.
 * The words come from the graphic's own pt-BR catalog, passed in.
 */
import type { OGrafReturnPayload } from './ografGraphicTypes.js';

/** What the page last did, written on <body> for tests and people. */
export type PreviewState = 'loading' | 'busy' | 'onAir' | 'offAir' | 'error';

/** The words the controls need from the graphic's catalog. */
export type PreviewControlsWording = {
  pageTitle: string;
  controlsLabel: string;
  lastAnswer: (actionName: string, statusCode: number, statusMessage: string | undefined) => string;
};

/** The preview page's parts and the three things a previewPage.ts does with them. */
export type PreviewControls = {
  /** Where the graphic element goes. */
  previewStage: HTMLElement;
  /** Adds a button before the answer line. */
  addPreviewButton: (label: string, onPress: () => void) => void;
  /**
   * Runs one OGraf action, shows its answer under the buttons and sets the page state:
   * `stateOnSuccess` when the answer is 2xx, "error" otherwise.
   */
  runActionAndShowAnswer: (
    actionName: string,
    runAction: () => Promise<OGrafReturnPayload>,
    stateOnSuccess: PreviewState,
  ) => Promise<void>;
  /** Shows a problem on the answer line and sets the page state to "error". */
  showProblem: (problem: string) => void;
  /** The state last written on <body>. */
  readPreviewState: () => string | undefined;
};

/** Finds an element preview.html is known to have; a missing one is a bug in the page. */
function findPreviewElement(elementId: string): HTMLElement {
  const element = document.getElementById(elementId);
  if (element === null) {
    throw new Error(`preview.html has no #${elementId}; the page and previewPage.ts disagree`);
  }
  return element;
}

function setPreviewState(previewState: PreviewState): void {
  document.body.dataset.previewState = previewState;
}

/**
 * Finds the preview page's stage, controls and answer line (`#preview-stage`,
 * `#preview-controls`, `#preview-last-answer`), sets the page title and the controls'
 * accessible name, and returns what a previewPage.ts drives the page with.
 */
export function setUpPreviewControls(wording: PreviewControlsWording): PreviewControls {
  const previewStage = findPreviewElement('preview-stage');
  const previewControls = findPreviewElement('preview-controls');
  const previewLastAnswer = findPreviewElement('preview-last-answer');
  document.title = wording.pageTitle;
  previewControls.setAttribute('aria-label', wording.controlsLabel);

  function addPreviewButton(label: string, onPress: () => void): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onPress);
    previewControls.insertBefore(button, previewLastAnswer);
  }

  async function runActionAndShowAnswer(
    actionName: string,
    runAction: () => Promise<OGrafReturnPayload>,
    stateOnSuccess: PreviewState,
  ): Promise<void> {
    setPreviewState('busy');
    const answer = await runAction();
    previewLastAnswer.textContent = wording.lastAnswer(
      actionName,
      answer.statusCode,
      answer.statusMessage,
    );
    const isSuccess = answer.statusCode >= 200 && answer.statusCode < 300;
    setPreviewState(isSuccess ? stateOnSuccess : 'error');
  }

  function showProblem(problem: string): void {
    previewLastAnswer.textContent = problem;
    setPreviewState('error');
  }

  function readPreviewState(): string | undefined {
    return document.body.dataset.previewState;
  }

  return { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState };
}
