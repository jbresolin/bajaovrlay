// The motion demos of the sponsor rolls (BAJAOVRLAY-43): full screen and in the corner. Both
// turn through the sponsors a level at a time, each page or sponsor held by its level
// (--motion-sponsor-hold-<level>, read by motionDemoCore.js's sponsorHoldOf), so Diamante
// stays longest and the organiser, "Realização", closes the round. Each registers with
// motionDemoCore.js by the name its page carries in data-demo; motion.md describes them. The
// intermission board's sponsor line turns the same way (motionDemoBoards.js).
/* global window */
(function registerSponsorDemos() {
  const kit = window.ardosiaMotion;
  const { motion, inMs, say } = kit;
  const inSeconds = (seconds) => `${String(seconds).replace('.', ',')} s`;

  /** The head card, then the other pieces --motion-lead behind it and a row stagger apart. */
  function headThenCascade(head, pieces) {
    kit.riseIn([head]);
    kit.riseIn(pieces, { delay: motion.lead, stagger: motion.rowStagger });
  }

  // ---------------------------------------------------------------- sponsor roll, full

  kit.register('sponsor-roll', (stage, config) => {
    const board = stage.querySelector('.sponsor-roll');
    const head = board.querySelector('.board__head');
    let grid = board.querySelector('.sponsor-roll__grid');
    let pageIndex = 0;
    let stopTurning = null;
    kit.placeOffAir([head, ...grid.children]);

    // Each page is held by its sponsors' level (--motion-sponsor-hold-<level>).
    const holdOfCurrentPage = () => kit.sponsorHoldOf(config.pages[pageIndex].level);
    const startTurning = () => kit.everyWithHold(holdOfCurrentPage, turnPage);

    // The tiles lift away as the next page's tiles rise into the same places.
    function turnPage() {
      pageIndex = (pageIndex + 1) % config.pages.length;
      const page = config.pages[pageIndex];
      const incoming = kit.cloneTemplate(page.template);
      kit.swapInPlace(grid, incoming);
      grid = incoming;
      head.querySelector('.board__aside').textContent = page.aside;
      // Each page is one sponsor level, named in the head: the name changes in place.
      head.querySelector('.board__subtitle').textContent = page.subtitle;
      say(
        `página ${pageIndex + 1} (${page.subtitle}): os cartões trocam em ${inMs(motion.pageTurn)}, ${inMs(motion.pageStagger)} um do outro; fica ${inSeconds(holdOfCurrentPage())}`,
      );
    }

    const demo = kit.onAirSwitch({
      enter() {
        headThenCascade(head, [...grid.children]);
        stopTurning = startTurning();
        say(
          `entrada: a cabeça, os cartões em cascata; cada página fica o tempo do seu nível, esta ${inSeconds(holdOfCurrentPage())}`,
        );
      },
      exit() {
        stopTurning?.();
        kit.liftOut([head, ...grid.children]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
    // Atualizar: the next page now; on air, the hold starts again from it.
    demo.update = () => {
      if (!demo.isOnAir()) {
        say('use Entrar primeiro');
        return;
      }
      turnPage();
      stopTurning?.();
      stopTurning = startTurning();
    };
    return demo;
  });

  // ---------------------------------------------------------------- sponsor roll, corner

  kit.register('sponsor-roll-corner', (stage, config) => {
    const card = stage.querySelector('.sponsor-roll-corner');
    let sponsorIndex = 0;
    let stopCycling = null;
    kit.placeOffAir([card]);
    // Each sponsor is held by its level (--motion-sponsor-hold-<level>).
    const holdOfCurrentSponsor = () => kit.sponsorHoldOf(config.sponsorLevels[sponsorIndex]);
    const startCycling = () => kit.everyWithHold(holdOfCurrentSponsor, showNextSponsor);

    // The sponsor cell crossfades; the logo and the event word never move.
    function showNextSponsor() {
      sponsorIndex = (sponsorIndex + 1) % config.sponsorTemplates.length;
      const current = card.querySelector('.sponsor-roll-corner__sponsor');
      kit.crossfade(current, kit.cloneTemplate(config.sponsorTemplates[sponsorIndex]));
      say(
        `patrocinador ${sponsorIndex + 1}: troca com esmaecimento de ${inMs(motion.flag)}; fica ${inSeconds(holdOfCurrentSponsor())}`,
      );
    }

    const demo = kit.onAirSwitch({
      enter() {
        kit.riseIn([card]);
        stopCycling = startCycling();
        say(
          `entrada: o cartão do selo; cada patrocinador fica o tempo do seu nível, este ${inSeconds(holdOfCurrentSponsor())}`,
        );
      },
      exit() {
        stopCycling?.();
        kit.liftOut([card]);
        say(`saída: o cartão em ${inMs(motion.out)}`);
      },
    });
    // Atualizar: the next sponsor now; on air, the hold starts again from this one.
    demo.update = () => {
      showNextSponsor();
      if (!demo.isOnAir()) return;
      stopCycling?.();
      stopCycling = startCycling();
    };
    return demo;
  });
})();
