import {
  applyOverridesToSnapshotShapes,
  type DataSource,
  type SessionShape,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { RawSnapshotJson } from './RawSnapshotJson';
import { SessionCard } from './SessionCard';
import { SnapshotPositionsTable } from './SnapshotPositionsTable';
import { SnapshotStandingsTable } from './SnapshotStandingsTable';
import { StaleSnapshotBanner, type WhyTheDataIsOld } from './StaleSnapshotBanner';

/** Why the source's data is not live, or null when it is: off wins over late. */
function findWhyTheDataIsOld(source: DataSource): WhyTheDataIsOld | null {
  if (!source.isEnabled) {
    return 'sourceIsOff';
  }
  if (source.status.isStale) {
    return 'sourceIsLate';
  }
  return null;
}

/**
 * The session of a source that is off, with its clock held at the last reading: nothing
 * runs the race any more, and a clock still counting would look live.
 */
function holdTheSessionClock(session: SessionShape): SessionShape {
  return { ...session, clock: { ...session.clock, running: false } };
}

/**
 * The latest data of one source, readably: the stale banner when the data is not live,
 * the session card, the positions and standings tables, and the raw JSON on request.
 * Each part shows only when the source produced that shape. The data comes from the
 * `dataSnapshots` slice; a late source keeps showing its last good data (rule 4), its
 * session clock still counting as the race clock on air does; a source turned off keeps
 * its data too (the server never deletes it), with its clock held.
 */
export function DataSourceDetail(props: { source: DataSource }) {
  const { source } = props;
  const texts = ptBR.dataSources.detail;
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const overrides = useServerState((state) => state.overrides);
  const snapshot = dataSnapshots.find((candidate) => candidate.sourceId === source.id);
  const whyTheDataIsOld = findWhyTheDataIsOld(source);
  // What the tables show is the source's data with the operator's corrections laid over
  // it, as every binding reads it; what the source itself sent stays at hand for the
  // correction dialog.
  const shapesShown =
    snapshot === undefined
      ? undefined
      : applyOverridesToSnapshotShapes(source.id, snapshot.shapes, overrides);
  const sessionAsSent = snapshot?.shapes.session;
  const sessionCorrected = shapesShown?.session;
  const sessionToShow =
    sessionCorrected !== undefined && whyTheDataIsOld === 'sourceIsOff'
      ? holdTheSessionClock(sessionCorrected)
      : sessionCorrected;

  return (
    <section aria-label={texts.regionLabel(source.label)} className="flex min-w-0 flex-col gap-4">
      <h3 className="text-lg font-semibold">{source.label}</h3>
      {snapshot === undefined ? (
        <p className="text-sm text-muted-foreground">{texts.noSnapshot}</p>
      ) : (
        <>
          {whyTheDataIsOld !== null && (
            <StaleSnapshotBanner receivedAtMs={snapshot.receivedAtMs} reason={whyTheDataIsOld} />
          )}
          {sessionToShow !== undefined && (
            // Drawn anew for each snapshot, so its "now" is read after the new reading
            // was stamped: counting from an older "now" would step a countdown back up.
            <SessionCard
              key={snapshot.receivedAtMs}
              session={sessionToShow}
              corrections={
                sessionAsSent === undefined
                  ? undefined
                  : { sourceId: source.id, sourceLabel: source.label, sessionAsSent }
              }
            />
          )}
          {snapshot.shapes.positions !== undefined && shapesShown?.positions !== undefined && (
            <SnapshotPositionsTable
              positions={shapesShown.positions}
              corrections={{
                sourceId: source.id,
                sourceLabel: source.label,
                positionsAsSent: snapshot.shapes.positions,
              }}
            />
          )}
          {snapshot.shapes.standings !== undefined && shapesShown?.standings !== undefined && (
            <SnapshotStandingsTable
              standings={shapesShown.standings}
              corrections={{
                sourceId: source.id,
                sourceLabel: source.label,
                standingsAsSent: snapshot.shapes.standings,
              }}
            />
          )}
          <RawSnapshotJson shapes={snapshot.shapes} />
        </>
      )}
    </section>
  );
}
