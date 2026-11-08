import { type LoginRequest, type OperatorRole, StationNameSchema } from '@bajaovrlay/shared';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ptBR } from '@/i18n/ptBR';

import type { LoginAttemptOutcome } from './sessionRequests';
import { readRememberedStation, rememberStation } from './stationInBrowserStorage';

const texts = ptBR.login;

// The two roles in the order the page lists them.
const rolesInTheirOrder: OperatorRole[] = ['produtor', 'dados'];

/**
 * "#/entrar" (BAJAOVRLAY-29): the only page reachable without a session while the PINs
 * are set. The operator picks the role, types its PIN and the station's name, which this
 * browser remembers for the next login, and presses "Entrar". A problem in the form is
 * said before anything is sent; the server's refusal (a wrong PIN, the minute's wait after
 * five) is shown as the server words it, and the PIN emptied for the next try. `sendLogin`
 * and `onLoggedIn` are the real requests in main.tsx and stand-ins in tests.
 */
export function LoginPage(props: {
  sendLogin: (login: LoginRequest) => Promise<LoginAttemptOutcome>;
  onLoggedIn: () => void;
}) {
  const [role, setRole] = useState<OperatorRole>('produtor');
  const [pin, setPin] = useState('');
  const [station, setStation] = useState(readRememberedStation);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  async function logIn(submit: FormEvent<HTMLFormElement>): Promise<void> {
    submit.preventDefault();
    const stationReading = StationNameSchema.safeParse(station);
    if (!stationReading.success) {
      setProblem(stationReading.error.issues[0]?.message);
      return;
    }
    if (pin === '') {
      setProblem(texts.problems.emptyPin);
      return;
    }
    setProblem(undefined);
    setIsWaitingForTheServer(true);
    const outcome = await props.sendLogin({ role, pin, station: stationReading.data });
    setIsWaitingForTheServer(false);
    if (!outcome.isLoggedIn) {
      setProblem(outcome.message);
      setPin('');
      return;
    }
    rememberStation(stationReading.data);
    props.onLoggedIn();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{texts.pageTitle}</CardTitle>
          <CardDescription>{texts.pageIntro}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(submit) => void logIn(submit)}>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{texts.roleLegend}</legend>
              {rolesInTheirOrder.map((roleInTheList) => (
                <label
                  key={roleInTheList}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2 has-checked:border-primary"
                >
                  <input
                    type="radio"
                    name="papel"
                    value={roleInTheList}
                    aria-label={texts.roleNames[roleInTheList]}
                    checked={role === roleInTheList}
                    onChange={() => setRole(roleInTheList)}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{texts.roleNames[roleInTheList]}</span>
                    <span className="text-xs text-muted-foreground">
                      {texts.roleDescriptions[roleInTheList]}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1">
              <Label htmlFor="login-pin">{texts.pinLabel}</Label>
              <Input
                id="login-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="login-station">{texts.stationLabel}</Label>
              <Input
                id="login-station"
                autoComplete="off"
                placeholder={texts.stationPlaceholder}
                value={station}
                onChange={(event) => setStation(event.target.value)}
              />
            </div>
            {problem === undefined ? null : (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            )}
            <Button type="submit" disabled={isWaitingForTheServer}>
              {isWaitingForTheServer ? texts.loggingIn : texts.logInButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
