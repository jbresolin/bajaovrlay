// Test support: the quick-fire strip drawn with the battle card's button on a page
// connected to a fake server, and its "Escolher carros" box opened as an operator opens it
// (BAJAOVRLAY-82). Functions only; every call draws a new page.
import type { SessionAnswer, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { battleCardLabel } from './battleCardButton.testSupport';

/** The Dados role logged in at the second desk. */
export const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-11-15T07:00:00.000Z' },
};

/** Draws the strip on a page connected to a fake server, as the given role when one is named. */
export function drawTheStripWithTheBattleCard(slices: Slices, sessionAnswer?: SessionAnswer) {
  return renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    slices,
    sessionAnswer === undefined ? undefined : { sessionAnswer },
  );
}

/** Presses the battle card's chevron and returns its open box, to look inside it. */
export function openTheBoxWithTheChevron() {
  fireEvent.click(screen.getByRole('button', { name: `Escolher carros: ${battleCardLabel}` }));
  return within(screen.getByRole('dialog', { name: `Escolher carros — ${battleCardLabel}` }));
}
