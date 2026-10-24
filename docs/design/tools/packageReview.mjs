// Packages the ardosia pages for outside review (BAJAOVRLAY-43): copies every page and exactly
// the files it loads (followed through src, href, @import and url()) into .scratch/review/,
// keeping the docs/ layout so every relative path still works, and writes the review page,
// index.html, which lists the graphics by group and shows the chosen one on a 1920×1080 stage
// scaled to fit. The folder is published as a Claude artifact. Run from the repo root:
//   node docs/design/tools/packageReview.mjs
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const docsFolder = resolve('docs');
const directionFolder = resolve(docsFolder, 'design/directions/ardosia');
const outputFolder = resolve('.scratch/review');

// ---------------------------------------------------------------- the static pages, grouped

// Every static page, in the catalogue's order, under the name a reviewer knows it by. A page
// missing from this list stops the package, so a new page is never left out silently.
const staticGroups = [
  {
    name: 'Combinações no ar',
    pages: [
      ['combo-tower', 'relógio, torre e selo'],
      ['combo-strip', 'faixa e lower third'],
      ['combo-fastest-lap', 'com a melhor volta'],
      ['combo-battle', 'com a disputa'],
      ['combo-ticker', 'com as mensagens'],
    ],
  },
  {
    name: 'Relógio de prova',
    pages: [
      ['race-clock', 'com bandeira'],
      ['race-clock-sem-bandeira', 'sem bandeira'],
    ],
  },
  {
    name: 'Torres',
    pages: [
      ['positions-compact', 'compacta'],
      ['positions-detailed', 'detalhada'],
    ],
  },
  {
    name: 'Faixa inferior, lower third e selo',
    pages: [
      ['lower-strip', 'faixa de classificação'],
      ['lower-third', 'lower third'],
      ['sponsor-bug', 'selo do evento'],
    ],
  },
  {
    name: 'Cartão da equipe e disputa',
    pages: [
      ['team-card', 'equipe, com foto e logo'],
      ['team-card-sem-foto', 'equipe, sem foto'],
      ['battle-card', 'disputa'],
    ],
  },
  {
    name: 'Classificação',
    pages: [
      ['standings', 'geral, por página'],
      ['standings-por-prova', 'de uma prova'],
    ],
  },
  {
    name: 'Chave eliminatória · Super Prime',
    pages: [1, 2, 3, 4, 5, 6, 7].map((step) => [`bracket-passo-${step}`, `etapa ${step} de 7`]),
  },
  {
    name: 'Pódio',
    pages: [1, 2, 3].map((step) => [`podium-passo-${step}`, `etapa ${step} de 3`]),
  },
  {
    name: 'Avisos',
    pages: [
      ['fastest-lap', 'melhor volta'],
      ['penalty-notice', 'penalidade'],
    ],
  },
  {
    name: 'Contagem, programação e intervalo',
    pages: [
      ['countdown', 'contagem, cartão'],
      ['countdown-tela-cheia', 'contagem, tela cheia'],
      ['sessions-board', 'programação do dia'],
      ['intermission-board', 'intervalo'],
    ],
  },
  {
    name: 'Patrocinadores, QR e mensagens',
    pages: [
      ['sponsor-roll', 'patrocinadores, tela cheia'],
      ['sponsor-roll-canto', 'patrocinadores, no canto'],
      ['qr-card', 'QR'],
      ['message-ticker', 'mensagens'],
    ],
  },
  {
    name: 'Folhas de referência',
    pages: [
      ['sheet-flags', 'bandeiras'],
      ['sheet-status', 'situações dos carros'],
      ['sheet-columns', 'colunas da torre detalhada'],
      ['sheet-battle', 'tendências da disputa'],
      ['sheet-notices', 'avisos lado a lado'],
      ['sheet-bracket-results', 'resultados da chave'],
    ],
  },
];

// ---------------------------------------------------------------- the motion pages, grouped

// The motion pages say their group and variant in their title ("movimento: QR · cartão
// claro"), so they are grouped from it, in the catalogue's order (the order the motion index,
// motion-catalogo.html, links them); the two timelines come first, as the place to start.
function listMotionGroups(allPageNames) {
  const indexHtml = readFileSync(resolve(directionFolder, 'motion-catalogo.html'), 'utf8');
  const catalogueOrder = [...indexHtml.matchAll(/href="(motion-[^"]+)\.html"/g)].map(
    (match) => match[1],
  );
  const pageNames = catalogueOrder.filter((pageName) => allPageNames.includes(pageName));
  const groups = [];
  const groupOf = (name) => {
    let group = groups.find((candidate) => candidate.name === name);
    if (group === undefined) {
      group = { name, pages: [] };
      groups.push(group);
    }
    return group;
  };
  pageNames.forEach((pageName) => {
    const html = readFileSync(resolve(directionFolder, `${pageName}.html`), 'utf8');
    // Prettier wraps a long title over lines, so the spaces are read back as one.
    const title = /<title>\s*ardosia — movimento:\s*([^<]*?)\s*<\/title>/.exec(html);
    if (title === null) return;
    const [groupName, variant] = title[1].replace(/\s+/g, ' ').split(' · ');
    groupOf(groupName).pages.push([pageName, variant]);
  });
  const timelines = groups.filter((group) => group.name === 'Linha do tempo');
  const others = groups.filter((group) => group.name !== 'Linha do tempo');
  const index = {
    name: 'Índices',
    pages: [
      ['motion-catalogo', 'catálogo de movimento'],
      ['motion-demo', 'demonstração da 1ª etapa (torre e faixa)'],
    ],
  };
  return [...timelines, ...others, index];
}

// ---------------------------------------------------------------- copying what each page loads

const referencePatterns = [/(?:src|href)="([^"#]+)"/g, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g];
const isLocalReference = (reference) => !/^(?:[a-z]+:|\/\/|#)/i.test(reference);

/** Every file the pages need, followed through HTML and CSS references, as absolute paths. */
function collectNeededFiles(pagePaths) {
  const needed = new Set();
  const toVisit = [...pagePaths];
  while (toVisit.length > 0) {
    const filePath = toVisit.pop();
    if (needed.has(filePath)) continue;
    needed.add(filePath);
    const extension = extname(filePath);
    if (extension !== '.html' && extension !== '.css') continue;
    const text = readFileSync(filePath, 'utf8');
    referencePatterns.forEach((pattern) => {
      for (const match of text.matchAll(pattern)) {
        const reference = match[1].trim();
        if (!isLocalReference(reference)) continue;
        const target = resolve(dirname(filePath), reference);
        if (!target.startsWith(docsFolder))
          throw new Error(`${filePath} loads ${reference}, outside docs/.`);
        toVisit.push(target);
      }
    });
  }
  return [...needed];
}

// ---------------------------------------------------------------- the review page

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function renderGroupList(sectionName, groups) {
  const groupItems = groups
    .map((group) => {
      const links = group.pages
        .map(
          ([pageName, variant]) =>
            `          <li><a class="pick" href="#${pageName}" data-page="${pageName}">${escapeHtml(variant)}</a></li>`,
        )
        .join('\n');
      return `      <li class="group">
        <h3>${escapeHtml(group.name)}</h3>
        <ul>
${links}
        </ul>
      </li>`;
    })
    .join('\n');
  return `    <h2>${escapeHtml(sectionName)}</h2>
    <ul class="groups">
${groupItems}
    </ul>`;
}

function renderReviewPage(motionGroups, builtAt) {
  const titlesByPage = {};
  [...motionGroups, ...staticGroups].forEach((group) =>
    group.pages.forEach(([pageName, variant]) => {
      titlesByPage[pageName] = `${group.name} · ${variant}`;
    }),
  );
  const template = readFileSync(resolve('docs/design/tools/reviewPage.html'), 'utf8');
  return template
    .replace('<!-- motion list -->', renderGroupList('Animações', motionGroups))
    .replace('<!-- static list -->', renderGroupList('Telas estáticas', staticGroups))
    .replace('/* titles by page */ {}', JSON.stringify(titlesByPage))
    .replace('<!-- built at -->', escapeHtml(builtAt));
}

// ---------------------------------------------------------------- run

const pageNames = readdirSync(directionFolder)
  .filter((fileName) => fileName.endsWith('.html'))
  .map((fileName) => fileName.replace(/\.html$/, ''))
  .sort();
const groupedStatic = new Set(
  staticGroups.flatMap((group) => group.pages.map(([pageName]) => pageName)),
);
const ungrouped = pageNames.filter(
  (pageName) => !pageName.startsWith('motion-') && !groupedStatic.has(pageName),
);
if (ungrouped.length > 0)
  throw new Error(`Static pages with no group in packageReview.mjs: ${ungrouped.join(', ')}`);

rmSync(outputFolder, { recursive: true, force: true });
const neededFiles = collectNeededFiles(
  pageNames.map((pageName) => resolve(directionFolder, `${pageName}.html`)),
);
neededFiles.forEach((filePath) => {
  const target = resolve(outputFolder, relative(docsFolder, filePath));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(filePath, target);
});
const builtAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(
  new Date(),
);
writeFileSync(
  resolve(outputFolder, 'index.html'),
  renderReviewPage(listMotionGroups(pageNames), builtAt),
);
const publishedPaths = neededFiles.map((filePath) => relative(docsFolder, filePath)).sort();
writeFileSync(resolve(outputFolder, 'files.json'), JSON.stringify(publishedPaths, null, 2));
console.log(
  `${outputFolder}: index.html and ${publishedPaths.length} files (listed in files.json)`,
);
