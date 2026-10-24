/**
 * The lower third's DOM: the template Lit draws once (the name pill, and under it the
 * role pill with the role, a dot and the team line), and the function that afterwards
 * writes the data into it in place. Nothing is rebuilt: a part the data has no use for
 * gets the `hidden` attribute, which takes it out of the layout (display: none), so a
 * missing part leaves no empty box and the pills shrink to what they hold.
 */
import { html, type TemplateResult } from 'lit';

import type { LowerThirdAnimatedElements } from './lowerThirdAnimations.js';
import type { LowerThirdData } from './lowerThirdModel.js';
import { ptBR } from './ptBR.js';

/** The elements whose text or attributes change after the first render. */
export type LowerThirdParts = LowerThirdAnimatedElements & {
  role: HTMLElement;
  separator: HTMLElement;
  teamLine: HTMLElement;
};

/** The lower third's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderLowerThirdTemplate(): TemplateResult {
  return html`
    <section class="lower-third" data-testid="lower-third">
      <div class="pill name-pill" data-testid="lower-third-name-pill"></div>
      <div class="pill role-pill" data-testid="lower-third-role-pill">
        <span class="role" data-testid="lower-third-role"></span>
        <span class="separator" data-testid="lower-third-separator">${ptBR.teamLineSeparator}</span>
        <span class="team-line" data-testid="lower-third-team-line"></span>
      </div>
    </section>
  `;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findLowerThirdParts(renderRoot: ParentNode): LowerThirdParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`lower third part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    namePill: findPart('lower-third-name-pill'),
    rolePill: findPart('lower-third-role-pill'),
    role: findPart('lower-third-role'),
    separator: findPart('lower-third-separator'),
    teamLine: findPart('lower-third-team-line'),
  };
}

/**
 * Answers whether a text field has something to show. A text of blanks counts as
 * missing: an operator who cleared a field by typing spaces must not leave an empty box
 * on air.
 */
function isTextGiven(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== '';
}

/** Changes an element's text only when it differs, so an update touches only what changed. */
function writeTextIfChanged(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

/** Shows an element with the text, or hides it (and empties it) when there is none. */
function showTextOrHide(element: HTMLElement, text: string | undefined): void {
  const isShown = text !== undefined;
  element.hidden = !isShown;
  writeTextIfChanged(element, isShown ? text : '');
}

/**
 * Writes the whole lower third from its data, in place. The role pill holds the role
 * and the team line, with the dot between them only when both are there; with neither,
 * the role pill is hidden and the name pill stands alone.
 */
export function writeLowerThirdData(parts: LowerThirdParts, data: LowerThirdData): void {
  writeTextIfChanged(parts.namePill, data.name);

  const roleText = isTextGiven(data.role) ? data.role : undefined;
  const teamLineText = isTextGiven(data.teamLine) ? data.teamLine : undefined;
  showTextOrHide(parts.role, roleText);
  showTextOrHide(parts.teamLine, teamLineText);

  const hasRole = roleText !== undefined;
  const hasTeamLine = teamLineText !== undefined;
  parts.separator.hidden = !(hasRole && hasTeamLine);
  parts.rolePill.hidden = !hasRole && !hasTeamLine;
}
