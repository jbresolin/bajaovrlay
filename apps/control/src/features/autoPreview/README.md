# apps/control/src/features/autoPreview

"Prévia automática": the page's one browser setting (its switch is drawn in the rundown column,
`features/rundown/AutoPreviewToggle.tsx`) and the take that previews the next item while it is
on, used by the rundown and by "Tomar" under "Prévia". Start at `useTakeThenPreviewNextItem.ts`.

- `autoPreviewSettingStore.ts` — the page's one Zustand store for the switch, kept apart from the
  server-state store; built once in `main.tsx` (each test builds its own).
- `AutoPreviewSettingProvider.tsx` — puts that store on the page; `useAutoPreviewSetting()` gives
  `isAutoPreviewOn` and `chooseIsAutoPreviewOn`.
- `autoPreviewSettingInBrowserStorage.ts` — localStorage read and write, each in try/catch, and
  why this setting is not server state.
- `useTakeThenPreviewNextItem.ts` — Space, "Disparar" and "Tomar": the take, then `previewItem`
  (origin `auto`) for the new cursor item; `itemToPreviewAfterTake.ts` decides.
