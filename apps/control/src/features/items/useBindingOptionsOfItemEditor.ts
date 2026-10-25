import { resolveBindingAgainstSources } from '@bajaovrlay/shared';
import { useMemo } from 'react';

import type { SchemaFormBindingOptions } from '@/features/schemaForm';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * What the item editor hands its generated form so a field can read a data source: the
 * sources the server lists, and a way to read a binding against the slices the page holds
 * now (the shared resolveBindingAgainstSources, so the "Valor agora" line says what a take
 * would read, overrides included, and the library's teams for withTeamLogos). Built anew when
 * the sources, snapshots, overrides or teams change.
 */
export function useBindingOptionsOfItemEditor(): SchemaFormBindingOptions {
  const dataSources = useServerState((state) => state.dataSources);
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const overrides = useServerState((state) => state.overrides);
  const teams = useServerState((state) => state.teams);
  return useMemo(
    () => ({
      dataSources: dataSources.map((dataSource) => ({
        id: dataSource.id,
        label: dataSource.label,
      })),
      readValueNow: (binding) =>
        resolveBindingAgainstSources(binding, { dataSources, dataSnapshots, overrides }, { teams }),
    }),
    [dataSources, dataSnapshots, overrides, teams],
  );
}
