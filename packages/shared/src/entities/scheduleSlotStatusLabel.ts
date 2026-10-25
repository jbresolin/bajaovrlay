import { ptBREntities } from './ptBREntities.js';
import type { ScheduleSlotStatus } from './scheduleSlotStatus.js';

/**
 * The pt-BR word for a status: "concluída", "em andamento", "a seguir". Kept apart from
 * the rule so a graphic bundling the rule does not carry the library's whole catalog; the
 * sessions board writes its own on-air words.
 */
export function labelOfScheduleSlotStatus(status: ScheduleSlotStatus): string {
  return ptBREntities.scheduleSlotStatusLabels[status];
}
