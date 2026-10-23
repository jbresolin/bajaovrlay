import type { EntityType } from '@bajaovrlay/shared';

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
 */
export function EntityLibraryPage() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{texts.pageTitle}</h2>
        <MediaFolderSummary />
      </div>
      <Tabs defaultValue="team">
        <TabsList aria-label={texts.tabListLabel}>
          {entityTypesInTabOrder.map((entityType) => (
            <TabsTrigger key={entityType} value={entityType}>
              {texts.tabs[entityType]}
            </TabsTrigger>
          ))}
        </TabsList>
        {entityTypesInTabOrder.map((entityType) => (
          <TabsContent key={entityType} value={entityType}>
            <EntityTab entityType={entityType} />
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
