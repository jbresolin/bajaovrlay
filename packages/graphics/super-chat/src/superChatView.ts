/**
 * The Super Chat card's DOM: the template Lit draws once, and the function that afterwards
 * writes the data into it in place. Nothing is rebuilt: the message row is hidden (the
 * `hidden` attribute) when there is no message, so an update on air touches only text and
 * attributes. The author and the message are the kit's scrolling boxes (BAJAOVRLAY-55): a
 * name or a message too long for the 420 px card scrolls inside its box instead of being
 * cut with an ellipsis. YouTube's emoji shortcodes are taken out of the message here, the
 * one place it is written (youTubeEmojiShortcodes.ts).
 */
import { writeScrollingTextIfChanged } from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { html, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import type { SuperChatAnimatedElements } from './superChatAnimations.js';
import type { SuperChatData } from './superChatModel.js';
import { removeYouTubeEmojiShortcodes } from './youTubeEmojiShortcodes.js';

/** The elements whose text or attributes change after the first render. */
export type SuperChatParts = SuperChatAnimatedElements & {
  amount: HTMLElement;
  author: HTMLElement;
  messageRow: HTMLElement;
  message: HTMLElement;
};

/** The card's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderSuperChatTemplate(): TemplateResult {
  return html`
    <section class="super-chat-panel" data-testid="super-chat-panel">
      <header class="head">
        <span class="badge" data-testid="super-chat-badge">${ptBR.superChatBadge}</span>
        <span class="amount" data-testid="super-chat-amount"></span>
      </header>
      <div class="row">
        <span class="author" data-testid="super-chat-author"></span>
      </div>
      <div class="row message-row" data-testid="super-chat-message-row">
        <span class="message" data-testid="super-chat-message"></span>
      </div>
    </section>
  `;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findSuperChatParts(renderRoot: ParentNode): SuperChatParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`super chat part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    panel: findPart('super-chat-panel'),
    amount: findPart('super-chat-amount'),
    author: findPart('super-chat-author'),
    messageRow: findPart('super-chat-message-row'),
    message: findPart('super-chat-message'),
  };
}

/**
 * Writes the whole card from its data, in place: the amount in the head, the author, and
 * the message without YouTube's emoji shortcodes. A message that is empty, or becomes
 * empty once its shortcodes are out, hides its row: the card is the amount and the author.
 */
export function writeSuperChatData(parts: SuperChatParts, data: SuperChatData): void {
  writeTextIfChanged(parts.amount, data.amountText);
  writeScrollingTextIfChanged(parts.author, data.authorName);

  const shownMessage = removeYouTubeEmojiShortcodes(data.messageText ?? '');
  const hasMessage = shownMessage !== '';
  parts.messageRow.hidden = !hasMessage;
  writeScrollingTextIfChanged(parts.message, shownMessage);
}
