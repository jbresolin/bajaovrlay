import type { EntityType } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useServerAlignedTimeMs } from '@/features/dataSources/useServerAlignedTimeMs';
import { DeleteItemButton } from '@/features/rundown/DeleteItemButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand } from '@/state/ControlPageStateProvider';

import { listRecordsOfTypeInOrder } from './entityOrdering';
import {
  type AnyEntityRecord,
  buildDeleteCommandOfRecord,
  readKeyOfRecord,
} from './entityRecordsOfType';
import { listTableColumnsOfEntityType } from './entityTableColumns';
import { useEntityLibrary } from './useEntityLibrary';

const texts = ptBR.entityLibrary;

// A slot's status changes as time passes; read again every 30 s, which a schedule of
// sessions hours long does not notice.
const statusRefreshIntervalMs = 30_000;

/** What a tab gives its table. */
export type EntityTableProps = {
  entityType: EntityType;
  /** Opens the form on a record ("Editar"). */
  onEdit: (record: AnyEntityRecord) => void;
};

/**
 * The table of one Cadastros tab: its records in the tab's order (entityOrdering.ts),
 * one column per field the tab shows (entityTableColumns.tsx), and "Editar" and
 * "Excluir" (two presses, the rundown's DeleteItemButton) on each row. The schedule's
 * status is worked out from the server-aligned clock at each draw. A table wider than a
 * tablet scrolls sideways by itself (the shadcn table's box).
 */
export function EntityTable(props: EntityTableProps) {
  const { entityType } = props;
  const library = useEntityLibrary();
  const sendCommand = useSendCommand();
  const nowMs = useServerAlignedTimeMs(statusRefreshIntervalMs);

  const records = listRecordsOfTypeInOrder(library, entityType);
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">{texts.emptyTabs[entityType]}</p>;
  }
  const columns = listTableColumnsOfEntityType(entityType);
  return (
    <Table aria-label={texts.tableLabels[entityType]}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.header}>{column.header}</TableHead>
          ))}
          <TableHead>{texts.columns.actions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={readKeyOfRecord(entityType, record)}>
            {columns.map((column) => (
              <TableCell key={column.header}>
                {column.renderCell(record, { nowMs, scheduleSlots: library.scheduleSlots })}
              </TableCell>
            ))}
            <TableCell>
              <div className="flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => props.onEdit(record)}>
                  {texts.editButton}
                </Button>
                <DeleteItemButton
                  texts={{
                    deleteButton: texts.deleteButton,
                    confirmButton: texts.deleteConfirmButton,
                  }}
                  onDeleteConfirmed={() => {
                    void sendCommand(buildDeleteCommandOfRecord(entityType, record));
                  }}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
