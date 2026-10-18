// Finding and replacing one source in the `dataSources` list, for every reducer.
import type { DataSource } from '@bajaovrlay/shared';

/** The source with this id, or undefined when there is none. */
export function findDataSource(
  dataSources: DataSource[],
  sourceId: string,
): DataSource | undefined {
  return dataSources.find((source) => source.id === sourceId);
}

/**
 * A new list with the source of the same id swapped for its changed copy; the input list
 * is not touched.
 */
export function replaceDataSource(
  dataSources: DataSource[],
  changedSource: DataSource,
): DataSource[] {
  return dataSources.map((source) => (source.id === changedSource.id ? changedSource : source));
}
