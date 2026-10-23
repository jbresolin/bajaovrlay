import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listUnusedMediaIds, writeMediaFolderSize } from './mediaUsage';

const texts = ptBR.entityLibrary.media;

/**
 * The images of the media store, above the tabs: how many and the folder's size (the
 * data-folder growth the USB backup will copy), and "Limpar imagens sem uso", which sends
 * deleteMedia for each image no team, person or sponsor names (the server refuses one
 * still in use anyway). The button is there only while some image can be cleaned.
 */
export function MediaFolderSummary() {
  const media = useServerState((state) => state.media);
  const teams = useServerState((state) => state.teams);
  const people = useServerState((state) => state.people);
  const sponsors = useServerState((state) => state.sponsors);
  const scheduleSlots = useServerState((state) => state.scheduleSlots);
  const sendCommand = useSendCommand();

  const unusedMediaIds = listUnusedMediaIds(media, { teams, people, sponsors, scheduleSlots });
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span title={texts.sizeHint}>{texts.summary(media.length, writeMediaFolderSize(media))}</span>
      {unusedMediaIds.length > 0 && (
        <ActionButton
          size="sm"
          variant="outline"
          onClick={() => {
            // One command per image, sent together: each is checked and logged on its own.
            for (const mediaId of unusedMediaIds) {
              void sendCommand({ type: 'deleteMedia', mediaId });
            }
          }}
        >
          {texts.cleanButton(unusedMediaIds.length)}
        </ActionButton>
      )}
    </div>
  );
}
