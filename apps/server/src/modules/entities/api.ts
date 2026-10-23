// The module's REST route: GET /api/v1/entities/simulator-teams. Declared here with its
// Zod schema and mounted by api/v1/createApiV1Routes.ts, which stays thin.
import { TeamsSchema } from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

/** What the route answers: the notice that the teams are fictional, and the teams. */
export const SimulatorTeamsAnswerSchema = z.object({
  notice: z.string().min(1),
  teams: TeamsSchema,
});

/**
 * `GET /api/v1/entities/simulator-teams`: the simulator's hundred fictional teams as team
 * records, for "Importar equipes do simulador". A read with no state change, so a REST
 * route and not a command; the page imports them with importEntities itself, after
 * asking when the library already has teams.
 */
export const getSimulatorTeamsRoute = createRoute({
  method: 'get',
  path: '/entities/simulator-teams',
  summary: "The simulator's fictional teams, as entity records to import",
  responses: {
    200: {
      description: 'A hundred fictional teams, cars 1 to 100, with their schools and places.',
      content: { 'application/json': { schema: SimulatorTeamsAnswerSchema } },
    },
  },
});
