/**
 * The login page, "#/entrar" (apps/control)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29) the control page asks who you are before anything
 *   else: the role ("Produtor" or "Dados"), its PIN, and the station's name ("Mesa 1"),
 *   which the browser remembers for the next login. It is the only page reachable without
 *   a session. The server checks the PIN and sets the session cookie; the page then opens
 *   the console.
 *
 * What these tests prove:
 *   - The station typed last time is already filled in.
 *   - "Entrar" sends the role, the PIN and the station, remembers the station, and opens
 *     the console once the server accepts.
 *   - A wrong PIN, or the wait after five of them, shows the server's sentence and keeps
 *     the page; the PIN field is emptied for the next try.
 *   - A blank station, or no PIN, is said before anything is sent.
 *
 * What these tests deliberately do not cover:
 *   - The server's checks; apps/server's operatorLoginRoutes.test.ts.
 *   - The browser going from here to the console, a reload; the e2e.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';
import type { LoginAttemptOutcome } from './sessionRequests';
import { readRememberedStation, rememberStation } from './stationInBrowserStorage';

/** Draws the page with a stand-in for the server's answer to the login. */
function renderLoginPageAnsweredWith(outcome: LoginAttemptOutcome) {
  const sendLogin = vi.fn(() => Promise.resolve(outcome));
  const onLoggedIn = vi.fn();
  render(<LoginPage sendLogin={sendLogin} onLoggedIn={onLoggedIn} />);
  return { sendLogin, onLoggedIn };
}

/** Fills the form as an operator does: the role, the PIN, the station. */
function fillTheForm(form: { roleName: string; pin: string; station: string }) {
  fireEvent.click(screen.getByRole('radio', { name: form.roleName }));
  fireEvent.change(screen.getByLabelText('PIN'), { target: { value: form.pin } });
  fireEvent.change(screen.getByLabelText('Estação'), { target: { value: form.station } });
}

describe('the login page', () => {
  it('fills in the station typed last time', () => {
    // Arrange: "Mesa 2" remembered by this browser from yesterday's login.
    rememberStation('Mesa 2');

    // Act: open the page.
    renderLoginPageAnsweredWith({ isLoggedIn: true });

    // Assert: the station is already there.
    expect(screen.getByLabelText('Estação'), 'the browser remembers the station').toHaveValue(
      'Mesa 2',
    );
  });

  it('sends the role, PIN and station, remembers the station, and opens the console', async () => {
    // Arrange: a server that accepts the login.
    const { sendLogin, onLoggedIn } = renderLoginPageAnsweredWith({ isLoggedIn: true });
    fillTheForm({ roleName: 'Dados', pin: '135791', station: 'Mesa 3' });

    // Act: press "Entrar".
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    // Assert: the login went out as typed, the station is kept, the console opens.
    await waitFor(() => expect(onLoggedIn, 'the console opens').toHaveBeenCalledTimes(1));
    expect(sendLogin, 'the login as typed').toHaveBeenCalledWith({
      role: 'dados',
      pin: '135791',
      station: 'Mesa 3',
    });
    expect(readRememberedStation(), 'the station for the next login').toBe('Mesa 3');
  });

  const refusalScenarios = [
    // A mistyped PIN.
    {
      name: 'shows the server’s sentence for a wrong PIN',
      message: 'PIN errado. Confira o papel escolhido e o PIN.',
    },
    // The fifth wrong PIN in a row: the wait, with its seconds.
    {
      name: 'shows the wait after five wrong PINs',
      message: 'Muitos PINs errados deste computador. Espere 60 s e tente de novo.',
    },
  ];

  it.each(refusalScenarios)('$name', async ({ message }) => {
    // Arrange: a server that refuses the login with the row's sentence.
    const { onLoggedIn } = renderLoginPageAnsweredWith({ isLoggedIn: false, message });
    fillTheForm({ roleName: 'Produtor', pin: '246803', station: 'Mesa 1' });

    // Act: press "Entrar".
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    // Assert: the sentence is shown, the PIN is emptied, and the page stays.
    expect(await screen.findByRole('alert'), 'the server’s sentence').toHaveTextContent(message);
    expect(screen.getByLabelText('PIN'), 'the PIN is emptied for the next try').toHaveValue('');
    expect(onLoggedIn, 'the console does not open').not.toHaveBeenCalled();
  });

  const formProblemScenarios = [
    // Spaces for a station.
    {
      name: 'says a blank station before sending anything',
      form: { roleName: 'Produtor', pin: '246802', station: '  ' },
      expectedProblem: 'Digite o nome da estação (por exemplo, Mesa 1).',
    },
    // The PIN left empty.
    {
      name: 'says an empty PIN before sending anything',
      form: { roleName: 'Produtor', pin: '', station: 'Mesa 1' },
      expectedProblem: 'Digite o PIN do papel escolhido.',
    },
  ];

  it.each(formProblemScenarios)('$name', async ({ form, expectedProblem }) => {
    // Arrange: the page, filled as the row says.
    const { sendLogin } = renderLoginPageAnsweredWith({ isLoggedIn: true });
    fillTheForm(form);

    // Act: press "Entrar".
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    // Assert: the problem is said, and nothing went to the server.
    expect(await screen.findByRole('alert'), 'the problem, in pt-BR').toHaveTextContent(
      expectedProblem,
    );
    expect(sendLogin, 'nothing is sent with a problem in the form').not.toHaveBeenCalled();
  });
});
