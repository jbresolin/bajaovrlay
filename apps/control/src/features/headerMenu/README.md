# apps/control/src/features/headerMenu

The "Menu" (☰) in the console's header (BAJAOVRLAY-62): the three things an operator
rarely needs mid-show, moved out of the header. Start at `HeaderMenu.tsx`.

- "Verificar servidor" runs features/serverHealth's check; its answer shows beside the menu.
- "Cópia de segurança" opens features/backup's dialog.
- "Pausar gatilhos" / "Retomar gatilhos" sends setTriggersPaused; greyed out for Dados with
  the reason under it. While paused, features/triggers' `TriggersPausedChip.tsx` keeps the
  pause visible in the header, so it is never hidden in this menu alone.

The menu is shadcn's DropdownMenu (Radix): Enter or a click opens it, the arrows move,
Enter picks, Escape closes. Strings are in the pt-BR catalog (`ptBR.headerMenu`).
