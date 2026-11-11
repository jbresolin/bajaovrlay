import type { Graphic, InboxEventKind, Item } from '@bajaovrlay/shared';
import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ItemEditorPanel } from '@/features/items/ItemEditorPanel';
import type { PrefilledOpening } from '@/features/items/ItemEditorTargetProvider';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { EventRuleRow } from './EventRuleRow';
import {
  buildPrefillOfANewTemplate,
  listGraphicsForANewTemplate,
  listTemplatesSuitingKind,
} from './eventRuleTemplates';

const texts = ptBR.events.rules;

/**
 * What the box shows: the rules, or the item editor on a template ("Editar aparência") or
 * on a new one ("+ Novo modelo"), in place of the rules until it closes.
 */
type RulesBoxView =
  | { kind: 'rules' }
  | { kind: 'editingTemplate'; template: Item }
  | { kind: 'newTemplate'; prefilledOpening: PrefilledOpening };

/**
 * "Regras" (BAJAOVRLAY-44): one row per kind of event, in the order the server keeps the
 * rules, each saved on its own (EventRuleRow.tsx). Since BAJAOVRLAY-67 each row also shows
 * its template, the look of its events: "Trocar" offers the templates the kind's events
 * fill (never a tower or a clock, which would go on air in place of a notice and leave
 * after the rule's time; gate 2 of PR #22), and "Editar aparência" and "+ Novo modelo"
 * open the item editor in this same box, the rules coming back when it closes. A new
 * template goes to "Modelos de evento"; "Trocar" then chooses it for a rule.
 */
export function EventRulesDialog(props: { onClose: () => void }) {
  const eventRules = useServerState((state) => state.eventRules);
  const items = useServerState((state) => state.items);
  const graphics = useServerState((state) => state.graphics);
  const [view, setView] = useState<RulesBoxView>({ kind: 'rules' });
  const [numberOfNewTemplatesOpened, setNumberOfNewTemplatesOpened] = useState(0);

  function openTheEditorOnANewTemplate(graphic: Graphic, kind: InboxEventKind): void {
    const openingNumber = numberOfNewTemplatesOpened + 1;
    setNumberOfNewTemplatesOpened(openingNumber);
    setView({
      kind: 'newTemplate',
      prefilledOpening: { prefill: buildPrefillOfANewTemplate(graphic, kind), openingNumber },
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onClose();
        }
      }}
    >
      <DialogContent closeButtonLabel={texts.closeButton} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        {view.kind === 'editingTemplate' && (
          <ItemEditorPanel
            homeForNewItem={{ kind: 'eventTemplates' }}
            itemBeingEdited={view.template}
            onClose={() => setView({ kind: 'rules' })}
          />
        )}
        {view.kind === 'newTemplate' && (
          <ItemEditorPanel
            homeForNewItem={{ kind: 'eventTemplates' }}
            prefilledOpening={view.prefilledOpening}
            itemBeingEdited={null}
            onClose={() => setView({ kind: 'rules' })}
          />
        )}
        {view.kind === 'rules' &&
          eventRules.map((rule) => (
            <EventRuleRow
              key={rule.kind}
              rule={rule}
              templatesOffered={listTemplatesSuitingKind(items, rule.kind)}
              templateOfTheRule={items.find((item) => item.id === rule.itemId)}
              graphicsForANewTemplate={listGraphicsForANewTemplate(graphics, rule.kind)}
              onEditTemplate={(template) => setView({ kind: 'editingTemplate', template })}
              onNewTemplate={(graphic) => openTheEditorOnANewTemplate(graphic, rule.kind)}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
