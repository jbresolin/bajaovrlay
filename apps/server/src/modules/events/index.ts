// Public surface of the event inbox module (BAJAOVRLAY-44). Core and other modules import
// from here, never from the files inside.

// Sends each inbox command (showEvent, dismissEvent, createManualEvent, updateEventRule,
// recordDetectedEvents) to its reducer; core's reduceCommand calls it.
export { type EventInboxCommand, reduceEventInboxCommand } from './reducers/reduceEventCommand.js';
// Moves events on and off the air with the program instances carrying them; core's
// reduceCommand calls it after every command that changed the instances.
export { followEventsOfProgramInstances } from './reducers/eventsOfInstancesBookkeeping.js';
// What fills an item's event fields in Prévia: an event's payload, a sample, or nothing.
export { chooseEventFillOfPreview, type EventFillOfPreviewChoice } from './eventFillOfPreview.js';
// Whether a preview of an event may be taken: its event must still wait, within its age.
export { findRefusalOfTakingAPreviewOfAnEvent } from './eventPreviewTakes.js';
// At boot: which instances an event put on air (dropped, their auto-out is lost), and the
// events still on air marked shown.
export { isInstanceOfAnEvent, markEventsOnAirAsShownAtBoot } from './eventNoticesAtBoot.js';
// Loads the events and the rules at boot, seeding the default rules when missing.
export { type EventInboxSlicesAtBoot, loadOrSeedEventInboxSlices } from './loadEventInboxSlices.js';
// Starts the event detection with the server; stop() when it closes.
export {
  type EventInboxService,
  type EventInboxServiceOptions,
  startEventInboxService,
} from './service.js';
