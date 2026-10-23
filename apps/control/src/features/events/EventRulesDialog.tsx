import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { EventRuleRow } from './EventRuleRow';
import { isItemTakenOnlyThroughAnEvent } from './itemTakenThroughAnEvent';

const texts = ptBR.events.rules;

/**
 * "Regras" (BAJAOVRLAY-44): one row per kind of event, in the order the server keeps the
 * rules, each saved on its own (EventRuleRow.tsx). The items offered are the items an
 * event fills, by label: any other (a tower, a clock) would go on air in place of a notice
 * and leave after the rule's time, and the server refuses it (gate 2 of PR #22).
 */
export function EventRulesDialog(props: { onClose: () => void }) {
  const eventRules = useServerState((state) => state.eventRules);
  const items = useServerState((state) => state.items);
  const itemsAnEventFills = items.filter(isItemTakenOnlyThroughAnEvent);
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
        {eventRules.map((rule) => (
          <EventRuleRow key={rule.kind} rule={rule} items={itemsAnEventFills} />
        ))}
      </DialogContent>
    </Dialog>
  );
}
