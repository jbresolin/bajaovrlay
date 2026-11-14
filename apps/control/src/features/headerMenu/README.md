# apps/control/src/features/headerMenu

The "Menu" (☰) in the console's header (BAJAOVRLAY-62): the four things an operator
rarely needs mid-show. Start at `HeaderMenu.tsx`. Above them, not an action, what the server
clock follows and its last answer (BAJAOVRLAY-76, features/serverClock's sentence).

- "Verificar servidor" runs features/serverHealth's check; its answer shows beside the menu.
- "Cópia de segurança" opens features/backup's dialog.
- "Pausar gatilhos" / "Retomar gatilhos" sends setTriggersPaused; greyed out for Dados with
  the reason under it. While paused, features/triggers' `TriggersPausedChip.tsx` keeps the
  pause visible in the header, so it is never hidden in this menu alone.
- "Acertar relógio agora" opens features/serverClock's confirm, which steps the server
  clock to real time (NTP's, or HTTPS's when NTP gives no answer); greyed out for Dados with the reason under it.

The menu is shadcn's DropdownMenu (Radix): Enter or a click opens it, the arrows move,
Enter picks, Escape closes. Strings are in the pt-BR catalog (`ptBR.headerMenu`).
