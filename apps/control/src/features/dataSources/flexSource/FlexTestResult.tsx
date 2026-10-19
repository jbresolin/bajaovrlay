import { ptBR } from '@/i18n/ptBR';

import { SessionCard } from '../SessionCard';
import { SnapshotPositionsTable } from '../SnapshotPositionsTable';
import { SnapshotStandingsTable } from '../SnapshotStandingsTable';
import type { FlexSampleTestResult } from './flexSampleTesting';

const texts = ptBR.dataSources.flexForm.test;

/**
 * What "Testar" found: the canonical shapes in the very tables the source detail draws
 * (session card, positions, standings), so the operator sees the data as the Fontes page
 * will show it once saved; or the list of problems, each a pt-BR line naming the shape,
 * the car and line, the field and the path.
 */
export function FlexTestResult(props: { result: FlexSampleTestResult }) {
  const { result } = props;
  if (!result.isPassing) {
    return (
      <div role="alert" aria-label={texts.problemsTitle} className="flex flex-col gap-1">
        <p className="text-sm font-medium text-destructive">{texts.problemsTitle}</p>
        <ul className="list-disc pl-5 text-sm text-destructive">
          {result.problems.map((problem, problemIndex) => (
            <li key={`${problemIndex}-${problem}`}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  }

  const shapes = result.shapes;
  return (
    <section aria-label={texts.resultTitle} className="flex min-w-0 flex-col gap-4">
      <p className="text-sm">{texts.shapesPassed}</p>
      {shapes.session !== undefined && <SessionCard session={shapes.session} />}
      {shapes.positions !== undefined && <SnapshotPositionsTable positions={shapes.positions} />}
      {shapes.standings !== undefined && <SnapshotStandingsTable standings={shapes.standings} />}
    </section>
  );
}
