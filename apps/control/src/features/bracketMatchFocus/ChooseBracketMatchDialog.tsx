import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';

import type { MatchFocusOfASource, MatchRow } from './matchFocusOfEachSource';

const texts = ptBR.bracketMatchFocus;

/** What the dialog asks of the panel: put a match in a slot, or empty one (`null`). */
export type ChooseMatch = (slot: 'current' | 'upNext', matchId: string | null) => void;

/** Which slot a match is in now, if any, for its badge. */
function findSlotOfMatch(
  source: MatchFocusOfASource,
  matchId: string,
): 'current' | 'upNext' | undefined {
  if (source.current.kind === 'chosen' && source.current.match.matchId === matchId) {
    return 'current';
  }
  if (source.upNext.kind === 'chosen' && source.upNext.match.matchId === matchId) {
    return 'upNext';
  }
  return undefined;
}

/** One match of the list: its words, its badges, and its two buttons. */
function MatchRowOfTheList(props: {
  row: MatchRow;
  slotNow: 'current' | 'upNext' | undefined;
  onChoose: ChooseMatch;
  isDisabled: boolean;
}) {
  const { row } = props;
  return (
    <li className="flex items-center gap-2 rounded-md border p-2">
      <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{row.matchText}</span>
        <Badge variant="outline">{texts.progressLabels[row.progress]}</Badge>
        {row.suggestedFor === undefined ? null : (
          <Badge variant="secondary">{texts.suggestedLabels[row.suggestedFor]}</Badge>
        )}
        {props.slotNow === undefined ? null : <Badge>{texts.inSlotLabels[props.slotNow]}</Badge>}
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={props.isDisabled}
        aria-label={texts.dialog.putButtonLabel(texts.slotNames.current, row.matchText)}
        onClick={() => props.onChoose('current', row.matchId)}
      >
        {texts.dialog.putNowButton}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={props.isDisabled}
        aria-label={texts.dialog.putButtonLabel(texts.slotNames.upNext, row.matchText)}
        onClick={() => props.onChoose('upNext', row.matchId)}
      >
        {texts.dialog.putUpNextButton}
      </Button>
    </li>
  );
}

/**
 * "Escolher partida" (BAJAOVRLAY-65): every match of the source's Super Prime in the
 * source's order, each with its progress (encerrada, em andamento, a definir), the
 * suggestion it carries and the slot it is in, and "Agora" and "A seguir" to put it there;
 * any match goes in either slot, one listed after a match not yet run included (the final
 * run after a third place listed later). The two slots can be emptied at the foot. The
 * dialog stays open after a press, so both slots can be set in one go; the badges follow
 * the server's slices.
 */
export function ChooseBracketMatchDialog(props: {
  source: MatchFocusOfASource;
  onChoose: ChooseMatch;
  isDisabled: boolean;
  onClose: () => void;
}) {
  const { source } = props;
  return (
    <Dialog
      open
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onClose();
        }
      }}
    >
      <DialogContent
        closeButtonLabel={texts.dialog.closeButton}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{texts.dialog.title}</DialogTitle>
          <DialogDescription>{texts.dialog.description}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1">
          {source.matches.map((row) => (
            <MatchRowOfTheList
              key={row.matchId}
              row={row}
              slotNow={findSlotOfMatch(source, row.matchId)}
              onChoose={props.onChoose}
              isDisabled={props.isDisabled}
            />
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={props.isDisabled}
            onClick={() => props.onChoose('current', null)}
          >
            {texts.dialog.emptyNowButton}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={props.isDisabled}
            onClick={() => props.onChoose('upNext', null)}
          >
            {texts.dialog.emptyUpNextButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
