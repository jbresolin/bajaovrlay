import type { Command } from '../commands/command.js';

/**
 * One command of the union by its type: `CommandOfType<'takeItem'>` is the takeItem
 * command. It saves every sentence file from importing seventy command types by name.
 */
export type CommandOfType<CommandType extends Command['type']> = Extract<
  Command,
  { type: CommandType }
>;
