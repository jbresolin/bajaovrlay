/**
 * Test support shared by the notice's component tests: the element under test, its data,
 * and readers for what it shows. No theme token is placed on the page here, so every
 * timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import NoticeGraphic from './notice.js';
import type { NoticeData } from './noticeModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-notice-under-test', NoticeGraphic);

/** Builds the data of a fastest lap: car 31, Acauã Baja (Mauá), 4:38,2 on lap 34. */
export function createFastestLapData(): NoticeData {
  return {
    variant: 'fastestLap',
    carNumber: 31,
    teamName: 'Acauã Baja',
    schoolName: 'Mauá',
    lapNumber: 34,
    lapTimeText: '4:38,2',
  };
}

/** Builds the data of a penalty: car 47, Carnaúba Baja (UFERSA), +30 seconds for a jump start. */
export function createJumpStartPenaltyData(): NoticeData {
  return {
    variant: 'penalty',
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    noticeKind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
  };
}

/**
 * Puts a fresh notice element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createNoticeOnThePage(): NoticeGraphic {
  const notice = document.createElement('baja-notice-under-test') as NoticeGraphic;
  document.body.append(notice);
  onTestFinished(async () => {
    await notice.dispose();
    notice.remove();
  });
  return notice;
}

/** Loads the notice the way an OBS renderer does: real-time, at 1920x1080. */
export function loadNoticeWithData(notice: NoticeGraphic, data: unknown) {
  return notice.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfNotice(notice: NoticeGraphic, testId: string): HTMLElement | undefined {
  return notice.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(notice: NoticeGraphic, testId: string): string | null | undefined {
  return findPartOfNotice(notice, testId)?.textContent;
}

/** Reads the panel's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(notice: NoticeGraphic): string | undefined {
  return findPartOfNotice(notice, 'notice-panel')?.style.opacity;
}
