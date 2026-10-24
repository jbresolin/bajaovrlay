/**
 * The lower third web component: load, play, update, stop and dispose
 * (packages/graphics/lower-third)
 *
 * What this module is for:
 *   lower-third.ts is the OGraf graphic itself: a web component the renderer loads,
 *   plays, updates, stops and disposes. It wires the model, the view and the animations
 *   together; each of those has its own tests.
 *
 * What these tests prove:
 *   - load draws the data off air and answers 200; bad data answers 400 naming the field.
 *   - Calls made at the wrong moment (play or update before load, a second load, anything
 *     after dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - play brings both pills on air and reports step 0, and they stay there; play while
 *     on air takes them off (OGraf's "past the last step" rule); stop takes them off.
 *   - updateAction merges partial data on air or off and changes the text in place: a
 *     new role on air, a role pill appearing when a role arrives, the role pill going when
 *     the role and team line are cleared; a bad update answers 400 and changes nothing.
 *   - dispose ends a running play-in: the pending play resolves with 409 instead of
 *     hanging, and a dispose that lands while load is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts and timing; jsdom draws nothing and has no `document.fonts`,
 *     so load's wait for the theme's font ends at once, and no theme token is on the
 *     page, so every timeline lasts 0 ms (the theme's rule for a missing token). The
 *     Playwright suites in e2e/ run the built component in Chromium for the lifecycle,
 *     the motion and the screenshots.
 *   - Which parts each combination of fields shows; lowerThirdView.test.ts covers that.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createLowerThirdOnThePage,
  createNarratorData,
  createTeamCaptainData,
  findPartOfLowerThird,
  loadLowerThirdWithData,
  readPillOpacities,
  readShownText,
} from './lowerThirdOnThePage.testSupport.js';

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'A tarja já foi descartada (dispose).',
};

describe('load', () => {
  it('draws the data off air and answers 200', async () => {
    // Arrange: a lower third on the page, never loaded.
    const lowerThird = createLowerThirdOnThePage();

    // Act: load it with the team captain.
    const answer = await loadLowerThirdWithData(lowerThird, createTeamCaptainData());

    // Assert: 200, the name and role are drawn, and both pills wait invisible for play.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(lowerThird, 'lower-third-name-pill'), 'the name must be drawn').toBe(
      'Mariana Costa',
    );
    expect(readShownText(lowerThird, 'lower-third-role'), 'the role must be drawn').toBe(
      'Capitã da equipe',
    );
    expect(readPillOpacities(lowerThird), 'a loaded lower third must stay off screen').toEqual([
      '0',
      '0',
    ]);
  });

  it('answers 400 with a pt-BR message naming the missing name', async () => {
    // Arrange: a lower third and data with a role but no name.
    const lowerThird = createLowerThirdOnThePage();

    // Act: load it with that data.
    const answer = await loadLowerThirdWithData(lowerThird, { role: 'Narradora' });

    // Assert: a 400 naming the field.
    expect(answer, 'load without a name must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "name".',
    });
  });
});

describe('calls made at the wrong moment', () => {
  const callsBeforeLoad = [
    // A renderer that skipped load and played straight away.
    { name: 'answers 409 to playAction before load', call: 'play' },
    // An update that arrives before the renderer has loaded the lower third.
    { name: 'answers 409 to updateAction before load', call: 'update' },
  ] as const;

  it.each(callsBeforeLoad)('$name', async ({ call }) => {
    // Arrange: a lower third on the page that was never loaded.
    const lowerThird = createLowerThirdOnThePage();

    // Act: play it, or send it a new role.
    const answer =
      call === 'play'
        ? await lowerThird.playAction({})
        : await lowerThird.updateAction({ data: { role: 'Piloto' } });

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'a call before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A tarja ainda não foi carregada (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded lower third that was never played.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createNarratorData());

    // Act: ask it to stop.
    const answer = await lowerThird.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded lower third is never half reset', async () => {
    // Arrange: a lower third already loaded with the narrator.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createNarratorData());

    // Act: load it again with the team captain.
    const answer = await loadLowerThirdWithData(lowerThird, createTeamCaptainData());

    // Assert: a 409, and the narrator is still the one drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A tarja já foi carregada (load); crie outra para novos dados.',
    });
    expect(
      readShownText(lowerThird, 'lower-third-name-pill'),
      'a refused second load must leave the first data drawn',
    ).toBe('Ana Paula Ribeiro');
  });

  it('answers 404 to any customAction, because the lower third has none', async () => {
    // Arrange: a lower third on air.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createNarratorData());
    await lowerThird.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await lowerThird.customAction({ id: 'trocar-pessoa', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "trocar-pessoa". A tarja não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a lower third that was loaded, played and then disposed.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createNarratorData());
    await lowerThird.playAction({ skipAnimation: true });
    await lowerThird.dispose();

    // Act: try to play it and to change its role.
    const playAnswer = await lowerThird.playAction({ skipAnimation: true });
    const updateAnswer = await lowerThird.updateAction({ data: { role: 'Comentarista' } });

    // Assert: both answer "already disposed".
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('brings both pills on air at step 0 and keeps them there until stopped', async () => {
    // Arrange: a loaded team captain.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createTeamCaptainData());

    // Act: play it, and let a moment pass with no stop.
    const answer = await lowerThird.playAction({ skipAnimation: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Assert: step 0 is on air, and both pills are still visible.
    expect(answer, 'play must answer 200 with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
    expect(readPillOpacities(lowerThird), 'both pills must stay on air until stopped').toEqual([
      '1',
      '1',
    ]);
  });

  it('takes both pills off air on stopAction', async () => {
    // Arrange: a lower third on air.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createTeamCaptainData());
    await lowerThird.playAction({ skipAnimation: true });

    // Act: the operator stops it.
    const answer = await lowerThird.stopAction({ skipAnimation: true });

    // Assert: 200, and both pills are invisible.
    expect(answer, 'stop must answer 200').toEqual({ statusCode: 200 });
    expect(readPillOpacities(lowerThird), 'both pills must be off screen once stopped').toEqual([
      '0',
      '0',
    ]);
  });

  it('takes the pills off air when playAction comes while they are already on air', async () => {
    // Arrange: a lower third on air at its only step, step 0.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createNarratorData());
    await lowerThird.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await lowerThird.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the pills have gone invisible.
    expect(answer, 'playing past the last step must take the lower third off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPillOpacities(lowerThird), 'the pills must be off screen once taken off').toEqual([
      '0',
      '0',
    ]);
  });
});

describe('updateAction', () => {
  it('changes the role on air in place and keeps the name and the team line', async () => {
    // Arrange: the team captain on air, and the role element as it is now.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createTeamCaptainData());
    await lowerThird.playAction({ skipAnimation: true });
    const roleElementBefore = findPartOfLowerThird(lowerThird, 'lower-third-role');

    // Act: the operator corrects her role; only the role is sent.
    const answer = await lowerThird.updateAction({ data: { role: 'Piloto' } });

    // Assert: 200, the new role is in the same element, the rest unchanged and on air.
    expect(answer, 'a good update must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(lowerThird, 'lower-third-role'), 'the new role must show').toBe('Piloto');
    expect(
      findPartOfLowerThird(lowerThird, 'lower-third-role'),
      'the role must be rewritten in place, not rebuilt',
    ).toBe(roleElementBefore);
    expect(
      readShownText(lowerThird, 'lower-third-team-line'),
      'the team line must survive a partial update',
    ).toBe('Baja UFMG · UFMG');
    expect(readPillOpacities(lowerThird), 'an update must not take anything off air').toEqual([
      '1',
      '1',
    ]);
  });

  it('shows the role pill on air when a role arrives for a name-only lower third', async () => {
    // Arrange: a guest on air with nothing but a name.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, { name: 'Ana Paula Ribeiro' });
    await lowerThird.playAction({ skipAnimation: true });

    // Act: the operator fills in her role.
    await lowerThird.updateAction({ data: { role: 'Narradora' } });

    // Assert: the role pill is shown, with the role, already fully visible.
    const rolePill = findPartOfLowerThird(lowerThird, 'lower-third-role-pill');
    expect(rolePill?.hidden, 'the role pill must appear once there is a role').toBe(false);
    expect(readShownText(lowerThird, 'lower-third-role'), 'the role must show').toBe('Narradora');
    expect(rolePill?.style.opacity, 'the role pill must already be on air with the name').toBe('1');
  });

  it('hides the role pill when the renderer clears the role and the team line', async () => {
    // Arrange: the team captain on air.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createTeamCaptainData());
    await lowerThird.playAction({ skipAnimation: true });

    // Act: the operator empties both fields; the renderer sends them as undefined.
    const answer = await lowerThird.updateAction({
      data: { role: undefined, teamLine: undefined },
    });

    // Assert: 200, and the name pill stands alone.
    expect(answer, 'clearing optional fields must answer 200').toEqual({ statusCode: 200 });
    expect(
      findPartOfLowerThird(lowerThird, 'lower-third-role-pill')?.hidden,
      'with no role and no team line the role pill must go',
    ).toBe(true);
  });

  it('answers 400 to a bad update and keeps showing the previous data', async () => {
    // Arrange: the narrator on air.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createNarratorData());
    await lowerThird.playAction({ skipAnimation: true });

    // Act: send an update whose name is only blanks.
    const answer = await lowerThird.updateAction({ data: { name: '   ' } });

    // Assert: a 400 naming the field, and the narrator's name is still shown.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "name".',
    });
    expect(
      readShownText(lowerThird, 'lower-third-name-pill'),
      'a refused update must leave the name on air',
    ).toBe('Ana Paula Ribeiro');
  });
});

describe('dispose', () => {
  it('kills a running play-in and answers the pending play with 409, because it was disposed', async () => {
    // Arrange: a loaded lower third whose play-in is still running when dispose comes. A
    // 400 ms in is placed on the name pill itself, so the animation really takes time.
    const lowerThird = createLowerThirdOnThePage();
    await loadLowerThirdWithData(lowerThird, createTeamCaptainData());
    const namePill = findPartOfLowerThird(lowerThird, 'lower-third-name-pill');
    namePill?.style.setProperty('--motion-in', '400ms');
    const pendingPlay = lowerThird.playAction({});

    // Act: dispose in the middle of the animation.
    await lowerThird.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(
      playAnswer,
      'a play cut short by dispose must resolve with 409 (already disposed), never hang',
    ).toEqual(alreadyDisposedAnswer);
    expect(gsap.getTweensOf(namePill ?? []), 'dispose must kill every tween on the pills').toEqual(
      [],
    );
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a lower third whose load has started but not yet finished (it waits for
    // the first render and the font).
    const lowerThird = createLowerThirdOnThePage();
    const pendingLoad = loadLowerThirdWithData(lowerThird, createNarratorData());

    // Act: dispose before load finishes, then let load finish and try to play.
    await lowerThird.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await lowerThird.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
