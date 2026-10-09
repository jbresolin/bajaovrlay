import type { Command } from '@bajaovrlay/shared';

/**
 * The authorisation step of applyCommand: answers whether this actor may run this
 * command. A store can be given a different one (tests do, and login will).
 */
export type IsCommandAllowed = (command: Command, actor: string) => boolean;

/**
 * The default hook while there is no operator login (M0): every command is allowed.
 * It is a named step now so that adding login later changes this function only.
 */
export const allowEveryCommand: IsCommandAllowed = () => true;
