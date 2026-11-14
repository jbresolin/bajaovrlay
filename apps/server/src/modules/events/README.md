# apps/server/src/modules/events

The event inbox (BAJAOVRLAY-44): things that happened once (a penalty given, a new fastest
lap, a leader change, a notice the operator typed) and the rules that put them on air.
Start at `eventDetection.ts`, which watches each accepted poll, runs `detectors/` on the
change and records what they found as `sistema:eventos`; then `reducers/`, one file per
command (show, approve a Super Chat, dismiss, restore a dismissed, shown or expired one,
type, change a rule, record), and
`reducers/eventsOfInstancesBookkeeping.ts`, the one rule that moves an event on air and to
shown with the instance carrying it. `eventRunner.ts` puts the events whose rule says auto on air
by itself, with the queue's three rules written next to it; "Pausar gatilhos" holds them
pending instead (`listNewEvent`, `holdQueuedEventsForThePause`, BAJAOVRLAY-73). `seedEventRules.ts` holds João's default rules,
`loadEventInboxSlices.ts` the boot, with the seeded templates (`seedEventItems.ts`) and the
one-time move of older templates off the quick-fire panels
(`moveEventTemplatesOffQuickFire.ts`, BAJAOVRLAY-67); `service.ts` the start and stop. `index.ts` lists what
core may use. A viewer's Super Chat (BAJAOVRLAY-35) waits pending until a person approves it
(`reducers/approveEvent.ts`); `superChatModerationOnTheStore.test.ts` is the whole flow.
