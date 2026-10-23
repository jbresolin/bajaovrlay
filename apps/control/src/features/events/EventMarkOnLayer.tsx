import { Badge } from '@/components/ui/badge';
import { useServerState } from '@/state/ControlPageStateProvider';

import { describeEventMarkOnLayer } from './inboxEventText';

/**
 * Camadas' mark on an instance an event put on air (BAJAOVRLAY-44): "evento: penalidade ·
 * carro 47", read from the event in the `events` slice; "evento" alone once the slice has
 * dropped it. Nothing for an instance no event put on air.
 */
export function EventMarkOnLayer(props: { eventId: string | undefined }) {
  const events = useServerState((state) => state.events);
  if (props.eventId === undefined) {
    return null;
  }
  const event = events.find((candidate) => candidate.eventId === props.eventId);
  return <Badge variant="outline">{describeEventMarkOnLayer(event)}</Badge>;
}
