// Turns the catalogue's motion demos (slateMotionDemos.mjs) into pages, and writes the index
// that links them, motion-catalogo.html. A demo page is the graphic over the footage, the
// controls bar above the title-safe area (the buttons and a status line saying what moved and
// for how long), the states its buttons bring in as <template>s, its data as JSON, and the
// scripts: GSAP and CustomEase as the product has them, then motionDemoCore.js and the
// family script. slatePages.mjs merges these pages with the others.
import { listMotionDemos } from './slateMotionDemos.mjs';
import { pageShell } from './slateTemplates.mjs';
import { escapeHtml } from './slateVocabulary.mjs';

// GSAP as the product has it (3.15.0, the race clock's dependency), copied byte for byte into
// docs/design/vendor/gsap: the pages open from the file system in any browser, and one that
// reads the WSL disk through \\wsl.localhost cannot follow node_modules' symlinks (see that
// folder's README). The path is relative to a direction's folder; nothing comes from the network.
const gsapFolder = '../../vendor/gsap';

const actionLabels = {
  enter: 'Entrar',
  exit: 'Sair',
  next: 'Próximo',
  update: 'Atualizar',
  newEvent: 'Novo evento',
};

function renderDemoPage(direction, demo) {
  const title = `${demo.group} · ${demo.variant}`;
  const buttons = demo.actions
    .map(
      (action) =>
        `  <button type="button" class="demo-controls__button" data-action="${action}">${actionLabels[action]}</button>`,
    )
    .join('\n');
  const templates = (demo.templates ?? []).join('\n');
  const config =
    demo.config === undefined
      ? ''
      : `<script type="application/json" id="demo-config">${JSON.stringify(demo.config)}</script>\n`;
  const body = `<nav class="demo-controls" aria-label="Controles da demonstração">
  <a class="demo-controls__back" href="motion-catalogo.html">Catálogo</a>
  <span class="demo-controls__title">${escapeHtml(title)}</span>
${buttons}
  <span class="demo-controls__status" id="demo-status" role="status"></span>
</nav>
<div class="demo-stage" data-demo="${demo.demoName}">
${demo.stage}
</div>
${templates}
${config}`;
  const scripts = `<script src="${gsapFolder}/gsap.min.js"></script>
<script src="${gsapFolder}/CustomEase.min.js"></script>
<script src="../../tools/motionDemoCore.js"></script>
<script src="../../tools/motionDemo${demo.family}.js"></script>
`;
  return pageShell(direction, `movimento: ${title}`, body, scripts);
}

// The index: every demo by graphic, in the catalogue's order, with the buttons it has.
function renderDemoIndex(direction, demos) {
  const groups = [];
  demos.forEach((demo) => {
    const lastGroup = groups.at(-1);
    if (lastGroup !== undefined && lastGroup.name === demo.group) {
      lastGroup.demos.push(demo);
      return;
    }
    groups.push({ name: demo.group, demos: [demo] });
  });
  const groupCards = groups
    .map((group) => {
      const links = group.demos
        .map((demo) => {
          const buttons = demo.actions.map((action) => actionLabels[action]).join(' · ');
          return `      <a class="demo-index__link" href="${demo.fileName}">${escapeHtml(demo.variant)}<span class="demo-index__buttons">${buttons}</span></a>`;
        })
        .join('\n');
      return `    <div class="card demo-index__group">
      <span class="caption">${escapeHtml(group.name)}</span>
${links}
    </div>`;
    })
    .join('\n');
  const body = `<div class="demo-index">
  <div class="sheet__title">${direction} · movimento do catálogo — uma página por gráfico e por combinação das partes opcionais; GSAP com os tempos e curvas de tokens.css (não vai ao ar)</div>
  <div class="demo-index__groups">
${groupCards}
  </div>
</div>`;
  return pageShell(direction, 'movimento do catálogo', body);
}

/** The catalogue's demo pages and their index: a map of file name to HTML. */
export function buildMotionDemoPages(options) {
  const demos = listMotionDemos(options);
  const pages = { 'motion-catalogo.html': renderDemoIndex(options.name, demos) };
  demos.forEach((demo) => {
    pages[demo.fileName] = renderDemoPage(options.name, demo);
  });
  return pages;
}
