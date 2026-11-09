import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BackupDialog } from '@/features/backup/BackupDialog';
import { useBackupDialog } from '@/features/backup/useBackupDialog';
import { SetServerClockDialog } from '@/features/serverClock/SetServerClockDialog';
import { useServerClockSetting } from '@/features/serverClock/useServerClockSetting';
import { useServerHealthCheck } from '@/features/serverHealth/useServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useIsTheDataRoleLoggedIn, useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

const pauseTexts = ptBR.triggers.pause;

/**
 * The header's "Menu" (BAJAOVRLAY-62): "Verificar servidor", "Cópia de segurança" and
 * "Pausar gatilhos" (or "Retomar gatilhos" while paused), which were header buttons
 * before, and "Acertar relógio agora". Beside it, the line saying what the server check found; the dialog the backup
 * entry opens is drawn here too. The pause follows the server's
 * `triggerActivity.isPaused` and only sends setTriggersPaused; TriggersPausedChip shows a
 * pause in the header, so a pause is never hidden in this menu alone.
 * "Acertar relógio agora" opens a confirm (SetServerClockDialog) that steps the server
 * clock to NTP's real time; Produtor alone may, as the server checks.
 * For Dados the pause entry and "Acertar relógio agora" are greyed out with the reason
 * under each: a disabled entry gets no hover, so a tooltip would never show.
 */
export function HeaderMenu() {
  const serverHealthCheck = useServerHealthCheck();
  const backupDialog = useBackupDialog();
  const isPaused = useServerState((state) => state.triggerActivity.isPaused);
  const sendCommand = useSendCommand();
  const whyTheRoleCannotPause = useWhyTheRoleCannotSend('setTriggersPaused');
  const pauseEntryText = isPaused ? pauseTexts.resumeMenuEntry : pauseTexts.pauseMenuEntry;
  const serverClockSetting = useServerClockSetting();
  const isTheDataRoleLoggedIn = useIsTheDataRoleLoggedIn();

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
          <DropdownMenuItem
            disabled={isTheDataRoleLoggedIn}
            onSelect={serverClockSetting.openTheConfirm}
            className="flex-col items-start gap-0.5"
          >
            <span>{ptBR.serverClock.setNowMenuEntry}</span>
            {isTheDataRoleLoggedIn && (
              <span className="text-xs text-muted-foreground">
                {ptBR.serverClock.producerOnlyReason}
              </span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p role="status" className="text-sm text-muted-foreground">
        {serverHealthCheck.statusText}
      </p>
      <BackupDialog backupDialog={backupDialog} />
      <SetServerClockDialog serverClockSetting={serverClockSetting} />
    </div>
  );
}
