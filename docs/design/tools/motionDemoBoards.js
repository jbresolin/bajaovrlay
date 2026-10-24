// The motion demos of the catalogue's boards (BAJAOVRLAY-43): the standings (paged, and in
// columns), the sessions board, the intermission board, the countdown board, the bracket and
// the podium; the sponsor rolls are in motionDemoSponsors.js. Each registers with
// motionDemoCore.js by the name its page carries in data-demo; every duration, offset and
// curve comes from `motion`, read from tokens.css. motion.md describes what each one does.
/* global window, gsap, getComputedStyle */
(function registerBoardDemos() {
  const kit = window.ardosiaMotion;
  const { motion, inMs, say } = kit;
  const inSeconds = (seconds) => `${String(seconds).replace('.', ',')} s`;

  /** The head card, then the other pieces --motion-lead behind it and a row stagger apart. */
  function headThenCascade(head, pieces, delay = motion.lead) {
    kit.riseIn([head]);
    kit.riseIn(pieces, { delay, stagger: motion.rowStagger });
  }

  // ---------------------------------------------------------------- standings, paged

  kit.register('standings', (stage, config) => {
    const board = stage.querySelector('.standings');
    const head = board.querySelector('.board__head');
    const columnHead = board.querySelector('.standings-head');
    const rowsList = board.querySelector('.board__rows');
    const rows = () => [...rowsList.children];
    let pageIndex = 0;
    let stopTurning = null;
    kit.placeOffAir([head, columnHead, ...rows()]);

    // The rows of the page leave together, the next page's rows cascade in; the head stays.
    async function turnPage() {
      pageIndex = (pageIndex + 1) % config.pages.length;
      const page = config.pages[pageIndex];
      say(`página ${pageIndex + 1}: as linhas saem juntas, as novas entram em cascata`);
      await kit.liftOut(rows());
      if (!demo.isOnAir()) return;
      rowsList.replaceChildren(...kit.cloneTemplate(page.template, { all: true }));
      head.querySelector('.board__aside').textContent = page.aside;
      kit.riseIn(rows(), { stagger: motion.rowStagger });
    }

    const demo = kit.onAirSwitch({
      enter() {
        headThenCascade(head, [columnHead, ...rows()]);
        stopTurning = kit.every(motion.boardHold, turnPage);
        say(
          `entrada: a cabeça, depois as linhas ${inMs(motion.rowStagger)} uma da outra; a página vira a cada ${inSeconds(motion.boardHold)}`,
        );
      },
      exit() {
        stopTurning?.();
        kit.liftOut([head, columnHead, ...rows()]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
    return demo;
  });

  // ---------------------------------------------------------------- standings in columns

  // Each column cascades from its top, all columns at once: row n of every column enters
  // together, so the whole field fills in one sweep.
  kit.register('standings-columns', (stage) => {
    const board = stage.querySelector('.standings');
    const head = board.querySelector('.board__head');
    const columns = [...board.querySelectorAll('.board__table')].map((table) => [
      table.querySelector('.standings-head'),
      ...table.querySelectorAll('.row--standings'),
    ]);
    kit.placeOffAir([head, ...columns.flat()]);
    return kit.onAirSwitch({
      enter() {
        kit.riseIn([head]);
        columns.forEach((pieces) =>
          kit.riseIn(pieces, { delay: motion.lead, stagger: motion.rowStagger }),
        );
        say(`entrada: as três colunas descem juntas, ${inMs(motion.rowStagger)} por linha`);
      },
      exit() {
        kit.liftOut([head, ...columns.flat()]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
  });

  // ---------------------------------------------------------------- sessions board

  kit.register('sessions-board', (stage) => {
    const board = stage.querySelector('.sessions-board');
    const head = board.querySelector('.board__head');
    const rows = [...board.querySelectorAll('.session-row')];
    kit.placeOffAir([head, ...rows]);

    // A slot changing state: its state cell crossfades and its slate follows, in --motion-flag.
    function changeSlotStatus(row, status) {
      const backgroundBefore = getComputedStyle(row).backgroundColor;
      row.dataset.status = status;
      const backgroundAfter = getComputedStyle(row).backgroundColor;
      gsap.fromTo(
        row,
        { backgroundColor: backgroundBefore },
        {
          backgroundColor: backgroundAfter,
          duration: motion.flag,
          ease: motion.easeOut,
          clearProps: 'backgroundColor',
        },
      );
      kit.crossfade(
        row.querySelector('.session-row__status'),
        kit.cloneTemplate(`status-${status}`),
      );
    }

    const demo = kit.onAirSwitch({
      enter() {
        headThenCascade(head, rows);
        say(`entrada: a cabeça, depois os horários ${inMs(motion.rowStagger)} um do outro`);
      },
      exit() {
        kit.liftOut([head, ...rows]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
    // Atualizar: the slot in progress ends and the next one starts.
    demo.update = () => {
      const liveIndex = rows.findIndex((row) => row.dataset.status === 'live');
      if (liveIndex === -1) {
        say('o dia acabou: recarregue a página para recomeçar');
        return;
      }
      changeSlotStatus(rows[liveIndex], 'done');
      if (liveIndex + 1 < rows.length) changeSlotStatus(rows[liveIndex + 1], 'live');
      say(`atualização: as situações trocam com esmaecimento de ${inMs(motion.flag)}`);
    };
    return demo;
  });

  // ---------------------------------------------------------------- intermission board

  kit.register('intermission', (stage, config) => {
    const board = stage.querySelector('.intermission');
    const head = board.querySelector('.board__head');
    const bodyCards = [
      board.querySelector('.intermission__next'),
      board.querySelector('.intermission__top-head'),
    ].filter((piece) => piece !== null);
    const rows = [...board.querySelectorAll('.row--standings')];
    let sponsorLine = board.querySelector('.intermission__sponsors');
    const pieces = [head, ...bodyCards, ...rows, sponsorLine].filter((piece) => piece !== null);
    kit.startCountdown([board.querySelector('.intermission__countdown')], config.remainingSeconds);
    kit.placeOffAir(pieces);

    // The sponsor line turns through every sponsor, a level at a time, each page held by its
    // level (--motion-sponsor-hold-<level>): the heading and logos lift away as the next
    // page's rise into the same place.
    const sponsorPages = config.sponsorPages ?? [];
    let sponsorPageIndex = 0;
    let stopTurning = null;
    const holdOfCurrentPage = () => kit.sponsorHoldOf(sponsorPages[sponsorPageIndex].level);
    function turnSponsorPage() {
      sponsorPageIndex = (sponsorPageIndex + 1) % sponsorPages.length;
      const incoming = kit.cloneTemplate(sponsorPages[sponsorPageIndex].template);
      kit.swapInPlace(sponsorLine, incoming);
      sponsorLine = incoming;
      say(
        `patrocinadores, página ${sponsorPageIndex + 1}/${sponsorPages.length}: trocam em ${inMs(motion.pageTurn)}; fica ${inSeconds(holdOfCurrentPage())}`,
      );
    }

    return kit.onAirSwitch({
      enter() {
        if (sponsorPages.length > 1)
          stopTurning = kit.everyWithHold(holdOfCurrentPage, turnSponsorPage);
        kit.riseIn([head]);
        kit.riseIn(bodyCards, { delay: motion.lead });
        // The rows follow the top-five head; the sponsor line comes a lead after the last row.
        const rowsStart = motion.lead + motion.rowStagger;
        kit.riseIn(rows, { delay: rowsStart, stagger: motion.rowStagger });
        if (sponsorLine !== null) {
          const lastRowStart = rowsStart + Math.max(0, rows.length - 1) * motion.rowStagger;
          kit.riseIn([sponsorLine], { delay: lastRowStart + motion.lead });
        }
        const rowsWords = rows.length > 0 ? ', as linhas em cascata' : '';
        const sponsorWords = sponsorLine !== null ? ', os patrocinadores por último' : '';
        say(`entrada: a cabeça, os cartões ${inMs(motion.lead)} depois${rowsWords}${sponsorWords}`);
      },
      exit() {
        stopTurning?.();
        const onAir = pieces.filter((piece) => piece.isConnected);
        kit.liftOut(sponsorLine === null ? onAir : [...onAir, sponsorLine]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
  });

  // ---------------------------------------------------------------- countdown board

  kit.register('countdown-board', (stage, config) => {
    const board = stage.querySelector('.countdown-board');
    const head = board.querySelector('.board__head');
    const body = board.querySelector('.countdown-board__body');
    kit.startCountdown([board.querySelector('.countdown-board__time')], config.remainingSeconds);
    kit.placeOffAir([head, body]);
    return kit.onAirSwitch({
      enter() {
        kit.riseIn([head]);
        kit.riseIn([body], { delay: motion.lead });
        say(`entrada: a cabeça, o corpo ${inMs(motion.lead)} depois; os números mudam no lugar`);
      },
      exit() {
        kit.liftOut([head, body]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
  });

  // ---------------------------------------------------------------- bracket

  kit.register('bracket', (stage, config) => {
    const board = stage.querySelector('.bracket');
    const head = board.querySelector('.board__head');
    const subtitle = head.querySelector('.board__subtitle');
    const aside = head.querySelector('.board__aside');
    const body = board.querySelector('.bracket__body');
    const { steps } = config;
    let stepIndex = 0;
    kit.placeOffAir([head]);
    gsap.set(body, { autoAlpha: 0 });

    const visiblePieces = () => [
      ...body.querySelectorAll('.bracket-fixture, .bracket-car, .bracket__round-name, path'),
    ];
    const roundPills = (round) => [
      ...body.querySelectorAll(`.bracket__match[data-round="${round}"] .bracket-car`),
    ];
    const roundLines = (round) => [...body.querySelectorAll(`path[data-round="${round}"]`)];

    function writeHead(step) {
      if (subtitle !== null) subtitle.textContent = step.subtitle;
      aside.textContent = step.aside;
    }

    // A board step brings its whole body; the tree's body holds every round, hidden.
    function fillBody(step) {
      const templateId = step.kind === 'board' ? step.template : config.treeTemplate;
      body.replaceChildren(kit.cloneTemplate(templateId));
      gsap.set(body, { autoAlpha: 1, clearProps: 'transform' });
      kit.placeOffAir(visiblePieces());
    }

    // A board: its cards cascade in, whole. A tree round: its pills cascade top to bottom,
    // then the lines leading into it fade in; the round names come with the first round.
    function showStep(step, delay) {
      if (step.kind === 'board') {
        kit.riseIn([...body.querySelectorAll('.bracket-fixture')], {
          delay,
          stagger: motion.rowStagger,
        });
        return;
      }
      const round = step.revealsRound;
      const timeline = gsap.timeline({ delay });
      if (round === 0)
        timeline.add(kit.riseIn([...body.querySelectorAll('.bracket__round-name')]), 0);
      timeline.add(
        kit.riseIn(roundPills(round), { stagger: motion.rowStagger }),
        round === 0 ? motion.lead : 0,
      );
      const lines = roundLines(round);
      if (lines.length > 0) {
        gsap.set(lines, { y: 0 });
        timeline.fromTo(
          lines,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: motion.flag, ease: motion.easeOut },
        );
      }
    }

    const demo = kit.onAirSwitch({
      enter() {
        stepIndex = 0;
        fillBody(steps[0]);
        writeHead(steps[0]);
        kit.riseIn([head]);
        showStep(steps[0], motion.lead);
        say(`entrada: a cabeça, depois a etapa 1 de ${steps.length}; use Próximo`);
      },
      exit() {
        kit.liftOut([head, ...visiblePieces()]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });

    demo.next = async () => {
      if (!demo.isOnAir()) {
        say('use Entrar primeiro');
        return;
      }
      if (stepIndex === steps.length - 1) {
        say('última etapa: a chave está toda na tela');
        return;
      }
      const currentStep = steps[stepIndex];
      stepIndex += 1;
      const nextStep = steps[stepIndex];
      writeHead(nextStep);
      if (currentStep.kind === 'tree' && nextStep.kind === 'tree') {
        showStep(nextStep, 0);
        say(`etapa ${stepIndex + 1}: a rodada seguinte entra; o que já está na tela não se mexe`);
        return;
      }
      say(`etapa ${stepIndex + 1}: os cartões saem juntos, os da etapa seguinte entram em cascata`);
      await kit.liftOut(visiblePieces());
      if (!demo.isOnAir()) return;
      fillBody(nextStep);
      showStep(nextStep, 0);
    };
    return demo;
  });

  // ---------------------------------------------------------------- podium

  kit.register('podium', (stage) => {
    const board = stage.querySelector('.podium');
    const head = board.querySelector('.board__head');
    // Revealed 3rd, 2nd, 1st, whatever their order on screen.
    const places = [3, 2, 1].map((position) => board.querySelector(`.podium-place--${position}`));
    let revealedCount = 0;
    kit.placeOffAir([head]);
    kit.placeOffAir(places, motion.podiumOffset);

    const demo = kit.onAirSwitch({
      enter() {
        revealedCount = 0;
        kit.placeOffAir(places, motion.podiumOffset);
        kit.riseIn([head]);
        say('entrada: só a cabeça; use Próximo para o 3º, o 2º e o 1º');
      },
      exit() {
        kit.liftOut([head, ...places.slice(0, revealedCount)]);
        say(`saída: tudo junto em ${inMs(motion.out)}`);
      },
    });
    demo.next = () => {
      if (!demo.isOnAir()) {
        say('use Entrar primeiro');
        return;
      }
      if (revealedCount === places.length) {
        say('o pódio está completo');
        return;
      }
      kit.riseIn([places[revealedCount]], { offset: motion.podiumOffset });
      revealedCount += 1;
      say(
        `${4 - revealedCount}º lugar: o cartão sobe ${motion.podiumOffset} px em ${inMs(motion.in)}; os outros não se mexem`,
      );
    };
    return demo;
  });
})();
