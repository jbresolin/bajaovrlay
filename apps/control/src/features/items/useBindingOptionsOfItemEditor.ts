import { resolveBindingAgainstSources } from '@bajaovrlay/shared';
import { useMemo } from 'react';

import type { SchemaFormBindingOptions } from '@/features/schemaForm';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * What the item editor hands its generated form so a field can read a data source: the
 * sources the server lists, and a way to read a binding against the slices the page holds
 * now (the shared resolveBindingAgainstSources, so the "Valor agora" line says what a take
 * would read, overrides included). Built anew when the sources, snapshots or overrides change.
 */
export function useBindingOptionsOfItemEditor(): SchemaFormBindingOptions {
  const dataSources = useServerState((state) => state.dataSources);
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const overrides = useServerState((state) => state.overrides);
  return useMemo(
    () => ({
      dataSources: dataSources.map((dataSource) => ({
        id: dataSource.id,
        label: dataSource.label,
      })),
      readValueNow: (binding) =>
        resolveBindingAgainstSources(binding, { dataSources, dataSnapshots, overrides }),
    }),
    [dataSources, dataSnapshots, overrides],
  );
}
