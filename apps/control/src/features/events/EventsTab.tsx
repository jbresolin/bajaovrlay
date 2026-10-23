import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCurrentTime } from '@/features/layers/useCurrentTime';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { EventRulesDialog } from './EventRulesDialog';
import { listFinishedEventsNewestFirst, listWaitingEventsNewestFirst } from './inboxEventLists';
import { FinishedEventRow, InboxEventRow } from './InboxEventRow';
import { ManualEventDialog } from './ManualEventDialog';

const texts = ptBR.events;
const soundSwitchId = 'events-sound';

/** "há 2 min" moves on once a minute at most; checked every ten seconds. */
const ageRefreshIntervalMs = 10_000;

/**
 * The "Eventos" tab of the quick-fire strip (BAJAOVRLAY-44): "+ Evento", "Regras" and the
 * "Som de eventos" switch on top; the waiting events, newest first, each with its buttons;
 * and, greyed below, the last events that are over. Everything comes from the server's
 * `events` and `eventRules` slices; the one thing of this browser's own is the sound.
 */
export function EventsTab(props: {
  isEventSoundOn: boolean;
  chooseIsEventSoundOn: (isEventSoundOn: boolean) => void;
}) {
  const events = useServerState((state) => state.events);
  const eventRules = useServerState((state) => state.eventRules);
  const sendCommand = useSendCommand();
  const now = useCurrentTime(ageRefreshIntervalMs);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [areRulesOpen, setAreRulesOpen] = useState(false);

  const waitingEvents = listWaitingEventsNewestFirst(events);
  const finishedEvents = listFinishedEventsNewestFirst(events);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={() => setIsManualFormOpen(true)}>
          {texts.addEventButton}
        </Button>
        <Button size="xs" variant="outline" onClick={() => setAreRulesOpen(true)}>
          {texts.rulesButton}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Switch
            id={soundSwitchId}
            checked={props.isEventSoundOn}
            onCheckedChange={props.chooseIsEventSoundOn}
            onClick={(click) => click.currentTarget.blur()}
          />
          <Label htmlFor={soundSwitchId}>{texts.soundSwitchLabel}</Label>
        </div>
      </div>

      {waitingEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{texts.nothingWaiting}</p>
      ) : null}
      <ul aria-label={texts.waitingListLabel} className="flex flex-col gap-1">
        {waitingEvents.map((event) => (
          <InboxEventRow
            key={event.eventId}
            event={event}
            itemIdOfItsRule={eventRules.find((rule) => rule.kind === event.kind)?.itemId ?? null}
            now={now}
            sendCommand={sendCommand}
          />
        ))}
      </ul>
      <ul aria-label={texts.finishedListLabel} className="flex flex-col gap-0.5">
        {finishedEvents.map((event) => (
          <FinishedEventRow key={event.eventId} event={event} />
        ))}
      </ul>

      {isManualFormOpen ? <ManualEventDialog onClose={() => setIsManualFormOpen(false)} /> : null}
      {areRulesOpen ? <EventRulesDialog onClose={() => setAreRulesOpen(false)} /> : null}
    </div>
  );
}
