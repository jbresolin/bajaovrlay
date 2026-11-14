// The file names of the operator guide's pictures, under docs/operador/imagens/ (BAJAOVRLAY-31).
// screenshots.e2e.ts writes each one and guidePrintsOnTwoPages.e2e.ts checks that the guide
// shows exactly these, so a picture renamed in one place and not the other fails a test.

/** Each picture of the guide, by the part of the console it shows. */
export const picturesOfTheGuide = {
  /** §1: the status side of the header (sources, OBS, menu, connection, who is logged in). */
  header: 'cabecalho.png',
  /** §2: the whole console, with a clock and a tower on air and a lower third in preview. */
  console: 'console.png',
  /** §3: the "Prévia" monitor and its line with "Tomar" and "Descartar". */
  preview: 'previa.png',
  /** §4: the "Eventos" tab with a penalty and a Super Chat waiting. */
  events: 'eventos.png',
  /** §6: "Partidas da chave" with a decided match and the next one proposed. */
  matches: 'partidas.png',
};
