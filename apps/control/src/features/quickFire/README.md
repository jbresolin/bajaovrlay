# apps/control/src/features/quickFire

The quick-fire strip (right column, above the layers): a tab per panel and "Macros". Start here.

- `QuickFireStrip.tsx` (start here) — the tab shown (this page's own choice), "+ Painel", the panel or the
  Macros tab (features/macros), and the refusals of what is sent from here (macro "Prévia" included).
- `QuickFireTabList.tsx` — the tabs (plain buttons with tab roles, each with its F-key).
- `QuickFirePanelView.tsx` — one panel: "+ Atalho" (opens the page's item editor on this panel),
  "Renomear", "Excluir painel", and the grid; `PanelNameForm.tsx` names a panel.
- `QuickFireItemButton.tsx` — one button: click = `takeItem` through features/autoPreview (the
  page's one take path); right-click or "⋯" = "Prévia", "Editar", "Mover para rundown".
- `quickFireTabs.ts` (pure; its test is the table to read) and `useQuickFireKeys.ts` — the tabs in
  order, F1–F4, and what 1–9 fire, with keys and rules from `src/keyboard/keyboardMap.ts`.

A panel button never moves the rundown's cursor (the server's rule), so no automatic preview follows it.
