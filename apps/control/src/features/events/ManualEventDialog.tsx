import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal, useServerState } from '@/state/ControlPageStateProvider';

import {
  emptyManualEventFormValues,
  type ManualEventFormValues,
  readManualEventFormIntoCommand,
} from './manualEventForm';
import {
  changeFieldATeamFills,
  chooseTeamInForm,
  generalNoticeTeamChoice,
  listTeamChoicesFoundBySearch,
} from './manualEventTeamPick';

const texts = ptBR.events.manualForm;

/** The fields a team fills, in the order drawn, each with its label and id. */
const fieldsATeamFills: Array<{
  key: 'carNumberText' | 'teamName' | 'schoolName';
  label: string;
  id: string;
}> = [
  { key: 'carNumberText', label: texts.carLabel, id: 'manual-event-car' },
  { key: 'teamName', label: texts.teamLabel, id: 'manual-event-team' },
  { key: 'schoolName', label: texts.schoolLabel, id: 'manual-event-school' },
];

/**
 * "+ Evento" (BAJAOVRLAY-44): a penalty or a notice about one car, typed by the operator,
 * or (BAJAOVRLAY-67) a notice about no car, "Sem equipe (aviso geral)". "Equipe dos
 * cadastros" picks a team of Cadastros, searched by car number, team or school, which
 * fills the car, team and school; with no team in Cadastros a line says so and the fields
 * are typed as before (manualEventTeamPick.ts holds every rule). "Criar evento" reads the
 * form (manualEventForm.ts), sends createManualEvent and closes on the server's ok; a
 * problem or a refusal stays in the dialog. Like the correction dialog, it shows its own
 * command's refusal only, and its button is off while it waits.
 */
export function ManualEventDialog(props: { onClose: () => void }) {
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const teams = useServerState((state) => state.teams);
  const [values, setValues] = useState<ManualEventFormValues>(emptyManualEventFormValues);
  const [teamSearchText, setTeamSearchText] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  const areThereTeams = teams.length > 0;
  const isAGeneralNotice = values.teamChoice === generalNoticeTeamChoice;
  // The team picked stays listed whatever the search, so its name stays in the box.
  const teamsFound = listTeamChoicesFoundBySearch(teams, teamSearchText);
  const teamPicked = listTeamChoicesFoundBySearch(teams, '').find(
    (choice) => choice.value === values.teamChoice,
  );
  const teamsListed =
    teamPicked === undefined || teamsFound.some((choice) => choice.value === teamPicked.value)
      ? teamsFound
      : [teamPicked, ...teamsFound];

  async function createTheEvent(): Promise<void> {
    const reading = readManualEventFormIntoCommand(values);
    if (reading.status === 'problem') {
      setProblem(reading.message);
      return;
    }
    setProblem(undefined);
    setIsWaitingForTheServer(true);
    const refusal = await sendCommandAndReadItsRefusal(reading.command);
    setIsWaitingForTheServer(false);
    if (refusal === null) {
      props.onClose();
      return;
    }
    setProblem(refusal);
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onClose();
        }
      }}
    >
      <DialogContent closeButtonLabel={texts.closeButton}>
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="manual-event-kind">{texts.kindLabel}</Label>
          <Select
            value={values.noticeKind}
            onValueChange={(noticeKind) =>
              setValues({ ...values, noticeKind: noticeKind === 'notice' ? 'notice' : 'penalty' })
            }
          >
            <SelectTrigger id="manual-event-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="penalty">{texts.kindOptions.penalty}</SelectItem>
              <SelectItem value="notice">{texts.kindOptions.notice}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          {/* Names the team list; the search box above it has a name of its own. */}
          <Label htmlFor="manual-event-team-list">{texts.teamListLabel}</Label>
          {areThereTeams ? (
            <Input
              aria-label={texts.teamSearchLabel}
              placeholder={texts.teamSearchPlaceholder}
              autoComplete="off"
              value={teamSearchText}
              onChange={(event) => setTeamSearchText(event.target.value)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{texts.noTeamsInCadastros}</p>
          )}
          <Select
            value={values.teamChoice}
            onValueChange={(choice) => setValues(chooseTeamInForm(values, choice, teams))}
          >
            <SelectTrigger id="manual-event-team-list" className="w-full">
              <SelectValue placeholder={texts.teamListPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={generalNoticeTeamChoice}>{texts.generalNoticeOption}</SelectItem>
              {teamsListed.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.optionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAGeneralNotice
          ? null
          : fieldsATeamFills.map((textField) => (
              <div key={textField.key} className="flex flex-col gap-1">
                <Label htmlFor={textField.id}>{textField.label}</Label>
                <Input
                  id={textField.id}
                  autoComplete="off"
                  value={values[textField.key]}
                  onChange={(event) =>
                    setValues(
                      changeFieldATeamFills(values, textField.key, event.target.value, teams),
                    )
                  }
                />
              </div>
            ))}
        <div className="flex flex-col gap-1">
          <Label htmlFor="manual-event-reason">{texts.reasonLabel}</Label>
          <Input
            id="manual-event-reason"
            autoComplete="off"
            value={values.reason}
            onChange={(event) => setValues({ ...values, reason: event.target.value })}
          />
        </div>
        {values.noticeKind === 'penalty' ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="manual-event-penalty">{texts.penaltyLabel}</Label>
            <Input
              id="manual-event-penalty"
              autoComplete="off"
              placeholder={texts.penaltyPlaceholder}
              value={values.penaltyText}
              onChange={(event) => setValues({ ...values, penaltyText: event.target.value })}
            />
          </div>
        ) : null}
        {problem === undefined ? null : (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isWaitingForTheServer}
            onClick={() => void createTheEvent()}
          >
            {texts.createButton}
          </Button>
          <Button type="button" variant="outline" onClick={props.onClose}>
            {texts.cancelButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
