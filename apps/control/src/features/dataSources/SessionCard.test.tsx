/**
 * The session card of the "Fontes" page (apps/control)
 *
 * What this module is for:
 *   For the selected source, the card says which event and session its data is about,
 *   the flag (with its colour), the session clock and the laps of the leader. The clock
 *   is not a still number: like the race clock on air it is worked out from one reading
 *   ("at this moment the clock read this") with the same shared sum and the same H:MM:SS
 *   text (packages/shared/src/clock), redrawn once a second while it runs.
 *
 * What these tests prove:
 *   - The card names the event and the session, the flag and the leader's laps.
 *   - Under green the countdown drops by one second per second, with no new data.
 *   - Under red the clock is held: time passes and the text stays.
 *
 * What these tests deliberately do not cover:
 *   - The sum and the rounding: packages/shared/src/clock tests.
 *   - The flag's colour, a CSS class of semantic tokens checked by eye.
 *   - A page whose clock disagrees with the server's: the shared server-aligned "now"
 *     is tested in packages/shared/src/clock.
 */
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildEnduroSnapshotAtLap34,
  buildEnduroSnapshotUnderRedFlag,
  momentOfTheSamplesMs,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { SessionCard } from './SessionCard';

/** Makes time stand still at the moment the samples' clock was read, until the test moves it. */
function holdThePageClockAtTheMomentOfTheSamples(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(momentOfTheSamplesMs));
}

/** Moves the page's clock forward and lets React draw what the timers asked for. */
function letTimePass(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

/** Builds the session of the enduro at lap 34, under green (or red when asked). */
function buildSessionAtLap34(flag: 'green' | 'red') {
  const snapshot =
    flag === 'green'
      ? buildEnduroSnapshotAtLap34(seededSimulatorId)
      : buildEnduroSnapshotUnderRedFlag(seededSimulatorId);
  const session = snapshot.shapes.session;
  if (session === undefined) {
    throw new Error('the enduro snapshot always has a session');
  }
  return session;
}

describe('the session card', () => {
  it('names the event, the session, the flag and the laps of the leader', () => {
    // Arrange: the enduro at lap 34 under green.
    const session = buildSessionAtLap34('green');

    // Act: draw the card.
    render(<SessionCard session={session} />);

    // Assert: everything the card is for, in pt-BR.
    expect(
      screen.getByText('Baja SAE Brasil 2027 — Etapa Nacional'),
      'the card must name the event',
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enduro de Resistência'),
      'the card must name the session',
    ).toBeInTheDocument();
    expect(screen.getByText('Verde'), 'the card must show the flag').toBeInTheDocument();
    expect(screen.getByText('34'), 'the card must show the laps of the leader').toBeInTheDocument();
  });

  it('counts the time left down live under green', () => {
    // Arrange: the moment the clock was read, 1:15:59.052 left (shown as 1:16:00).
    holdThePageClockAtTheMomentOfTheSamples();
    render(<SessionCard session={buildSessionAtLap34('green')} />);
    const clockTextAtTheReading = screen.getByRole('timer').textContent;

    // Act: three seconds pass, with no new data.
    letTimePass(3_000);

    // Assert: three seconds less on the clock.
    expect(clockTextAtTheReading, 'at the reading the countdown shows 1:16:00').toBe('1:16:00');
    expect(
      screen.getByRole('timer'),
      'the countdown must drop by itself, as the race clock on air does',
    ).toHaveTextContent('1:15:57');
  });

  it('holds the clock under red', () => {
    // Arrange: the same moment, the session under red with the clock held.
    holdThePageClockAtTheMomentOfTheSamples();
    render(<SessionCard session={buildSessionAtLap34('red')} />);

    // Act: three seconds pass.
    letTimePass(3_000);

    // Assert: the flag reads red and the clock has not moved.
    expect(screen.getByText('Vermelha'), 'the card must show the red flag').toBeInTheDocument();
    expect(
      screen.getByRole('timer'),
      'a held clock must not move while the red flag is out',
    ).toHaveTextContent('1:16:00');
  });
});
