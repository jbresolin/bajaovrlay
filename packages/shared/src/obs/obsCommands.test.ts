/**
 * OBS control's commands and macro step (packages/shared)
 *
 * What this module is for:
 *   switchObsScene puts one of OBS's scenes on Program (or on Preview in Studio Mode),
 *   sent by the control page, by a pad through the command API, and by a macro's obsScene
 *   step. The server's OBS connection reports what OBS does with recordObsState and
 *   recordObsSceneSwitchAnswer.
 *
 * What these tests prove:
 *   - A switch or a macro step that leaves the target out switches Program, as a button
 *     means.
 *   - A switch to Preview is kept as Preview, and a target OBS does not have is refused.
 *   - A step or a switch with no scene name is refused.
 *   - The connection's whole status passes, and a status with an unknown connection state
 *     is refused.
 *
 * What these tests deliberately do not cover:
 *   - Whether OBS has the scene, or is connected: the server's reducer decides
 *     (apps/server/src/modules/obs/switchObsScene.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { CommandSchema } from '../commands/command.js';
import { MacroStepSchema } from '../macros/macroStep.js';

describe('switchObsScene', () => {
  it('switches Program when the target is left out, as a button means', () => {
    // Arrange: the command a pad's "Pista" button sends, with no target.
    const commandAsSent = { type: 'switchObsScene', sceneName: 'Pista' };

    // Act: check it against the schema.
    const result = CommandSchema.parse(commandAsSent);

    // Assert: the target was filled in as Program.
    expect(result, 'a switch with no target must switch Program').toEqual({
      type: 'switchObsScene',
      sceneName: 'Pista',
      target: 'program',
    });
  });

  const switchScenarios = [
    // Studio Mode: the operator lines up the next scene on OBS's Preview.
    {
      name: 'keeps a switch of Preview as Preview',
      command: { type: 'switchObsScene', sceneName: 'Pódio', target: 'preview' },
      isAccepted: true,
    },
    // OBS has two outputs; "multiview" is not one a scene can be put on.
    {
      name: 'refuses a target OBS does not have',
      command: { type: 'switchObsScene', sceneName: 'Pódio', target: 'multiview' },
      isAccepted: false,
    },
    // An empty name would name no scene: refused before it ever reaches OBS.
    {
      name: 'refuses a switch with an empty scene name',
      command: { type: 'switchObsScene', sceneName: '' },
      isAccepted: false,
    },
  ];

  it.each(switchScenarios)('$name', ({ command, isAccepted }) => {
    // Arrange: the command of this row (in the table above).

    // Act: check it against the schema.
    const result = CommandSchema.safeParse(command);

    // Assert: accepted or refused as the row says.
    expect(result.success, `the switch must be ${isAccepted ? 'accepted' : 'refused'}`).toBe(
      isAccepted,
    );
  });
});

describe('the obsScene macro step', () => {
  it('switches Program when the target is left out', () => {
    // Arrange: the step "Pista" of the macro "Pista + torre", with no target.
    const stepAsSaved = { kind: 'obsScene', sceneName: 'Pista' };

    // Act: check it against the schema.
    const step = MacroStepSchema.parse(stepAsSaved);

    // Assert: the target was filled in as Program.
    expect(step, 'a step with no target must switch Program').toEqual({
      kind: 'obsScene',
      sceneName: 'Pista',
      target: 'program',
    });
  });

  it('refuses a step that names no scene', () => {
    // Arrange: a step saved before a scene was picked.
    const stepWithoutAScene = { kind: 'obsScene', sceneName: '' };

    // Act: check it against the schema.
    const result = MacroStepSchema.safeParse(stepWithoutAScene);

    // Assert: refused.
    expect(result.success, 'an obsScene step must name a scene').toBe(false);
  });
});

describe('recordObsState', () => {
  it('accepts the whole status of a connected OBS in Studio Mode', () => {
    // Arrange: OBS connected, "Pista" on Program and "Pódio" lined up on Preview.
    const report = {
      type: 'recordObsState',
      status: {
        connectionState: 'conectado',
        address: 'ws://127.0.0.1:4455',
        lastError: null,
        sceneNames: ['Pista', 'Box', 'Pódio'],
        programSceneName: 'Pista',
        isStudioModeOn: true,
        previewSceneName: 'Pódio',
      },
    };

    // Act: check it against the schema.
    const result = CommandSchema.safeParse(report);

    // Assert: accepted.
    expect(result.success, 'a full status of a connected OBS must pass').toBe(true);
  });

  it('refuses a connection state the page does not know', () => {
    // Arrange: a status in English, as a careless change might write it.
    const report = {
      type: 'recordObsState',
      status: {
        connectionState: 'connected',
        address: 'ws://127.0.0.1:4455',
        lastError: null,
        sceneNames: [],
        programSceneName: null,
        isStudioModeOn: false,
        previewSceneName: null,
      },
    };

    // Act: check it against the schema.
    const result = CommandSchema.safeParse(report);

    // Assert: refused.
    expect(result.success, 'only the four pt-BR connection states are known').toBe(false);
  });
});
