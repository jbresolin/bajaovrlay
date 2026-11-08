import type { Command } from '../commands/command.js';
import { commandGroupOfEachCommandType } from '../eventLogReading/eventLogCommandGroups.js';

/**
 * The pt-BR sentence for a command the Dados role may not send (BAJAOVRLAY-29), the same
 * for the server's refusal and the control page's tooltip: what is on air for a take, a
 * clear, a "Próximo" or an undo; the preview for a preview; plainly the producer's for
 * the rest. Worded from the command's group of the history filter, so a new command gets a
 * sentence without a line here.
 */
export function describeWhyTheDataRoleCannotSend(commandType: Command['type']): string {
  const group = commandGroupOfEachCommandType[commandType];
  if (group === 'takesAndClears') {
    return 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.';
  }
  if (group === 'previews') {
    return 'O papel Dados não pode mudar a prévia. Peça ao Produtor.';
  }
  return 'O papel Dados não pode fazer isso: é com o Produtor.';
}
