import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

import { ChooseBracketMatchDialog, type ChooseMatch } from './ChooseBracketMatchDialog';
import {
  describeMatchFocusOfEachSource,
  type MatchFocusOfASource,
  type MatchFocusProposal,
  type SlotOnThePage,
} from './matchFocusOfEachSource';

const texts = ptBR.bracketMatchFocus;

/** The words of one slot: its match, "Nenhuma partida", or the match that left the source. */
function SlotLine(props: { slotName: string; slot: SlotOnThePage }) {
  const { slot } = props;
  let slotText: string;
  if (slot.kind === 'chosen') {
    slotText = slot.match.matchText;
  } else if (slot.kind === 'gone') {
    slotText = texts.goneSlot(slot.matchId);
  } else {
    slotText = texts.emptySlot;
  }
  return (
    <p className="text-sm">
      <span className="font-semibold">{texts.slotLabel(props.slotName)}</span>
      <span className={slot.kind === 'chosen' ? undefined : 'text-muted-foreground'}>
        {slotText}
      </span>
    </p>
  );
}

/**
 * The proposal's words: the winner and the next match, or the suggestion alone (with
 * "agora" empty, or gone, which its slot line already says).
 */
function ProposalLines(props: { proposal: MatchFocusProposal }) {
  const { proposal } = props;
  if (proposal.kind === 'nothingChosen' || proposal.kind === 'currentGone') {
    return <p className="text-sm">{texts.proposal.nothingChosen(proposal.suggestedMatchText)}</p>;
  }
  return (
    <div className="flex flex-col text-sm">
      <p className="font-semibold">{texts.proposal.currentDecided(proposal.winnerName)}</p>
      <p>
        {proposal.suggestedMatchText === undefined
          ? texts.proposal.nothingLeft
          : texts.proposal.nextSuggested(proposal.suggestedMatchText)}
      </p>
    </div>
  );
}

/** "Agora", "A seguir", the proposal and the buttons for one source's Super Prime. */
function MatchFocusOfOneSource(props: { source: MatchFocusOfASource; title: string }) {
  const { source } = props;
  const sendCommand = useSendCommand();
  const whyTheRoleCannotChoose = useWhyTheRoleCannotSend('setBracketMatchFocus');
  const isDisabled = whyTheRoleCannotChoose !== undefined;
  const [isListOpen, setIsListOpen] = useState(false);

  const chooseMatch: ChooseMatch = (slot, matchId) => {
    void sendCommand({
      type: 'setBracketMatchFocus',
      sourceId: source.sourceId,
      sessionId: source.sessionId,
      slot,
      matchId,
    });
  };
  const proposedCurrentMatchId = source.proposedMatches.currentMatchId;
  const acceptTheSuggestion = (currentMatchId: string) => {
    // The proposal shown goes with the press: the server refuses it if its own changed.
    void sendCommand({
      type: 'acceptSuggestedBracketMatches',
      sourceId: source.sourceId,
      sessionId: source.sessionId,
      currentMatchId,
      upNextMatchId: source.proposedMatches.upNextMatchId ?? null,
    });
  };
  const isCurrentOver =
    source.proposal?.kind === 'currentDecided' || source.proposal?.kind === 'currentGone';

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <SlotLine slotName={texts.slotNames.current} slot={source.current} />
      <SlotLine slotName={texts.slotNames.upNext} slot={source.upNext} />
      {source.proposal === undefined ? null : <ProposalLines proposal={source.proposal} />}
      <div className="flex flex-wrap items-center gap-2">
        {source.proposal !== undefined && proposedCurrentMatchId !== undefined ? (
          <Button
            type="button"
            size="sm"
            disabled={isDisabled}
            onClick={() => acceptTheSuggestion(proposedCurrentMatchId)}
          >
            {texts.useSuggestionButton}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDisabled}
          onClick={() => setIsListOpen(true)}
        >
          {isCurrentOver ? texts.chooseAnotherButton : texts.chooseButton}
        </Button>
        {isDisabled ? (
          <span className="text-xs text-muted-foreground">{whyTheRoleCannotChoose}</span>
        ) : null}
      </div>
      {isListOpen ? (
        <ChooseBracketMatchDialog
          source={source}
          onChoose={chooseMatch}
          isDisabled={isDisabled}
          onClose={() => setIsListOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * "Partidas da chave" (BAJAOVRLAY-65), on the console's right column: for each source
 * that sends a Super Prime, the match "agora" (the match bug's) and "a seguir" (the
 * card's), the proposal of the next match once "agora" has its winner, "Usar sugestão" and
 * "Escolher partida". Nothing at all while no source sends brackets. It shows the server's
 * slices only (matchFocusOfEachSource.ts): every press sends one command, and the slots
 * change when the server says so; "agora" never moves by itself. For Dados the buttons are
 * greyed out with the role's reason written beside them (the bug on air follows "agora").
 */
export function BracketMatchFocusPanel() {
  const dataSources = useServerState((state) => state.dataSources);
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const bracketMatchFocuses = useServerState((state) => state.bracketMatchFocuses);
  const sources = useMemo(
    () => describeMatchFocusOfEachSource({ dataSources, dataSnapshots, bracketMatchFocuses }),
    [dataSources, dataSnapshots, bracketMatchFocuses],
  );
  if (sources.length === 0) {
    return null;
  }
  const isOneSource = sources.length === 1;
  return (
    <section aria-label={texts.areaTitle} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{texts.areaTitle}</h2>
      {sources.map((source) => (
        <MatchFocusOfOneSource
          key={source.sourceId}
          source={source}
          title={isOneSource ? source.sourceLabel : texts.sourceTitle(source.sourceLabel)}
        />
      ))}
      <CommandErrorMessage
        commandTypes={['setBracketMatchFocus', 'acceptSuggestedBracketMatches']}
      />
    </section>
  );
}
