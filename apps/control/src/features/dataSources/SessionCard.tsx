import type { SessionShape, SessionState } from '@bajaovrlay/shared';
import { cn } from 'cn';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from '@/i18n/ptBR';

import { useSessionClockText } from './useSessionClockText';

const texts = ptBR.dataSources.sessionCard;

// The flag's colour with the page's semantic tokens only (index.css): green is success,
// yellow the amber warning, red destructive, the checkered flag black and white.
const flagClassForEachState = {
  pre: 'bg-secondary text-secondary-foreground',
  green: 'bg-success text-success-foreground',
  yellow: 'bg-warning text-warning-foreground',
  red: 'bg-destructive text-destructive-foreground',
  checkered: 'bg-primary text-primary-foreground',
  finished: 'bg-muted text-muted-foreground',
} as const satisfies Record<SessionState, string>;

/**
 * The session of the selected source's data: event and session names, the flag with its
 * colour, the session clock running live (useSessionClockText.ts, the race clock's own
 * sum and text) and the laps of the leader when the source knows them.
 */
export function SessionCard(props: { session: SessionShape }) {
  const { session } = props;
  const clockText = useSessionClockText(session.clock);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{texts.title}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{session.eventName}</p>
          <p className="font-semibold">{session.sessionName}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{texts.flagLabel}</dt>
          <dd>
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                flagClassForEachState[session.state],
              )}
            >
              {texts.flagStates[session.state]}
            </span>
          </dd>
          <dt className="text-muted-foreground">{texts.clockModes[session.clock.clockMode]}</dt>
          <dd>
            <span role="timer" className="font-mono text-lg tabular-nums">
              {clockText}
            </span>
          </dd>
          {session.lapsCompletedByLeader !== undefined && (
            <>
              <dt className="text-muted-foreground">{texts.lapsOfLeaderLabel}</dt>
              <dd className="tabular-nums">{session.lapsCompletedByLeader}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
