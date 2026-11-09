/**
 * Test support shared by the Super Chat card's component tests: the element under test,
 * its data, and readers for what it shows. No theme token is placed on the page here, so
 * every timeline lasts 0 ms and a test never waits on real motion. Fictional viewers only.
 */
import { onTestFinished } from 'vitest';

import SuperChatGraphic from './super-chat.js';
import type { SuperChatData } from './superChatModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-super-chat-under-test', SuperChatGraphic);

/** Builds Torcida Pequi Off-Road's R$ 20,00 Super Chat from Goiânia. */
export function createPequiSuperChatData(): SuperChatData {
  return {
    amountText: 'R$ 20,00',
    authorName: 'Torcida Pequi Off-Road',
    messageText: 'Vai, Pequi! Abraço de Goiânia',
  };
}

/**
 * Puts a fresh card on the page, as a renderer does before calling load. When the test
 * ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createSuperChatOnThePage(): SuperChatGraphic {
  const superChat = document.createElement('baja-super-chat-under-test') as SuperChatGraphic;
  document.body.append(superChat);
  onTestFinished(async () => {
    await superChat.dispose();
    superChat.remove();
  });
  return superChat;
}

/** Loads the card the way an OBS renderer does: real-time, at 1920x1080. */
export function loadSuperChatWithData(superChat: SuperChatGraphic, data: unknown) {
  return superChat.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the card by its test id inside the shadow root; undefined when absent. */
export function findPartOfSuperChat(
  superChat: SuperChatGraphic,
  testId: string,
): HTMLElement | undefined {
  return superChat.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** Reads the text of one part of the card, found by its test id inside the shadow root. */
export function readShownText(superChat: SuperChatGraphic, testId: string): string | undefined {
  return findPartOfSuperChat(superChat, testId)?.textContent ?? undefined;
}

/** Reads the card's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(superChat: SuperChatGraphic): string | undefined {
  return findPartOfSuperChat(superChat, 'super-chat-panel')?.style.opacity;
}
