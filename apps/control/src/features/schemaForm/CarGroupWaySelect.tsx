import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import type { AttributesOfTheGroupMessage } from './CarPickControls';
import type { CarGroupWay } from './schemaFormValues';

const texts = ptBR.carGroups;

/** Which ways a group offers besides "Digitado à mão", which every group offers. */
export type WaysOfferedToTheGroup = {
  /** "Pelo número do carro" and "Pelo lugar na corrida": every meaning is a car's field. */
  isFromThePositionsOffered: boolean;
  /** "Equipe dos Cadastros" (BAJAOVRLAY-80): every meaning is an attribute of a team. */
  isFromATeamRecordOffered: boolean;
  /** "Do evento" (BAJAOVRLAY-67): on a template whose event has every meaning. */
  isFromTheEventOffered: boolean;
};

/**
 * "Como escolher <grupo>": the way a car group is filled. A way the group's meanings do
 * not allow is not listed (the team card is never offered a car number); the way the group
 * is on stays listed, so the box never shows a blank for a way an item was saved with.
 * Shown in "Campos separados" too: a way chosen there fills every field alike.
 */
export function CarGroupWaySelect(props: {
  way: CarGroupWay;
  groupLabel: string;
  controlId: string;
  waysOffered: WaysOfferedToTheGroup;
  isDisabled: boolean;
  /** The group message's ARIA attributes, when the message is about the way. */
  attributesOfTheMessage: AttributesOfTheGroupMessage;
  onWayChosen: (chosenWay: string) => void;
}) {
  const { way, waysOffered } = props;
  const isFromThePositionsListed =
    waysOffered.isFromThePositionsOffered || way === 'carNumber' || way === 'place';
  const isFromATeamRecordListed = waysOffered.isFromATeamRecordOffered || way === 'teamRecord';
  const isFromTheEventListed = waysOffered.isFromTheEventOffered || way === 'fromTheEvent';

  return (
    <Select
      value={way === 'notChosen' || way === 'separate' ? '' : way}
      onValueChange={props.onWayChosen}
      disabled={props.isDisabled}
    >
      <SelectTrigger
        id={props.controlId}
        size="sm"
        className="w-full"
        aria-label={texts.wayLabel(props.groupLabel)}
        {...props.attributesOfTheMessage}
      >
        <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {isFromThePositionsListed && (
          <SelectItem value="carNumber">{texts.wayOptions.carNumber}</SelectItem>
        )}
        {isFromThePositionsListed && (
          <SelectItem value="place">{texts.wayOptions.place}</SelectItem>
        )}
        {isFromATeamRecordListed && (
          <SelectItem value="teamRecord">{texts.wayOptions.teamRecord}</SelectItem>
        )}
        <SelectItem value="typed">{texts.wayOptions.typed}</SelectItem>
        {isFromTheEventListed && (
          <SelectItem value="fromTheEvent">{texts.wayOptions.fromTheEvent}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
