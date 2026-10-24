import { hashOfEachPage } from '@/app/currentPage';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';

import { RecentlyDismissedEvents } from './RecentlyDismissedEvents';
import { WaitingEventsList } from './WaitingEventsList';

const texts = ptBR.events;
const soundSwitchId = 'events-sound';

/**
 * The "Eventos" tab of the quick-fire strip (BAJAOVRLAY-44): "Som de eventos" and the link
 * to the "Eventos" page on top, then the waiting events, newest first, each with its
 * buttons, and under them what was dismissed in the last 30 s with "Desfazer"
 * (RecentlyDismissedEvents.tsx). The tab sits above Camadas, so both lists scroll inside
 * one capped height (16rem), and a burst of events or of dismissals never pushes Camadas
 * off the screen; everything else about the inbox (the
 * history, "+ Evento", "Regras") is on the page, which opens in a new tab so the console
 * stays (gate 2 of PR #22). The sound stays here because the chime plays on the console;
 * it is this browser's own setting.
 */
export function EventsTab(props: {
  isEventSoundOn: boolean;
  chooseIsEventSoundOn: (isEventSoundOn: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={hashOfEachPage.eventReview}
          target="_blank"
          rel="noopener"
          className="text-sm underline underline-offset-4"
        >
          {texts.openReviewPageLink}
        </a>
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

      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        <WaitingEventsList />
        <RecentlyDismissedEvents />
      </div>
    </div>
  );
}
