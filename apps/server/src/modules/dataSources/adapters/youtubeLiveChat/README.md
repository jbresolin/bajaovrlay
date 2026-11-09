# apps/server/src/modules/dataSources/adapters/youtubeLiveChat

The `youtubeLiveChat` adapter (BAJAOVRLAY-35): reads a YouTube live's chat with an API key
(BAJAOVRLAY_YOUTUBE_API_KEY, read at each request) and answers the `superChats` shape, the
newest 50 paid text messages, for the event inbox to list for approval. No OAuth, no
`streamList`, no stickers, memberships or avatars.

Start at `youTubeLiveChatAdapter.ts` (the chat looked up once with videos.list, then read from
the last page token with liveChatMessages.list, never before YouTube's pollingIntervalMillis),
then `superChatsFromLiveChatAnswer.ts` (what is kept of YouTube's answers),
`youTubeApiRequests.ts` (one GET, the pt-BR refusals, and `redactTheKeyInAnAddress`, the only
form of an address that is logged), and the quota: `youTubeQuotaLedger.ts` (units spent today in
`DATA_DIR/youtube-quota.json`, kept across restarts), `youTubeQuotaDay.ts` (Pacific midnight,
read in Brasília) and `youTubeDailyUnitsBudget.ts` (BAJAOVRLAY_YOUTUBE_DAILY_UNITS).
`fakeYouTube.testSupport.ts` is the local fake YouTube and the fake key the tests use.
João's runbook is docs/youtube.md.
