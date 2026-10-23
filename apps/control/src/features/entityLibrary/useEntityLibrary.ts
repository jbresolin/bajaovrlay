import type { EntityLibrary } from '@bajaovrlay/shared';
import { useMemo } from 'react';

import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * The entity library as the server holds it now, the four slices together, the same
 * object until one of them changes. The item editor hands it to its form ("Cadastro")
 * and the markers read the takes against it.
 */
export function useEntityLibrary(): EntityLibrary {
  const teams = useServerState((state) => state.teams);
  const people = useServerState((state) => state.people);
  const sponsors = useServerState((state) => state.sponsors);
  const scheduleSlots = useServerState((state) => state.scheduleSlots);
  return useMemo(
    () => ({ teams, people, sponsors, scheduleSlots }),
    [teams, people, sponsors, scheduleSlots],
  );
}
