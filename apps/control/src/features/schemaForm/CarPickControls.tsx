import { highestPlaceACarCanBePickedAt } from '@bajaovrlay/shared';

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

import type { CarPickInForm } from './carGroupChoice';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';

const texts = ptBR.carGroups;

/** The control of a car group a message of the group is about (CarGroupFields.tsx). */
export type ControlOfTheGroupMessage = 'way' | 'source' | 'carNumber' | 'place';

/**
 * What a control carries while the group's message is about it: marked invalid and
 * described by the message, so a screen reader reads the message with the control.
 */
export type AttributesOfTheGroupMessage = {
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

/** The places a car can be picked at, 1st to 10th. */
const placeNumbersOffered = Array.from(
  { length: highestPlaceACarCanBePickedAt },
  (_unused, index) => index + 1,
);

/**
 * The controls of one pick: the source, the car's number or its place, and "Ao vivo /
 * Congelado na entrada", each change handed back as the whole pick after it.
 */
export function CarPickControls(props: {
  pick: CarPickInForm;
  groupLabel: string;
  controlId: string;
  bindingOptions: SchemaFormBindingOptions;
  isDisabled: boolean;
  /** The group message's ARIA attributes for a control, empty when it is not about it. */
  describeControlWithTheMessage: (control: ControlOfTheGroupMessage) => AttributesOfTheGroupMessage;
  onPickChanged: (pickAfter: CarPickInForm) => void;
}) {
  const { pick, groupLabel, controlId, bindingOptions, isDisabled, onPickChanged } = props;
  const { describeControlWithTheMessage } = props;
  const editorTexts = ptBR.bindings.editor;

  return (
    <div className="flex flex-col gap-2">
      {bindingOptions.dataSources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{editorTexts.noSourceYet}</p>
      ) : (
        <Select
          value={pick.sourceId}
          onValueChange={(sourceId) => onPickChanged({ ...pick, sourceId })}
          disabled={isDisabled}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={texts.sourceLabel(groupLabel)}
            {...describeControlWithTheMessage('source')}
          >
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {bindingOptions.dataSources.map((dataSource) => (
              <SelectItem key={dataSource.id} value={dataSource.id}>
                {dataSource.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {pick.pickedBy === 'number' && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${controlId}-car-number`}>{texts.carNumberLabel(groupLabel)}</Label>
          <Input
            id={`${controlId}-car-number`}
            inputMode="numeric"
            autoComplete="off"
            disabled={isDisabled}
            value={pick.carNumberText}
            {...describeControlWithTheMessage('carNumber')}
            onChange={(event) => onPickChanged({ ...pick, carNumberText: event.target.value })}
          />
        </div>
      )}

      {pick.pickedBy === 'place' && (
        <Select
          value={pick.placeNumber === undefined ? '' : String(pick.placeNumber)}
          onValueChange={(placeText) => onPickChanged({ ...pick, placeNumber: Number(placeText) })}
          disabled={isDisabled}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={texts.placeLabel(groupLabel)}
            {...describeControlWithTheMessage('place')}
          >
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {placeNumbersOffered.map((placeNumber) => (
              <SelectItem key={placeNumber} value={String(placeNumber)}>
                {texts.placeOption(placeNumber)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={pick.isLive ? 'live' : 'frozen'}
        onValueChange={(choice) => onPickChanged({ ...pick, isLive: choice === 'live' })}
        disabled={isDisabled}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={texts.whenLabel(groupLabel)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="live">{editorTexts.whenOptions.live}</SelectItem>
          <SelectItem value="frozen">{editorTexts.whenOptions.frozen}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
