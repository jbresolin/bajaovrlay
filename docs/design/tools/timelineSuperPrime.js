// The Super Prime timeline (BAJAOVRLAY-43): the real bracket (super_prime.md) stepped through
// match by match, from the draw (the byes already through by W.O.) to the final, the
// third-place match just before it. The view follows the match being decided: the round
// boards (32 avos, 16 avos, oitavas), then the tree. Each view is drawn fully decided by the
// generator; at a step, a slot whose car is not known yet reads "A DEFINIR" (dashed, like a
// bye's), a match not run yet shows "—" for both cars, and the match just decided is outlined
// for --motion-cue-hold while its result fades in (--motion-flag). A change of view turns the
// page: the old pieces lift out, the new cascade in.
/* global window, document, gsap */
(function registerSuperPrimeTimeline() {
  const kit = window.ardosiaMotion;
  const { motion, say } = kit;
  const toBeDecidedWords = 'A DEFINIR';

  kit.register('super-prime-timeline', (stage, config) => {
    const board = stage.querySelector('.bracket');
    const head = board.querySelector('.board__head');
    const subtitle = head.querySelector('.board__subtitle');
    const aside = head.querySelector('.board__aside');
    const body = board.querySelector('.bracket__body');
    const slider = document.getElementById('timeline-slider');
    const stepLabel = document.getElementById('timeline-time');
    const matchesById = new Map(config.matches.map((match) => [match.id, match]));
    const viewsById = new Map(config.views.map((view) => [view.id, view]));
    const lastStep = config.steps.length - 1;
    const originals = new WeakMap();
    let stepIndex = 0;
    let currentViewId = null;
    let isOnAir = false;
    let latestOutline = null;

    slider.min = '0';
    slider.max = String(lastStep);
    slider.step = '1';

    const decidedBy = (index) => {
      const decided = new Set(
        config.matches.filter((match) => match.isBye).map((match) => match.id),
      );
      config.steps.slice(1, index + 1).forEach((step) => decided.add(step.matchId));
      return decided;
    };
    const viewOfStep = (index) => {
      const matchId = config.steps[index].matchId;
      return matchId === null ? config.views[0].id : matchesById.get(matchId).view;
    };
    const viewPieces = () => [
      ...body.querySelectorAll('.bracket-fixture, .bracket__round-name, .bracket-car, path'),
    ];

    function mountView(viewId) {
      const view = viewsById.get(viewId);
      body.replaceChildren(kit.cloneTemplate(view.template));
      currentViewId = viewId;
      if (subtitle !== null) subtitle.textContent = view.subtitle;
      body.querySelectorAll('[data-slot]').forEach((slot) => {
        originals.set(slot, {
          html: slot.innerHTML,
          className: slot.className,
          isWinner: slot.hasAttribute('data-winner'),
          isLoser: slot.hasAttribute('data-loser'),
        });
      });
    }

    const emptyClassOf = (className) =>
      className.includes('bracket-car')
        ? 'bracket-car bracket-car--empty'
        : `${className} bracket-fixture__side--empty`;

    // Each slot is unknown (its car comes from a match not decided yet), pending (its car is
    // known, its match not run) or decided; only a slot whose state changed is redrawn.
    function applyState(decided, latestMatchId, animate) {
      body.querySelectorAll('[data-match]').forEach((matchElement) => {
        const match = matchesById.get(matchElement.dataset.match);
        const isDecided = decided.has(match.id);
        matchElement.querySelectorAll('[data-slot]').forEach((slot) => {
          const original = originals.get(slot);
          const source = match.sources[slot.dataset.slot];
          const isKnown = source === null || decided.has(source.matchId);
          let state = 'pending';
          if (!isKnown) state = 'unknown';
          else if (isDecided) state = 'decided';
          if (slot.dataset.state === state) return;
          const wasDrawn = slot.dataset.state !== undefined;
          slot.dataset.state = state;
          slot.removeAttribute('data-winner');
          slot.removeAttribute('data-loser');
          if (state === 'unknown') {
            slot.className = emptyClassOf(original.className);
            slot.innerHTML = `<span class="bracket-empty">${toBeDecidedWords}</span>`;
          } else {
            slot.className = original.className;
            slot.innerHTML = original.html;
            if (state === 'decided' && original.isWinner) slot.setAttribute('data-winner', '');
            if (state === 'decided' && original.isLoser) slot.setAttribute('data-loser', '');
            const result = slot.querySelector('.bracket-car__result');
            if (state === 'pending' && result !== null) result.textContent = '—';
          }
          if (animate && wasDrawn) kit.riseIn([slot], { offset: 0 });
        });
      });
      latestOutline?.kill();
      body
        .querySelectorAll('.is-latest')
        .forEach((element) => element.classList.remove('is-latest'));
      const latest =
        latestMatchId === null ? null : body.querySelector(`[data-match="${latestMatchId}"]`);
      if (latest !== null) {
        latest.classList.add('is-latest');
        latestOutline = gsap.delayedCall(motion.cueHold, () =>
          latest.classList.remove('is-latest'),
        );
      }
    }

    async function goTo(index, { animate }) {
      stepIndex = Math.min(lastStep, Math.max(0, index));
      const step = config.steps[stepIndex];
      const decided = decidedBy(stepIndex);
      const targetViewId = viewOfStep(stepIndex);
      slider.value = String(stepIndex);
      stepLabel.textContent = `${stepIndex}/${lastStep}`;
      aside.textContent = `${stepIndex}/${lastStep}`;
      say(step.words);
      if (targetViewId === currentViewId) {
        applyState(decided, step.matchId, animate);
        return;
      }
      if (animate && isOnAir && currentViewId !== null) await kit.liftOut(viewPieces());
      mountView(targetViewId);
      applyState(decided, step.matchId, false);
      if (isOnAir) kit.riseIn(viewPieces(), { stagger: motion.pageStagger });
      else kit.placeOffAir(viewPieces());
    }

    slider.addEventListener('input', () => goTo(Number(slider.value), { animate: false }));
    kit.placeOffAir([head]);
    goTo(0, { animate: false });

    return {
      ready: 'pronto: use Entrar, depois Próximo (ou arraste a linha do tempo) jogo a jogo',
      enter() {
        if (isOnAir) return say('já está no ar: use Sair primeiro');
        isOnAir = true;
        kit.riseIn([head]);
        kit.riseIn(viewPieces(), { delay: motion.lead, stagger: motion.pageStagger });
        say(`entrada: a cabeça, os jogos ${kit.inMs(motion.lead)} depois, em cascata; use Próximo`);
      },
      exit() {
        if (!isOnAir) return say('não está no ar: use Entrar');
        isOnAir = false;
        kit.liftOut([head, ...viewPieces()]);
        say(`saída: tudo junto em ${kit.inMs(motion.out)}`);
      },
      start() {
        goTo(0, { animate: true });
      },
      previous() {
        goTo(stepIndex - 1, { animate: true });
      },
      next() {
        if (stepIndex === lastStep) return say('fim: a final foi decidida');
        goTo(stepIndex + 1, { animate: true });
      },
      end() {
        goTo(lastStep, { animate: true });
      },
    };
  });
})();
