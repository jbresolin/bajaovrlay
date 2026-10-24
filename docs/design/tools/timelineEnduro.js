// The enduro timeline (BAJAOVRLAY-43): the real race (enduro_passes.xlsx) replayed on the
// race clock, the tower (compact or detailed) and the fastest-lap notice, at any moment the
// operator picks: the slider scrubs, the buttons step a pass or a minute, Play runs the race
// at 1×, 10× or 60×. Every number comes from enduroTiming.js, the same rules that wrote the
// static pages, and every move from motionDemoCore.js, so the motion is the tower's own: a
// car that changes place slides there (--motion-swap) with its ▲ or ▼ held --motion-cue-hold,
// laps and times change in place, a flag change crossfades, a new fastest lap rises into the
// notice slot and leaves after --motion-notice-hold. Scrubbing jumps without motion.
/* global window, document, gsap, requestAnimationFrame, performance */
(function registerEnduroTimeline() {
  const kit = window.ardosiaMotion;
  const timing = window.enduroTiming;
  const { motion, say } = kit;
  const cueUp =
    '<svg class="cue" viewBox="0 0 14 10" aria-hidden="true"><path d="M7 0 14 10H0Z" fill="currentColor"/></svg>';
  const cueDown =
    '<svg class="cue" viewBox="0 0 14 10" aria-hidden="true"><path d="M0 0h14L7 10Z" fill="currentColor"/></svg>';
  const speeds = [1, 10, 60];
  // A move this short or shorter animates (a step, a frame of Play); a longer one jumps.
  const longestAnimatedMoveMs = 60 * 1000;

  kit.register('enduro-timeline', (stage, config) => {
    const clock = stage.querySelector('.race-clock');
    const towers = {
      compact: stage.querySelector('.tower--compact'),
      detailed: stage.querySelector('.tower--detailed'),
    };
    const notice = stage.querySelector('.fastest-lap');
    const slider = document.getElementById('timeline-slider');
    const timeLabel = document.getElementById('timeline-time');
    const crossingMoments = [...new Set(config.passes.map((pass) => pass[2]))].sort(
      (first, second) => first - second,
    );
    const firstMs = config.startMs;
    const lastMs = config.lastCrossingMs;
    let currentMs = config.startMs;
    let view = 'compact';
    let pageIndex = 0;
    let isOnAir = false;
    let previousPositionByCar = new Map();
    let isPlaying = false;
    let speedIndex = 0;
    let noticeExit = null;

    slider.min = String(firstMs);
    slider.max = String(lastMs);
    slider.step = '1000';
    towers.detailed.classList.add('is-hidden-view');
    kit.placeOffAir([clock, notice, towers.compact, towers.detailed]);

    // ---------------------------------------------------------------- drawing one moment

    function writeClock(session) {
      clock.querySelector('.race-clock__time').textContent = timing.formatRemainingClock(
        session.remainingMs,
      );
      clock.querySelector('.race-clock__laps').textContent = timing.writeLapsLabel(
        session.lapsCompletedByLeader,
      );
      const band = clock.querySelector('.race-clock__flag');
      if (band.dataset.flag === session.flag) return;
      const incoming = kit.cloneTemplate(`band-${session.flag}`);
      if (isOnAir) kit.crossfade(band, incoming);
      else band.replaceWith(incoming);
    }

    function writeRow(row, entry) {
      row.querySelector('.row__pos').textContent = entry.position;
      row.querySelector('.row__laps').textContent = entry.laps;
      row.toggleAttribute('data-leader', entry.position === 1);
      const cells = {
        '.row__gap': timing.formatGapToLeader(entry).replace(/ s$/, ''),
        '.row__interval': timing.formatInterval(entry).replace(/ s$/, ''),
        '.row__last-lap': timing.formatLapTimeOnAir(entry.lastLapMs) || '—',
        '.row__best-lap': timing.formatLapTimeOnAir(entry.bestLapMs) || '—',
      };
      Object.entries(cells).forEach(([selector, text]) => {
        const cell = row.querySelector(selector);
        if (cell !== null) cell.textContent = text;
      });
    }

    // A row's ▲ / ▼ and coloured position cell, held --motion-cue-hold; a newer change on the
    // same row restarts its hold.
    const cueClearingByRow = new Map();
    function showCue(row, isUp) {
      row.classList.remove('is-up', 'is-down');
      row.classList.add(isUp ? 'is-up' : 'is-down');
      row.querySelector('.row__cue').innerHTML = isUp ? cueUp : cueDown;
      cueClearingByRow.get(row)?.kill();
      cueClearingByRow.set(
        row,
        gsap.delayedCall(motion.cueHold, () => {
          row.classList.remove('is-up', 'is-down');
          row.querySelector('.row__cue').innerHTML = '';
        }),
      );
    }

    // The rows are one per car, keyed by number (data-car), never rebuilt: a new order moves
    // them; only the page's rows show. With `animate`, each row slides from where it was to
    // its new place (FLIP) and a row arriving on the page rises in. Every place is read
    // before any row is hidden (hiding one moves the rows under it up), and as offsetTop,
    // the row's place in the layout, not on screen, where a row still sliding carries its
    // slide's offset.
    function placeRows(tower, positions, animate) {
      const list = tower.querySelector('.tower__rows');
      const rowsByCar = new Map([...list.children].map((row) => [Number(row.dataset.car), row]));
      const topBefore = new Map();
      rowsByCar.forEach((row) => {
        if (!row.classList.contains('is-off-page')) topBefore.set(row, row.offsetTop);
      });
      // A car that has not crossed the line yet is not in the order: it stays off the tower.
      rowsByCar.forEach((row) => row.classList.add('is-off-page'));
      positions.forEach((entry, index) => {
        const row = rowsByCar.get(entry.carNumber);
        list.appendChild(row);
        writeRow(row, entry);
        row.classList.toggle('is-off-page', Math.floor(index / config.rowsPerPage) !== pageIndex);
      });
      if (!animate) return;
      positions.forEach((entry) => {
        const row = rowsByCar.get(entry.carNumber);
        if (row.classList.contains('is-off-page')) return;
        const previousPosition = previousPositionByCar.get(entry.carNumber);
        if (previousPosition !== undefined && previousPosition !== entry.position)
          showCue(row, entry.position < previousPosition);
        const before = topBefore.get(row);
        if (before === undefined) {
          kit.riseIn([row]);
          return;
        }
        // A row already sliding continues from where it is on screen now.
        const shift = before - row.offsetTop;
        if (shift === 0) return;
        const slideOffsetNow = Number(gsap.getProperty(row, 'y')) || 0;
        gsap.fromTo(
          row,
          { y: shift + slideOffsetNow },
          { y: 0, duration: motion.swap, ease: motion.easeInOut },
        );
      });
    }

    function showFastestLap(event) {
      const team = config.teams[event.carNumber];
      notice.querySelector('.chip').textContent = event.carNumber;
      notice.querySelector('.notice__team-name').textContent = team.teamName;
      notice.querySelector('.notice__school').textContent = team.schoolName;
      notice.querySelector('.notice__time').textContent = timing.formatLapTimeOnAir(
        event.lapTimeMs,
      );
      notice.querySelector('.notice__head .caption').textContent = `VOLTA ${event.lap}`;
      if (!isOnAir) return;
      kit.riseIn([notice]);
      noticeExit?.kill();
      noticeExit = gsap.delayedCall(motion.noticeHold, () => kit.liftOut([notice]));
    }

    function drawMoment(toMs, { animate }) {
      const fromMs = currentMs;
      currentMs = Math.min(lastMs, Math.max(firstMs, toMs));
      const positions = timing.positionsAt(config.passes, currentMs);
      const session = timing.sessionAt(config.passes, currentMs, config.startMs, config.durationMs);
      writeClock(session);
      placeRows(towers.compact, positions, animate);
      placeRows(towers.detailed, positions, animate);
      previousPositionByCar = new Map(positions.map((entry) => [entry.carNumber, entry.position]));
      const newFastestLap = config.fastestLapEvents
        .filter((event) => event.crossedAtMs > fromMs && event.crossedAtMs <= currentMs)
        .at(-1);
      if (animate && newFastestLap !== undefined) showFastestLap(newFastestLap);
      slider.value = String(currentMs);
      timeLabel.textContent = timing.formatTimeOfDay(currentMs);
      const leader = positions[0];
      const leaderWords =
        leader === undefined
          ? 'ninguém cruzou a linha ainda'
          : `líder ${leader.carNumber} ${config.teams[leader.carNumber].teamShortName}, ${leader.laps} voltas`;
      const fastestLapWords =
        newFastestLap !== undefined && animate
          ? ` · melhor volta: ${newFastestLap.carNumber}, ${timing.formatLapTimeOnAir(newFastestLap.lapTimeMs)}`
          : '';
      say(
        `faltam ${timing.formatRemainingClock(session.remainingMs)} · ${leaderWords} · ${positions.length} carros${fastestLapWords}`,
      );
    }

    function moveBy(deltaMs) {
      drawMoment(currentMs + deltaMs, { animate: Math.abs(deltaMs) <= longestAnimatedMoveMs });
    }

    // ---------------------------------------------------------------- playing

    let lastFrameAt = 0;
    function playFrame(now) {
      if (!isPlaying) return;
      const elapsedMs = (now - lastFrameAt) * speeds[speedIndex];
      lastFrameAt = now;
      drawMoment(currentMs + elapsedMs, { animate: true });
      if (currentMs >= lastMs) {
        isPlaying = false;
        document.querySelector('[data-action="playPause"]').textContent = 'Play';
        return;
      }
      requestAnimationFrame(playFrame);
    }

    slider.addEventListener('input', () => {
      drawMoment(Number(slider.value), { animate: false });
    });

    drawMoment(config.startMs, { animate: false });
    const visibleTower = () => towers[view];

    return {
      ready: 'pronto: use Entrar, depois arraste a linha do tempo, os passos ou Play',
      enter() {
        if (isOnAir) return say('já está no ar: use Sair primeiro');
        isOnAir = true;
        kit.riseIn([clock]);
        const tower = visibleTower();
        gsap.set(tower, { autoAlpha: 1, y: 0 });
        const pieces = [
          tower.querySelector('.tower__head'),
          ...tower.querySelectorAll('.row:not(.is-off-page)'),
        ];
        kit.riseIn(pieces, { delay: motion.lead, stagger: motion.rowStagger });
        say(
          `entrada: o relógio, a torre ${kit.inMs(motion.lead)} depois, as linhas ${kit.inMs(motion.rowStagger)} uma da outra`,
        );
      },
      exit() {
        if (!isOnAir) return say('não está no ar: use Entrar');
        isOnAir = false;
        noticeExit?.kill();
        kit.liftOut([clock, visibleTower(), notice]);
        say(`saída: tudo junto em ${kit.inMs(motion.out)}`);
      },
      start() {
        drawMoment(firstMs, { animate: false });
      },
      minuteBack() {
        moveBy(-60 * 1000);
      },
      passBack() {
        const previous = crossingMoments.filter((moment) => moment < currentMs).at(-1);
        if (previous !== undefined) drawMoment(previous, { animate: true });
      },
      playPause() {
        isPlaying = !isPlaying;
        document.querySelector('[data-action="playPause"]').textContent = isPlaying
          ? 'Pausa'
          : 'Play';
        if (isPlaying) {
          lastFrameAt = performance.now();
          requestAnimationFrame(playFrame);
        }
      },
      passForward() {
        const next = crossingMoments.find((moment) => moment > currentMs);
        if (next !== undefined) drawMoment(next, { animate: true });
      },
      minuteForward() {
        moveBy(60 * 1000);
      },
      end() {
        drawMoment(lastMs, { animate: false });
      },
      speed() {
        speedIndex = (speedIndex + 1) % speeds.length;
        document.querySelector('[data-action="speed"]').textContent = `${speeds[speedIndex]}×`;
      },
      view() {
        const leaving = visibleTower();
        view = view === 'compact' ? 'detailed' : 'compact';
        document.querySelector('[data-action="view"]').textContent =
          view === 'compact' ? 'Detalhada' : 'Compacta';
        leaving.classList.add('is-hidden-view');
        visibleTower().classList.remove('is-hidden-view');
        gsap.set(visibleTower(), { autoAlpha: isOnAir ? 1 : 0, y: 0 });
        if (isOnAir) {
          const pieces = [
            visibleTower().querySelector('.tower__head'),
            ...visibleTower().querySelectorAll('.row:not(.is-off-page)'),
          ];
          kit.riseIn(pieces, { stagger: motion.rowStagger });
        }
      },
      page() {
        pageIndex =
          (pageIndex + 1) % Math.ceil(Object.keys(config.teams).length / config.rowsPerPage);
        document.querySelector('[data-action="page"]').textContent = `Pág. ${pageIndex + 1}`;
        const positions = timing.positionsAt(config.passes, currentMs);
        placeRows(towers.compact, positions, false);
        placeRows(towers.detailed, positions, false);
        if (isOnAir)
          kit.riseIn([...visibleTower().querySelectorAll('.row:not(.is-off-page)')], {
            stagger: motion.rowStagger,
          });
      },
    };
  });
})();
