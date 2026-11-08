import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BackupDialog } from '@/features/backup/BackupDialog';
import { useBackupDialog } from '@/features/backup/useBackupDialog';
import { useServerHealthCheck } from '@/features/serverHealth/useServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

const pauseTexts = ptBR.triggers.pause;

/**
 * The header's "Menu" (BAJAOVRLAY-62): "Verificar servidor", "Cópia de segurança" and
 * "Pausar gatilhos" (or "Retomar gatilhos" while paused), which were header buttons
 * before. Beside it, the line saying what the server check found; the dialog the backup
 * entry opens is drawn here too. The pause follows the server's
 * `triggerActivity.isPaused` and only sends setTriggersPaused; TriggersPausedChip shows a
 * pause in the header, so a pause is never hidden in this menu alone.
 * For Dados the pause entry is greyed out with the role's reason under it: a disabled
 * entry gets no hover, so a tooltip would never show.
 */
export function HeaderMenu() {
  const serverHealthCheck = useServerHealthCheck();
  const backupDialog = useBackupDialog();
  const isPaused = useServerState((state) => state.triggerActivity.isPaused);
  const sendCommand = useSendCommand();
  const whyTheRoleCannotPause = useWhyTheRoleCannotSend('setTriggersPaused');
  const pauseEntryText = isPaused ? pauseTexts.resumeMenuEntry : pauseTexts.pauseMenuEntry;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={ptBR.headerMenu.buttonLabel}
          >
            {ptBR.headerMenu.buttonSymbol}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void serverHealthCheck.checkServer()}>
            {ptBR.serverHealth.checkButton}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={backupDialog.openTheDialog}>
            {ptBR.backup.menuEntry}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={whyTheRoleCannotPause !== undefined}
            onSelect={() => void sendCommand({ type: 'setTriggersPaused', isPaused: !isPaused })}
            className="flex-col items-start gap-0.5"
          >
            <span>{pauseEntryText}</span>
            {whyTheRoleCannotPause !== undefined && (
              <span className="text-xs text-muted-foreground">{whyTheRoleCannotPause}</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p role="status" className="text-sm text-muted-foreground">
        {serverHealthCheck.statusText}
      </p>
      <BackupDialog backupDialog={backupDialog} />
    </div>
  );
}
