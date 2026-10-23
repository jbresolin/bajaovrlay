import type { EntityType } from '@bajaovrlay/shared';

/**
 * The lines of each tab's example file ("Baixar exemplo"), cell by cell in the order of
 * the tab's columns (entityCsvColumns.ts). Realistic and short: an operator sees the
 * format, keeps the header and types the event's own records over these. Each example
 * imports with no error (entityCsvExport.test.ts).
 */
export const exampleLinesOfEachTab: Record<EntityType, string[][]> = {
  team: [
    ['42', 'Baja UFPR', 'UFPR', 'Universidade Federal do Paraná', 'Curitiba', 'PR'],
    ['7', 'Juriti Off-Road', 'UDESC', '', 'Joinville', 'SC'],
  ],
  person: [
    ['narrador', 'João Bresolin', 'Narrador', ''],
    ['juiza-seguranca', 'Carla Menezes', 'Juíza de segurança', ''],
    ['capita-42', 'Ana Souza', 'Capitã', '42'],
  ],
  sponsor: [
    ['master', 'Mineradora Serra Azul', 'master', '10'],
    ['apoio-pneus', 'Pneus Trilha', 'apoio', '2'],
  ],
  scheduleSlot: [
    ['briefing', 'Briefing das equipes', 'other', '14/11/2026 08:00', '', 'Tenda central'],
    [
      'enduro',
      'Enduro de Resistência',
      'enduro',
      '14/11/2026 10:00',
      '14/11/2026 14:00',
      'Pista principal',
    ],
  ],
};
