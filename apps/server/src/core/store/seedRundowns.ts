import type { Rundown } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * The one rundown seeded when the database has none: "Sessão principal", with no
 * session label yet and its cursor on nothing (there is no item to point at).
 * Its id is fixed and readable so it is the same on every machine, but clients must
 * read the id from the `rundowns` slice and never write it into their own code: more
 * rundowns, with ids made by the server, arrive in a later task.
 */
export const seededRundowns: Rundown[] = [
  {
    id: 'sessao-principal',
    name: ptBR.seededRundownName,
    sessionLabel: '',
    cursorItemId: null,
  },
];
