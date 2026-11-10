/**
 * The pt-BR texts of the YouTube live chat source's shared schemas (BAJAOVRLAY-35): why a
 * config or a poll interval was refused. The server and the control page show them as they are.
 */
export const ptBRYouTubeLiveChat = {
  configReasons: {
    notALiveAddress:
      'Cole o endereço da transmissão: youtube.com/watch?v=…, youtu.be/… ou youtube.com/live/….',
    pollIntervalTooShort: (shortestSeconds: number) =>
      `O chat do YouTube é lido no máximo a cada ${shortestSeconds} s, para não gastar a cota diária.`,
  },
};
