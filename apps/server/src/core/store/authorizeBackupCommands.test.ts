/**
 * Who may record a backup (apps/server)
 *
 * What this module is for:
 *   The authorisation step decides by the actor's role (authorizeCommand.ts). The backup
 *   download (`sistema:backup`, BAJAOVRLAY-33) records a zip once it went out whole, and
 *   nobody else may: a page that could send recordBackup would show "Última cópia" for a
 *   copy that was never made, and the operator would go home without one.
 *
 * What these tests prove:
 *   - sistema:backup may send recordBackup and nothing else (not a take, not a clear).
 *   - An operator, a device of the command API, another server actor and a renderer may
 *     not send recordBackup.
 *
 * What these tests deliberately do not cover:
 *   - What recordBackup does to the event log: backupDownloadRoute.test.ts.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';
import { backupActor, mediaStoreActor } from './commandActors.js';

const backupAt1432: Command = {
  type: 'recordBackup',
  fileName: 'bajaovrlay-2026-11-14-1432.zip',
  sizeInBytes: 50_331_648,
  includesRecordings: true,
};
const takeTheClock: Command = { type: 'takeItem', itemId: 'item-relogio' };
const clearTheClockLayer: Command = { type: 'clearLayer', layerId: 'relogio' };

describe('allowCommandForActorRole, recordBackup', () => {
  const decisions = [
    // The backup's own record of a zip it sent whole.
    {
      name: 'lets the backup record a backup',
      command: backupAt1432,
      actor: backupActor,
      isAllowed: true,
    },
    // The backup reads the data; it never puts anything on air.
    {
      name: 'stops the backup taking an item',
      command: takeTheClock,
      actor: backupActor,
      isAllowed: false,
    },
    // Nor may it clear a layer, which every other `sistema:` timer may.
    {
      name: 'stops the backup clearing a layer',
      command: clearTheClockLayer,
      actor: backupActor,
      isAllowed: false,
    },
    // A page could claim a copy that was never made.
    {
      name: 'stops an operator recording a backup',
      command: backupAt1432,
      actor: 'operador:tablet',
      isAllowed: false,
    },
    // Companion stands where an operator stands.
    {
      name: 'stops a device of the command API recording a backup',
      command: backupAt1432,
      actor: 'api:companion',
      isAllowed: false,
    },
    // Each server actor keeps to its own job.
    {
      name: 'stops the media store recording a backup',
      command: backupAt1432,
      actor: mediaStoreActor,
      isAllowed: false,
    },
    // Screens send nothing but their reports.
    {
      name: 'stops a renderer recording a backup',
      command: backupAt1432,
      actor: 'renderer:obs',
      isAllowed: false,
    },
  ];

  it.each(decisions)('$name', ({ command, actor, isAllowed }) => {
    // Arrange: the command and the actor of this row.

    // Act: ask the authorisation step.
    const decision = allowCommandForActorRole(command, actor);

    // Assert: the decision of this row.
    expect(decision, `${actor} sending ${command.type}`).toBe(isAllowed);
  });
});
