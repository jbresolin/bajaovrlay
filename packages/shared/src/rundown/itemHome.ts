import { z } from 'zod';

/**
 * Where an item lives: in a rundown (the scripted parts of the show, fired in order at
 * the cursor), in a quick-fire panel (buttons fired ad hoc), or among the event templates
 * ("Modelos de evento", BAJAOVRLAY-67): the items an event fills, which go on air only
 * through their event and are chosen and edited in "Regras", never as a button. Told
 * apart by `kind`, so an item is always in exactly one place, never in two and never in
 * none. There is one "Modelos de evento", so that home names nothing else.
 * Deliberate: a union and not two optional ids (`rundownId` or `quickFirePanelId`, as
 * the concept page first wrote it), because two optional ids allow both or none.
 */
export const ItemHomeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rundown'),
    rundownId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('quickFire'),
    panelId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('eventTemplates'),
  }),
]);

/** An item's home that has passed ItemHomeSchema. */
export type ItemHome = z.infer<typeof ItemHomeSchema>;

/**
 * Answers whether two homes are the same place: the same rundown, the same panel, or both
 * the event templates.
 */
export function isSameItemHome(oneHome: ItemHome, otherHome: ItemHome): boolean {
  if (oneHome.kind === 'rundown' && otherHome.kind === 'rundown') {
    return oneHome.rundownId === otherHome.rundownId;
  }
  if (oneHome.kind === 'quickFire' && otherHome.kind === 'quickFire') {
    return oneHome.panelId === otherHome.panelId;
  }
  return oneHome.kind === 'eventTemplates' && otherHome.kind === 'eventTemplates';
}
