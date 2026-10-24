// The motion demos of the catalogue's cards (BAJAOVRLAY-43): the team card, the battle card,
// the QR card, the countdown card, the message ticker and the notice slot (fastest lap,
// penalty or incident); the corner sponsor roll is in motionDemoSponsors.js. Each registers
// with motionDemoCore.js by the name its page carries in data-demo; every duration, offset
// and curve comes from `motion`, read
// from tokens.css. motion.md describes what each one does, in the same order.
/* global window, gsap */
(function registerCardDemos() {
  const kit = window.ardosiaMotion;
  const { motion, inMs, say } = kit;
  const inSeconds = (seconds) => `${String(seconds).replace('.', ',')} s`;

  /** A graphic that is one card: it rises in whole and lifts out whole. */
  function wholeCardDemo(card, description) {
    kit.placeOffAir([card]);
    return kit.onAirSwitch({
      enter() {
        kit.riseIn([card]);
        say(description);
      },
      exit() {
        kit.liftOut([card]);
        say(`saída: o cartão sobe e some em ${inMs(motion.out)}`);
      },
    });
  }

  kit.register('team-card', (stage) => {
    const card = stage.querySelector('.team-card');
    const hasMedia = card.querySelector('.team-card__photo, .team-card__logo') !== null;
    const mediaWords = hasMedia ? '; foto e logo vêm com ele, nunca depois' : '';
    return wholeCardDemo(
      card,
      `entrada: o cartão inteiro sobe ${motion.inOffset} px e aparece em ${inMs(motion.in)}${mediaWords}`,
    );
  });

  kit.register('qr-card', (stage) =>
    wholeCardDemo(
      stage.querySelector('.qr-card'),
      `entrada: o cartão inteiro em ${inMs(motion.in)}; nada se mexe enquanto está no ar (um código em movimento não lê)`,
    ),
  );

  kit.register('countdown', (stage, config) => {
    const card = stage.querySelector('.countdown');
    kit.startCountdown([card.querySelector('.race-clock__time')], config.remainingSeconds);
    return wholeCardDemo(
      card,
      `entrada: como o relógio de prova, ${inMs(motion.in)}; os números mudam no lugar, sem movimento`,
    );
  });

  // ---------------------------------------------------------------- battle card

  kit.register('battle-card', (stage, config) => {
    const card = stage.querySelector('.battle-card');
    const pieces = [...card.children];
    let updateIndex = 0;
    kit.placeOffAir(pieces);
    const demo = kit.onAirSwitch({
      enter() {
        kit.riseIn(pieces, { stagger: motion.lead });
        say(
          `entrada: o carro da frente, a diferença ${inMs(motion.lead)} depois, o carro de trás ${inMs(motion.lead)} depois dela`,
        );
      },
      exit() {
        kit.liftOut(pieces);
        say(`saída: as três peças juntas em ${inMs(motion.out)}`);
      },
    });
    // Atualizar: the next lap's reading. The number changes in place (it is read, not
    // watched); the trend cell crossfades only when its word changes, like a flag band.
    demo.update = () => {
      updateIndex = (updateIndex + 1) % config.updates.length;
      const reading = config.updates[updateIndex];
      card.querySelector('.battle-gap__value').textContent = reading.gapText;
      const currentTrend = card.querySelector('.battle-gap__trend');
      if (currentTrend.dataset.trend === reading.trend) {
        currentTrend.querySelector('.battle-gap__trend-words').textContent = reading.trendWords;
        say(`atualização ${reading.gapText}: a palavra fica, os números mudam no lugar`);
        return;
      }
      const incomingTrend = kit.cloneTemplate(`trend-${reading.trend}`);
      incomingTrend.querySelector('.battle-gap__trend-words').textContent = reading.trendWords;
      kit.crossfade(currentTrend, incomingTrend);
      say(
        `atualização ${reading.gapText}: a tendência muda com esmaecimento de ${inMs(motion.flag)}`,
      );
    };
    return demo;
  });

  // ---------------------------------------------------------------- message ticker

  kit.register('message-ticker', (stage, config) => {
    const ticker = stage.querySelector('.message-ticker');
    const pageCell = ticker.querySelector('.lower-strip__page');
    const pieces = [
      ticker.querySelector('.lower-strip__clock'),
      ticker.querySelector('.message-ticker__label'),
      ticker.querySelector('.message-ticker__message'),
      pageCell,
    ].filter((piece) => piece !== null);
    let messageIndex = 0;
    let stopTurning = null;
    kit.placeOffAir(pieces);

    // A message changes as a strip page does: the old lifts away as the new rises in.
    function turnPage() {
      messageIndex = (messageIndex + 1) % config.messages.length;
      const current = ticker.querySelector('.message-ticker__message');
      const incoming = current.cloneNode(false);
      incoming.textContent = config.messages[messageIndex];
      kit.swapInPlace(current, incoming);
      pageCell.textContent = `${messageIndex + 1}/${config.messages.length}`;
      say(
        `mensagem ${messageIndex + 1}: troca em ${inMs(motion.pageTurn)} e fica ${inSeconds(motion.stripHold)}; nunca rola`,
      );
    }

    return kit.onAirSwitch({
      enter() {
        kit.riseIn(pieces, { stagger: motion.rowStagger });
        stopTurning = kit.every(motion.stripHold, turnPage);
        say(
          `entrada: as peças da esquerda para a direita, ${inMs(motion.rowStagger)} uma da outra; a mensagem troca a cada ${inSeconds(motion.stripHold)}`,
        );
      },
      exit() {
        stopTurning?.();
        kit.liftOut(pieces);
        say(`saída: a barra inteira em ${inMs(motion.out)}`);
      },
    });
  });

  // ---------------------------------------------------------------- the notice slot

  // One notice at a time. A notice leaves by itself after --motion-notice-hold. A new one
  // arriving while another is up waits until that one has been up --motion-notice-min-hold
  // (so it can be read), then the old one lifts out and the new one rises in; several close
  // together queue in the order they came. Novo evento sends the next notice of the list.
  kit.register('notices', (stage, config) => {
    let current = stage.querySelector('.notice');
    // The one state: when the notice on air came up, or null when the slot is empty.
    let shownAt = null;
    let eventIndex = 0;
    let autoExit = null;
    let isSwapping = false;
    const queue = [];
    kit.placeOffAir([current]);

    function bringIn(notice) {
      current = notice;
      shownAt = kit.now();
      kit.riseIn([notice]);
      autoExit?.kill();
      autoExit = gsap.delayedCall(motion.noticeHold, () => {
        if (queue.length > 0 || isSwapping) return;
        kit.liftOut([current]);
        shownAt = null;
        say(`o aviso saiu sozinho depois de ${inSeconds(motion.noticeHold)}`);
      });
    }

    async function replaceWithNextInQueue() {
      if (isSwapping || queue.length === 0 || shownAt === null) return;
      isSwapping = true;
      const waitFor = Math.max(0, motion.noticeMinHold - (kit.now() - shownAt));
      const swapWords = `sai em ${inMs(motion.out)} e o novo entra em ${inMs(motion.in)}`;
      if (waitFor > 0) {
        say(
          `novo evento: o aviso no ar fica mais ${inSeconds(waitFor.toFixed(1))} (mínimo de ${inSeconds(motion.noticeMinHold)}), depois ${swapWords}`,
        );
      } else {
        say(
          `novo evento: o aviso no ar já ficou o mínimo de ${inSeconds(motion.noticeMinHold)}; ${swapWords}`,
        );
      }
      await kit.wait(waitFor);
      // Sair while waiting, or while the old one lifts out, empties the queue: no swap then.
      if (shownAt === null || queue.length === 0) {
        isSwapping = false;
        return;
      }
      autoExit?.kill();
      await kit.liftOut([current]);
      if (shownAt === null || queue.length === 0) {
        shownAt = null;
        isSwapping = false;
        return;
      }
      const incoming = queue.shift();
      current.replaceWith(incoming);
      kit.placeOffAir([incoming]);
      bringIn(incoming);
      isSwapping = false;
      replaceWithNextInQueue();
    }

    return {
      enter() {
        if (shownAt !== null) {
          say('já está no ar: use Sair primeiro');
          return;
        }
        bringIn(current);
        say(
          `entrada: o aviso sobe em ${inMs(motion.in)}; sai sozinho depois de ${inSeconds(motion.noticeHold)}`,
        );
      },
      exit() {
        if (shownAt === null) {
          say('não está no ar: use Entrar');
          return;
        }
        queue.length = 0;
        autoExit?.kill();
        kit.liftOut([current]);
        shownAt = null;
        say(`saída antes da hora: ${inMs(motion.out)}; os avisos na fila são descartados`);
      },
      newEvent() {
        eventIndex = (eventIndex + 1) % config.eventTemplates.length;
        const incoming = kit.cloneTemplate(config.eventTemplates[eventIndex]);
        if (shownAt === null && !isSwapping) {
          current.replaceWith(incoming);
          kit.placeOffAir([incoming]);
          bringIn(incoming);
          say(`novo evento com o espaço livre: entra direto em ${inMs(motion.in)}`);
          return;
        }
        queue.push(incoming);
        if (isSwapping) {
          say(
            `novo evento na fila (${queue.length}): entra depois, cada aviso fica pelo menos ${inSeconds(motion.noticeMinHold)}`,
          );
          return;
        }
        replaceWithNextInQueue();
      },
    };
  });
})();
