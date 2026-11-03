// Serves a stand-in of the Baja app's results API on this machine (`pnpm
// serve:baja-example`), so "Adicionar fonte do app Baja" can be walked with a race, which
// the real API has none of yet (BAJAOVRLAY-54). It answers, under /resultados/, the
// fixtures of packages/shared/src/flexMapping/examples/bajaApp for event 26BR: the made-up
// event during its competition (evento.php), its real teams (equipes.php), overall table
// (resultado.php, id 26BR_GER) and Super Prime (torneio.php, id 26BR_SPR), and the API
// doc's race ten minutes in as its Enduro (corrida.php, p END). On Fontes, type
// http://localhost:4791 as "Endereço da API" and 26BR as the event.
// Plain Node with no dependency, so it runs with nothing installed but Node 22.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

// 127.0.0.1 only: the BajaOvrLay server reading it runs on this same machine. 4791 is the
// port after serve:flex-example's, so both can run at once.
const port = 4791;
const host = '127.0.0.1';

const fixtureFolder = new URL(
  '../packages/shared/src/flexMapping/examples/bajaApp/',
  import.meta.url,
);

/**
 * Reads one fixture once, at start, checked as JSON, so a broken file stops here with its
 * reason instead of answering bad JSON at every poll.
 * @param {string} fileName
 * @returns {unknown}
 */
function readFixture(fileName) {
  return JSON.parse(readFileSync(new URL(fileName, fixtureFolder), 'utf8'));
}

// Each request the stand-in knows, its query parameters in name order, and its answer.
/** @type {Map<string, unknown>} */
const answersByRequest = new Map([
  ['evento.php?evt=26BR', readFixture('evento-26BR-during-the-event.made-up.json')],
  ['equipes.php?evt=26BR', readFixture('equipes-26BR.json')],
  ['corrida.php?evt=26BR&p=END', readFixture('corrida-00NE_ZZL.from-doc.json')],
  ['resultado.php?evt=26BR&id=26BR_GER', readFixture('resultado-26BR_GER.json')],
  ['torneio.php?evt=26BR&id=26BR_SPR', readFixture('torneio-26BR_SPR.json')],
]);

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}`);
  const endpoint = requestUrl.pathname.replace(/^\/resultados\//, '');
  const sortedParameters = [...requestUrl.searchParams.entries()].sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB),
  );
  const requestKey = `${endpoint}?${new URLSearchParams(sortedParameters).toString()}`;
  const answer = answersByRequest.get(requestKey);
  if (request.method !== 'GET' || answer === undefined) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Só existem aqui: ${[...answersByRequest.keys()].join(', ')}\n`);
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(answer));
});

server.listen(port, host, () => {
  // The project bans console.log (the server logs through its JSON logger); this script
  // writes its one line to the terminal directly.
  process.stdout.write(
    `API do app Baja de exemplo (26BR) em http://localhost:${String(port)}\n` +
      'Ctrl+C para parar.\n',
  );
});
