// The catalogue's motion demos (BAJAOVRLAY-43): what every demo page shares. It reads the
// motion tokens from tokens.css as the product's packages/theme does (readMotionTokens,
// gsapEaseOfToken: durations in ms, offsets in px, each cubic-bezier registered with GSAP's
// CustomEase), so no duration, offset or curve is ever typed in a page or a demo script.
// It wires the page's buttons (Entrar, Sair, Próximo, Atualizar, Novo evento) to the demo
// a family script registered (motionDemoCards.js, motionDemoBoards.js) and gives them the
// moves every graphic is made of: rise in, lift out, crossfade, swap in place.
// Loaded as a classic script after gsap.min.js and CustomEase.min.js, from the file system.
/* global document, window, getComputedStyle, gsap, CustomEase, performance, setInterval, clearInterval */
(function defineArdosiaMotion() {
  gsap.registerPlugin(CustomEase);
  // A newer tween on the same property wins, so Sair during an entry never fights it.
  gsap.defaults({ overwrite: 'auto' });

  const rootStyle = getComputedStyle(document.documentElement);
  const readToken = (tokenName) => rootStyle.getPropertyValue(tokenName).trim();

  // "400ms", "0.4s" or "400" read as seconds for GSAP; anything unreadable is 0 (no motion),
  // the product's rule, so a missing token never leaves a timeline that does not end.
  function readSeconds(tokenName) {
    const value = readToken(tokenName);
    const number = Number.parseFloat(value);
    if (Number.isNaN(number)) return 0;
    const isSeconds = value.endsWith('s') && !value.endsWith('ms');
    return isSeconds ? number : number / 1000;
  }

  function readPixels(tokenName) {
    const number = Number.parseFloat(readToken(tokenName));
    return Number.isNaN(number) ? 0 : number;
  }

  // The same mapping as packages/theme/src/gsapEaseOfToken.ts: a cubic-bezier token becomes
  // a CustomEase with exactly its curve; anything else is GSAP's linear "none".
  const cubicBezierPattern =
    /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;
  const easeNamesByCurve = new Map();
  function readEase(tokenName) {
    const match = cubicBezierPattern.exec(readToken(tokenName));
    if (match === null) return 'none';
    const curveNumbers = match.slice(1, 5).join(',');
    if (!easeNamesByCurve.has(curveNumbers)) {
      const easeName = `theme-cubic-bezier_${curveNumbers.replaceAll(',', '_')}`;
      CustomEase.create(easeName, curveNumbers);
      easeNamesByCurve.set(curveNumbers, easeName);
    }
    return easeNamesByCurve.get(curveNumbers);
  }

  /** Every motion value a demo uses, in seconds and pixels, read once from tokens.css. */
  const motion = {
    in: readSeconds('--motion-in'),
    out: readSeconds('--motion-out'),
    rowStagger: readSeconds('--motion-row-stagger'),
    lead: readSeconds('--motion-lead'),
    flag: readSeconds('--motion-flag'),
    pageTurn: readSeconds('--motion-strip-page'),
    pageStagger: readSeconds('--motion-page-stagger'),
    stripHold: readSeconds('--motion-strip-hold'),
    noticeHold: readSeconds('--motion-notice-hold'),
    noticeMinHold: readSeconds('--motion-notice-min-hold'),
    boardHold: readSeconds('--motion-board-hold'),
    sponsorHold: readSeconds('--motion-sponsor-hold'),
    inOffset: readPixels('--motion-in-offset'),
    podiumOffset: readPixels('--motion-podium-offset'),
    easeOut: readEase('--ease-out'),
    easeIn: readEase('--ease-in'),
    easeInOut: readEase('--ease-in-out'),
  };

  /** "400 ms": a token's value as the status line says it. */
  const inMs = (seconds) => `${Math.round(seconds * 1000)} ms`;

  // ---------------------------------------------------------------- the moves

  /** Puts pieces off air: invisible and one offset below their place, as before an entry. */
  function placeOffAir(pieces, offset = motion.inOffset) {
    gsap.set(pieces, { autoAlpha: 0, y: offset });
  }

  // The opacity the styles give a piece at rest: 1 for most, less for a dimmed one (a
  // bracket's loser, a retired row), so an entry fades it up to its own look, not past it.
  function restingOpacity(_index, piece) {
    const inlineOpacity = piece.style.opacity;
    piece.style.opacity = '';
    const opacity = Number.parseFloat(getComputedStyle(piece).opacity);
    piece.style.opacity = inlineOpacity;
    return opacity;
  }

  /** The entry: each piece rises its offset into place and fades up, `stagger` apart. */
  function riseIn(pieces, { delay = 0, stagger = 0, offset = motion.inOffset } = {}) {
    return gsap.fromTo(
      pieces,
      { autoAlpha: 0, y: offset },
      {
        autoAlpha: restingOpacity,
        y: 0,
        duration: motion.in,
        ease: motion.easeOut,
        delay,
        stagger,
      },
    );
  }

  /** The exit: every piece lifts its offset and fades away, all together. */
  function liftOut(pieces) {
    return gsap.to(pieces, {
      autoAlpha: 0,
      y: -motion.inOffset,
      duration: motion.out,
      ease: motion.easeIn,
    });
  }

  // Lays `incoming` exactly over `current` (same box, absolutely placed in the same parent),
  // so the two can cross without the layout moving; `settle` gives it its place back.
  function layOver(current, incoming) {
    const parent = current.offsetParent ?? current.parentElement;
    const currentBox = current.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();
    gsap.set(incoming, {
      position: 'absolute',
      left: currentBox.left - parentBox.left,
      top: currentBox.top - parentBox.top,
      width: currentBox.width,
      height: currentBox.height,
      margin: 0,
    });
    current.after(incoming);
    return () => {
      current.remove();
      gsap.set(incoming, { clearProps: 'position,left,top,width,height,margin' });
    };
  }

  /** A state change: the new element fades in over the old one in --motion-flag; nothing moves. */
  function crossfade(current, incoming) {
    const settle = layOver(current, incoming);
    const timeline = gsap.timeline({ onComplete: settle });
    timeline.fromTo(
      incoming,
      { autoAlpha: 0 },
      { autoAlpha: restingOpacity, duration: motion.flag, ease: motion.easeOut },
    );
    timeline.to(current, { autoAlpha: 0, duration: motion.flag, ease: motion.easeOut }, 0);
    return timeline;
  }

  /**
   * A page turning in place (a strip page): the old pieces lift away while the new ones rise
   * into the same place, both in --motion-strip-page, `stagger` apart, so it never goes empty.
   */
  function swapInPlace(current, incoming, { stagger = motion.pageStagger } = {}) {
    const settle = layOver(current, incoming);
    const outgoingPieces = current.children.length > 0 ? [...current.children] : [current];
    const incomingPieces = incoming.children.length > 0 ? [...incoming.children] : [incoming];
    const timeline = gsap.timeline({ onComplete: settle });
    timeline.to(outgoingPieces, {
      autoAlpha: 0,
      y: -motion.inOffset,
      duration: motion.pageTurn,
      ease: motion.easeIn,
      stagger,
    });
    timeline.fromTo(
      incomingPieces,
      { autoAlpha: 0, y: motion.inOffset },
      {
        autoAlpha: restingOpacity,
        y: 0,
        duration: motion.pageTurn,
        ease: motion.easeOut,
        stagger,
      },
      0,
    );
    return timeline;
  }

  /** A copy of a <template>'s first element (or all of them with `all`). */
  function cloneTemplate(templateId, { all = false } = {}) {
    const content = document.getElementById(templateId).content;
    if (all) return [...content.children].map((child) => child.cloneNode(true));
    return content.firstElementChild.cloneNode(true);
  }

  /** Resolves after `seconds` on GSAP's clock. */
  function wait(seconds) {
    return new Promise((resolve) => gsap.delayedCall(seconds, resolve));
  }

  /** Seconds since the page opened, for "how long has this been on air". */
  const now = () => performance.now() / 1000;

  /** A repeating timer on GSAP's clock (page holds), stopped with the returned function. */
  function every(seconds, action) {
    let call = gsap.delayedCall(seconds, function repeat() {
      action();
      call = gsap.delayedCall(seconds, repeat);
    });
    return () => call.kill();
  }

  /** A countdown that changes its text in place once a second, as a clock does. */
  function startCountdown(elements, startingSeconds) {
    let remaining = startingSeconds;
    const write = () => {
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = String(remaining % 60).padStart(2, '0');
      const text =
        hours > 0
          ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
          : `${minutes}:${seconds}`;
      elements.forEach((element) => {
        element.textContent = text;
      });
    };
    write();
    const timer = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      write();
    }, 1000);
    return () => clearInterval(timer);
  }

  // ---------------------------------------------------------------- the page

  /**
   * The on-air switch every demo is built on: Entrar runs `enter` once, Sair runs `exit`
   * once, and a press at the wrong moment says so instead of playing twice.
   */
  function onAirSwitch({ enter, exit }) {
    let isOnAir = false;
    return {
      isOnAir: () => isOnAir,
      enter() {
        if (isOnAir) {
          say('já está no ar: use Sair primeiro');
          return;
        }
        isOnAir = true;
        enter();
      },
      exit() {
        if (!isOnAir) {
          say('não está no ar: use Entrar');
          return;
        }
        isOnAir = false;
        exit();
      },
    };
  }

  const demoFactories = new Map();
  /** A family script registers a demo by the name its page carries in data-demo. */
  function register(demoName, factory) {
    demoFactories.set(demoName, factory);
  }

  const statusLine = () => document.getElementById('demo-status');
  /** Writes what just happened, with the token values, on the controls bar. */
  function say(text) {
    statusLine().textContent = text;
  }

  function start() {
    const stage = document.querySelector('[data-demo]');
    const factory = demoFactories.get(stage.dataset.demo);
    const configElement = document.getElementById('demo-config');
    const config = configElement === null ? {} : JSON.parse(configElement.textContent);
    const demo = factory(stage, config);
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => demo[button.dataset.action]());
    });
    say(demo.ready ?? 'pronto: use Entrar');
  }

  // After every script of the page has run (the family script registers on load) and the
  // face is ready, so the first measurement is the real one.
  window.addEventListener('load', () => document.fonts.ready.then(start));

  window.ardosiaMotion = {
    motion,
    inMs,
    placeOffAir,
    riseIn,
    liftOut,
    crossfade,
    swapInPlace,
    cloneTemplate,
    wait,
    now,
    every,
    startCountdown,
    onAirSwitch,
    register,
    say,
  };
})();
