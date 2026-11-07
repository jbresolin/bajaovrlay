import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { TriggersDialog } from '@/features/triggers/TriggersDialog';
import { WaitingTriggerFirings } from '@/features/triggers/WaitingTriggerFirings';
import { ptBR } from '@/i18n/ptBR';

import { EventHistoryTable } from './EventHistoryTable';
import { EventRulesDialog } from './EventRulesDialog';
import { ManualEventDialog } from './ManualEventDialog';
import { WaitingEventsList } from './WaitingEventsList';

const texts = ptBR.events;

/**
 * The "Eventos" page, "#/eventos" (gate 2 of PR #22): the room the console's tab does not
 * have. "+ Evento", "Regras" and "Gatilhos" (BAJAOVRLAY-48, features/triggers) on top; the waiting events with the same buttons as on the
 * console, uncapped; and the history of every event the server keeps
 * (EventHistoryTable.tsx), where a dismissed event can be restored. A refusal of the
 * commands sent from here shows at the bottom. Opened from the header in a new tab, so it
 * can sit on a second screen; it plays no chime, which stays with the console's tab.
 */
export function EventReviewPage() {
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [areRulesOpen, setAreRulesOpen] = useState(false);
  const [areTriggersOpen, setAreTriggersOpen] = useState(false);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold">{texts.reviewPage.title}</h2>
        <Button size="sm" variant="outline" onClick={() => setIsManualFormOpen(true)}>
          {texts.addEventButton}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAreRulesOpen(true)}>
          {texts.rulesButton}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAreTriggersOpen(true)}>
          {ptBR.triggers.openButton}
        </Button>
      </div>

      <section className="flex max-w-3xl flex-col gap-2">
        <h3 className="text-sm font-semibold">{texts.reviewPage.waitingHeading}</h3>
        <WaitingTriggerFirings />
        <WaitingEventsList />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{texts.reviewPage.historyHeading}</h3>
        <EventHistoryTable />
      </section>

      <CommandErrorMessage
        commandTypes={[
          'previewItem',
          'showEvent',
          'dismissEvent',
          'restoreEvent',
          'runTriggerFiring',
          'dismissTriggerFiring',
        ]}
      />

      {isManualFormOpen ? <ManualEventDialog onClose={() => setIsManualFormOpen(false)} /> : null}
      {areRulesOpen ? <EventRulesDialog onClose={() => setAreRulesOpen(false)} /> : null}
      {areTriggersOpen ? <TriggersDialog onClose={() => setAreTriggersOpen(false)} /> : null}
    </main>
  );
}
