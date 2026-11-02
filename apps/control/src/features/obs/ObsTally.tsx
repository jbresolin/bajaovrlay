import type { ObsConnectionState, ObsSlice } from '@bajaovrlay/shared';
import { cn } from 'cn';

import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

const texts = ptBR.obs.tally;

// Only semantic colours: success while connected, muted while off or connecting, the
// destructive colour while the server cannot reach OBS.
const dotClassForEachConnectionState = {
  desligado: 'bg-muted-foreground',
  conectando: 'bg-muted-foreground',
  conectado: 'bg-success',
  erro: 'bg-destructive',
} as const satisfies Record<ObsConnectionState, string>;

/**
 * The OBS tally in the header (BAJAOVRLAY-27): "OBS", a dot for the connection, then the
 * scene on OBS's Program and, in Studio Mode, on its Preview; without a connection, the
 * state in words instead, never a scene. Hovering shows the address and the last error.
 * Read from the `obs` slice only; small and read-only on purpose, with nothing to press.
 */
export function ObsTally() {
  const obs = useServerState((state) => state.obs);
  const isConnected = obs.connectionState === 'conectado';

  return (
    <div
      role="status"
      aria-label={texts.label}
      title={describeObsForTheHover(obs)}
      className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
    >
      <span className="font-semibold">{texts.label}</span>{' '}
      <span
        aria-hidden="true"
        data-testid="obs-connection-dot"
        data-connection-state={obs.connectionState}
        className={cn('size-2 rounded-full', dotClassForEachConnectionState[obs.connectionState])}
      />
      {isConnected ? (
        <span>{texts.programScene(obs.programSceneName ?? texts.noScene)}</span>
      ) : (
        <span className="text-muted-foreground">{texts.stateWords[obs.connectionState]}</span>
      )}
      {isConnected && obs.isStudioModeOn ? (
        <>
          {' '}
          <span>{texts.previewScene(obs.previewSceneName ?? texts.noScene)}</span>
        </>
      ) : null}
    </div>
  );
}

/**
 * The hover text: what to set when OBS is not configured, otherwise the address and,
 * once OBS has failed even once, the last error, one per line.
 */
function describeObsForTheHover(obs: ObsSlice): string {
  if (obs.address === null) {
    return texts.notConfiguredHint;
  }
  const addressLine = texts.addressLine(obs.address);
  if (obs.lastError === null) {
    return addressLine;
  }
  return `${addressLine}\n${texts.lastErrorLine(obs.lastError)}`;
}
