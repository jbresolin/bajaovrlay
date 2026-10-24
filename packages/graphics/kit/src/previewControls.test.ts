/**
 * The preview page's controls (packages/graphics/kit)
 *
 * What this module is for:
 *   Every graphic's preview.html has a stage, a row of buttons and a line with the last
 *   OGraf answer, and writes what it last did on <body> (`data-preview-state`), which the
 *   Playwright tests wait on instead of the clock. The kit runs those parts; each graphic
 *   decides its buttons.
 *
 * What these tests prove:
 *   - Setting up writes the page title and the controls' accessible name from the
 *     graphic's catalog.
 *   - A button is added before the answer line and runs its action when pressed.
 *   - A 2xx answer is shown and sets the state asked for; a 4xx answer is shown with its
 *     message and sets "error".
 *   - A problem shown directly sets "error" too.
 *
 * What these tests deliberately do not cover:
 *   - A real graphic on the page; each graphic's Playwright tests drive its preview.
 */
import { describe, expect, it } from 'vitest';

import { type PreviewControlsWording, setUpPreviewControls } from './previewControls.js';

const lowerThirdWording: PreviewControlsWording = {
  pageTitle: 'Prévia — tarja de nome',
  controlsLabel: 'Controles da prévia',
  lastAnswer: (actionName, statusCode, statusMessage) =>
    statusMessage === undefined
      ? `${actionName}: ${statusCode}`
      : `${actionName}: ${statusCode} — ${statusMessage}`,
};

/** Writes the three parts preview.html has into a fresh page. */
function writeThePreviewPageParts(): void {
  document.body.innerHTML = `
    <main id="preview-stage"></main>
    <section id="preview-controls"><output id="preview-last-answer"></output></section>
  `;
}

function readAnswerLine(): string | null | undefined {
  return document.getElementById('preview-last-answer')?.textContent;
}

describe('setUpPreviewControls', () => {
  it('writes the title and the controls’ name from the catalog', () => {
    // Arrange: an empty preview page.
    writeThePreviewPageParts();

    // Act: set the controls up.
    setUpPreviewControls(lowerThirdWording);

    // Assert: the page is named in pt-BR.
    expect(document.title, 'the tab must carry the graphic’s preview title').toBe(
      'Prévia — tarja de nome',
    );
    expect(
      document.getElementById('preview-controls')?.getAttribute('aria-label'),
      'the controls must have an accessible name',
    ).toBe('Controles da prévia');
  });

  it('adds a button before the answer line that runs when pressed', () => {
    // Arrange: the controls, and a press counter.
    writeThePreviewPageParts();
    const controls = setUpPreviewControls(lowerThirdWording);
    let pressCount = 0;

    // Act: add "Entrar (play)" and press it.
    controls.addPreviewButton('Entrar (play)', () => {
      pressCount += 1;
    });
    const button = document.querySelector('button');
    button?.click();

    // Assert: the button is there, before the answer line, and ran once.
    expect(button?.textContent, 'the button must carry its label').toBe('Entrar (play)');
    expect(button?.nextElementSibling?.id, 'buttons must sit before the answer line').toBe(
      'preview-last-answer',
    );
    expect(pressCount, 'pressing must run the button’s action once').toBe(1);
  });

  it('shows a 2xx answer and sets the state asked for', async () => {
    // Arrange: the controls.
    writeThePreviewPageParts();
    const controls = setUpPreviewControls(lowerThirdWording);

    // Act: run a play that answers 200.
    await controls.runActionAndShowAnswer(
      'playAction',
      () => Promise.resolve({ statusCode: 200 }),
      'onAir',
    );

    // Assert: the answer is shown and the page says it is on air.
    expect(readAnswerLine(), 'the answer line must show the action and status').toBe(
      'playAction: 200',
    );
    expect(controls.readPreviewState(), 'a 2xx answer must set the state asked for').toBe('onAir');
  });

  it('shows a refusal with its message and sets "error"', async () => {
    // Arrange: the controls.
    writeThePreviewPageParts();
    const controls = setUpPreviewControls(lowerThirdWording);

    // Act: run a load that answers 400 with a pt-BR message.
    await controls.runActionAndShowAnswer(
      'load',
      () =>
        Promise.resolve({ statusCode: 400, statusMessage: 'Falta o campo obrigatório "name".' }),
      'offAir',
    );

    // Assert: the message is shown and the page is in error.
    expect(readAnswerLine(), 'the refusal must be shown with its message').toBe(
      'load: 400 — Falta o campo obrigatório "name".',
    );
    expect(controls.readPreviewState(), 'a refusal must set "error"').toBe('error');
  });

  it('shows a problem directly and sets "error"', () => {
    // Arrange: the controls.
    writeThePreviewPageParts();
    const controls = setUpPreviewControls(lowerThirdWording);

    // Act: show an unreadable address problem.
    controls.showProblem('O parâmetro ?data= do endereço não é um JSON válido.');

    // Assert: the problem is on the answer line and the page is in error.
    expect(readAnswerLine(), 'the problem must be shown').toBe(
      'O parâmetro ?data= do endereço não é um JSON válido.',
    );
    expect(controls.readPreviewState(), 'a problem must set "error"').toBe('error');
  });
});
