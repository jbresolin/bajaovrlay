// @vitest-environment node
/**
 * Every graphic's car groups (packages/graphics/kit)
 *
 * What this module is for:
 *   A graphic whose fields describe one car declares them as a car group in its manifest
 *   (`v_baja.carGroups`, BAJAOVRLAY-66), so the item editor fills them by choosing the car
 *   once. A group the shared check refuses is dropped at boot and the editor shows the
 *   fields one by one again, so a mistake would only be seen on the control page.
 *
 * What these tests prove:
 *   - Every manifest under packages/graphics passes the shared check of its car groups.
 *   - The graphics with per-car fields are exactly the battle card (the car ahead and the
 *     car right behind it, the gap with the car behind), the notice and the team card (one
 *     car each), and each group fills the fields it should.
 *
 * What these tests deliberately do not cover:
 *   - The check's refusals one by one; carGroupsOfManifest.test.ts in packages/shared.
 *   - The picker; ItemEditorPanelCarGroups.test.tsx in apps/control.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCarGroupsOfManifest } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

const graphicsFolder = fileURLToPath(new URL('../../', import.meta.url));

/** Every `<folder>/<name>.ograf.json` under packages/graphics, with the folder's name. */
function listEveryGraphicManifest(): Array<{ folderName: string; manifest: unknown }> {
  const manifests: Array<{ folderName: string; manifest: unknown }> = [];
  for (const folderEntry of readdirSync(graphicsFolder, { withFileTypes: true })) {
    if (!folderEntry.isDirectory()) {
      continue;
    }
    const folderPath = join(graphicsFolder, folderEntry.name);
    for (const fileName of readdirSync(folderPath)) {
      if (fileName.endsWith('.ograf.json')) {
        const manifest: unknown = JSON.parse(readFileSync(join(folderPath, fileName), 'utf8'));
        manifests.push({ folderName: folderEntry.name, manifest });
      }
    }
  }
  return manifests.sort((first, second) => first.folderName.localeCompare(second.folderName));
}

describe('the car groups of every manifest', () => {
  it('passes the shared check for every graphic', () => {
    // Arrange: every manifest on disk.
    const manifests = listEveryGraphicManifest();

    // Act: read each one's car groups.
    const refusedGraphics = manifests
      .map(({ folderName, manifest }) => ({
        folderName,
        reading: readCarGroupsOfManifest(manifest),
      }))
      .filter(({ reading }) => reading.status === 'refused');

    // Assert: none refused; on failure the message lists each graphic's problems.
    expect(refusedGraphics, 'no manifest may declare a car group the check refuses').toEqual([]);
  });

  it('groups the fields of one car in the battle card, the notice and the team card only', () => {
    // Arrange: every manifest on disk.
    const manifests = listEveryGraphicManifest();

    // Act: keep each graphic that declares groups, with each group's id, label and fields.
    const groupsOfEachGraphic: Record<string, unknown> = {};
    for (const { folderName, manifest } of manifests) {
      const reading = readCarGroupsOfManifest(manifest);
      if (reading.status === 'groups') {
        groupsOfEachGraphic[folderName] = reading.carGroups;
      }
    }

    // Assert: these three, each group filling exactly these fields.
    expect(groupsOfEachGraphic, 'the per-car fields must be grouped as listed').toEqual({
      'battle-card': [
        {
          id: 'ahead',
          label: 'Carro da frente',
          fields: {
            aheadPosition: 'position',
            aheadCarNumber: 'carNumber',
            aheadTeamName: 'teamName',
            aheadSchoolName: 'schoolName',
            aheadLaps: 'laps',
          },
        },
        {
          id: 'behind',
          label: 'Carro de trás',
          rightBehindGroup: 'ahead',
          fields: {
            behindPosition: 'position',
            behindCarNumber: 'carNumber',
            behindTeamName: 'teamName',
            behindSchoolName: 'schoolName',
            behindLaps: 'laps',
            gapMs: 'intervalMs',
          },
        },
      ],
      notice: [
        {
          id: 'car',
          label: 'Carro',
          fields: { carNumber: 'carNumber', teamName: 'teamName', schoolName: 'schoolName' },
        },
      ],
      'team-card': [
        {
          id: 'car',
          label: 'Carro',
          fields: { carNumber: 'carNumber', teamName: 'teamName', schoolName: 'schoolName' },
        },
      ],
    });
  });
});
