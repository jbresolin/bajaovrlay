import type { EntityType } from '@bajaovrlay/shared';
import { useState } from 'react';

import { readRecordToOpenFromHash } from '@/app/recordToOpen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ptBR } from '@/i18n/ptBR';

import { EntityTab } from './EntityTab';
import { MediaFolderSummary } from './MediaFolderSummary';

const texts = ptBR.entityLibrary;

// The tabs, in the order the page shows them; Equipes opens first.
const entityTypesInTabOrder: readonly EntityType[] = ['team', 'person', 'sponsor', 'scheduleSlot'];

/**
 * The "Cadastros" page (#/cadastros, BAJAOVRLAY-19): the entity library the item fields
 * read, kept by the data operator on a desktop or a tablet, in a tab of its own so the
 * console never unmounts under the producer. Above the tabs, the images of the media
 * store; then one tab per kind of record (EntityTab.tsx). Everything shown comes from the
 * server's slices; every change is a command.
 *
 * Opened at the address of one record ("#/cadastros/person/narrador-joao", from "Editar no
 * cadastro" in "Edição rápida"), it starts on that record's tab with its form open. The
 * address is read once, as the page is drawn: the link always opens a new browser tab.
 */
export function EntityLibraryPage() {
  const [recordToOpen] = useState(() => readRecordToOpenFromHash(window.location.hash));
  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{texts.pageTitle}</h2>
        <MediaFolderSummary />
      </div>
      <Tabs defaultValue={recordToOpen?.entityType ?? 'team'}>
        <TabsList aria-label={texts.tabListLabel}>
          {entityTypesInTabOrder.map((entityType) => (
            <TabsTrigger key={entityType} value={entityType}>
              {texts.tabs[entityType]}
            </TabsTrigger>
          ))}
        </TabsList>
        {entityTypesInTabOrder.map((entityType) => (
          <TabsContent key={entityType} value={entityType}>
            <EntityTab
              entityType={entityType}
              recordKeyToOpen={
                recordToOpen?.entityType === entityType ? recordToOpen.recordKey : undefined
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
