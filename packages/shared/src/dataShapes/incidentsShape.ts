import { z } from 'zod';

import { ptBRDataShapes } from './ptBRDataShapes.js';

/**
 * What the race direction recorded: a penalty given, a warning, or an incident (a
 * rollover, a car stopped on track). The notice has one look per kind; the list is closed.
 */
export const IncidentKindSchema = z.enum(['penalty', 'warning', 'incident']);

/** One kind of incident. */
export type IncidentKind = z.infer<typeof IncidentKindSchema>;

/**
 * One incident, repeating the car's team and school so a graphic never joins tables.
 * Every optional field means "the source does not know", never a placeholder.
 */
export const IncidentEntrySchema = z.object({
  /**
   * The source's own id for this incident, stable from poll to poll: the event inbox
   * keys the event by it, so a changed id would show the same penalty twice.
   */
  incidentId: z.string().min(1),
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1),
  kind: IncidentKindSchema,
  /** Why, in pt-BR as the race direction wrote it: "Queima de largada". */
  reason: z.string().min(1),
  /** The penalty itself, when there is one: "+30 segundos", "Volta cancelada". */
  penaltyText: z.string().min(1).optional(),
  /** The lap the car was on, from 1. */
  lap: z.number().int().min(1).optional(),
  /** When it happened, in ms since 1970 (the server's clock). */
  atMs: z.number().int().min(0).optional(),
});

/** One incident that has passed IncidentEntrySchema. */
export type IncidentEntry = z.infer<typeof IncidentEntrySchema>;

/**
 * The incidents shape: every incident of one session the source knows, in the order the
 * source sends them. The one rule across entries: an id appears once, because the inbox
 * keys events by it. No order is required: the inbox orders events by when it detected
 * them, and a source may list its newest incident first or last.
 */
export const IncidentsShapeSchema = z
  .object({
    sessionId: z.string().min(1),
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    entries: z.array(IncidentEntrySchema),
  })
  .superRefine((incidents, context) => {
    const incidentIdsSeen = new Set<string>();
    incidents.entries.forEach((entry, index) => {
      if (incidentIdsSeen.has(entry.incidentId)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'incidentId'],
          message: ptBRDataShapes.shapeRuleReasons.incidentListedTwice(entry.incidentId),
        });
      }
      incidentIdsSeen.add(entry.incidentId);
    });
  });

/** Incidents that have passed IncidentsShapeSchema. */
export type IncidentsShape = z.infer<typeof IncidentsShapeSchema>;
