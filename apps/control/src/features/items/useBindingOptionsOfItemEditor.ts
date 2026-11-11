import { resolveBindingAgainstSources } from '@bajaovrlay/shared';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SchemaFormBindingOptions } from '@/features/schemaForm';
import {
  useReadServerStateNow,
  useServerState,
  useSubscribeToServerState,
} from '@/state/ControlPageStateProvider';

/**
 * What the item editor hands its generated form so a field can read a data source: the
 * sources the server lists, and a way to read a binding against the slices the page holds
 * now (the shared resolveBindingAgainstSources, so the "Valor agora" line says what a take
 * would read, overrides included, and the library's teams for withTeamLogos), with the
 * store's subscription for that line. The same object until a source is added, removed or
 * renamed: never at a poll, so a poll redraws no field (BAJAOVRLAY-45).
 */
export function useBindingOptionsOfItemEditor(): SchemaFormBindingOptions {
  // The ids and the names of the sources, as two lists of texts compared text by text
  // (useShallow), not the sources: a source's status changes at every poll, its id and
  // name almost never. Both lists are read from the same slice, so they stay in step.
  const sourceIds = useServerState(
    useShallow((state) => state.dataSources.map((dataSource) => dataSource.id)),
  );
  const sourceLabels = useServerState(
    useShallow((state) => state.dataSources.map((dataSource) => dataSource.label)),
  );
  const readServerStateNow = useReadServerStateNow();
  const subscribeToServerState = useSubscribeToServerState();

  return useMemo(() => {
    const dataSources = sourceIds.map((sourceId, position) => ({
      id: sourceId,
      label: sourceLabels[position] ?? sourceId,
    }));
    return {
      dataSources,
      readValueNow: (binding) => {
        const {
          dataSources: sources,
          dataSnapshots,
          overrides,
          bracketMatchFocuses,
          teams,
        } = readServerStateNow();
        return resolveBindingAgainstSources(
          binding,
          { dataSources: sources, dataSnapshots, overrides, bracketMatchFocuses },
          { teams },
        );
      },
      subscribeToValuesNow: subscribeToServerState,
    };
  }, [sourceIds, sourceLabels, readServerStateNow, subscribeToServerState]);
}
