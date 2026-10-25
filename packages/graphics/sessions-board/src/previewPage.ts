/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and the demo's "Atualizar": the slot in progress ends now, so the
 * next starts and both states crossfade (an edit of the schedule, as the live refresh sends
 * it). `data-preview-state` on <body> tells tests and people what happened last.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';
import { findStatusOfScheduleSlot } from '@bajaovrlay/shared/scheduleSlotStatus';

import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';
import SessionsBoardGraphic from './sessions-board.js';
import type { SessionsBoardSlot } from './sessionsBoardModel.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/**
 * The slots with the one in progress ended now and the next one starting now, which is
 * what "Atualizar" sends; the same slots when none is in progress.
 */
function endTheSlotInProgressNow(slots: SessionsBoardSlot[], nowMs: number): SessionsBoardSlot[] {
  const slotInProgress = slots.find(
    (slot) => findStatusOfScheduleSlot(slot, slots, nowMs) === 'inProgress',
  );
  if (slotInProgress === undefined) {
    return slots;
  }
  const slotsByStart = [...slots].sort((first, second) => first.startsAtMs - second.startsAtMs);
  const nextSlot = slotsByStart.find((slot) => slot.startsAtMs > slotInProgress.startsAtMs);
  return slots.map((slot) => {
    if (slot === slotInProgress) {
      return { ...slot, endsAtMs: nowMs };
    }
    if (slot === nextSlot) {
      return { ...slot, startsAtMs: nowMs };
    }
    return slot;
  });
}

/**
 * Reads the slots of the data the preview loads; none when it holds none. Taken as slots
 * without a check of its own: the graphic's load judges the same data and answers.
 */
function readSlotsOfData(data: unknown): SessionsBoardSlot[] {
  const isObject = typeof data === 'object' && data !== null;
  const slots = isObject && 'slots' in data ? data.slots : undefined;
  return Array.isArray(slots) ? (slots as SessionsBoardSlot[]) : [];
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-sessions-board', SessionsBoardGraphic);
  const board = document.createElement('baja-sessions-board') as SessionsBoardGraphic;
  previewStage.append(board);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => board.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => board.stopAction({}), 'offAir');
  });

  const dataChoice = choosePreviewData(location.search, Date.now());
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  let slots = readSlotsOfData(dataChoice.data);
  addPreviewButton(ptBR.preview.endTheSlotInProgressButton, () => {
    slots = endTheSlotInProgressNow(slots, Date.now());
    const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
    void runActionAndShowAnswer(
      'updateAction',
      () => board.updateAction({ data: { slots } }),
      stateAfterUpdate,
    );
  });

  await runActionAndShowAnswer(
    'load',
    () =>
      board.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => board.playAction({}), 'onAir');
  }
}

void startPreview();
