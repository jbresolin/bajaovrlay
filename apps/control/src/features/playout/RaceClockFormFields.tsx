import { Controller, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';

import { buildErrorAttributesForControl, FormFieldRow } from './FormFieldRow';
import { clockModes, flagStates, type RaceClockTakeFormValues } from './raceClockTakeForm';

// Each control's id, used to tie its label and its error message to it.
const controlIds = {
  sessionName: 'race-clock-session-name',
  state: 'race-clock-state',
  clockMode: 'race-clock-clock-mode',
  running: 'race-clock-running',
  referenceTime: 'race-clock-reference-time',
  lapsCompletedByLeader: 'race-clock-laps-completed-by-leader',
} as const;

/**
 * The six fields of the race clock form, in the order the operator fills them. Text
 * fields are registered with react-hook-form directly; the dropdowns and the switch are
 * shadcn/ui controls with no native input to register, so each sits in a `Controller`
 * that passes the form's value in and the operator's choice out.
 */
export function RaceClockFormFields(props: { form: UseFormReturn<RaceClockTakeFormValues> }) {
  const { control, register, formState } = props.form;
  const fieldLabels = ptBR.playout.fields;
  const errorMessages = {
    sessionName: formState.errors.sessionName?.message,
    state: formState.errors.state?.message,
    clockMode: formState.errors.clockMode?.message,
    running: formState.errors.running?.message,
    referenceTime: formState.errors.referenceTime?.message,
    lapsCompletedByLeader: formState.errors.lapsCompletedByLeader?.message,
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <FormFieldRow
          label={fieldLabels.sessionName}
          controlId={controlIds.sessionName}
          errorMessage={errorMessages.sessionName}
        >
          <Input
            id={controlIds.sessionName}
            autoComplete="off"
            {...buildErrorAttributesForControl(controlIds.sessionName, errorMessages.sessionName)}
            {...register('sessionName')}
          />
        </FormFieldRow>
      </div>

      <FormFieldRow
        label={fieldLabels.state}
        controlId={controlIds.state}
        errorMessage={errorMessages.state}
      >
        <Controller
          control={control}
          name="state"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={controlIds.state}
                className="w-full"
                {...buildErrorAttributesForControl(controlIds.state, errorMessages.state)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {flagStates.map((flagState) => (
                  <SelectItem key={flagState} value={flagState}>
                    {ptBR.playout.flagStateLabels[flagState]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>

      <FormFieldRow
        label={fieldLabels.clockMode}
        controlId={controlIds.clockMode}
        errorMessage={errorMessages.clockMode}
      >
        <Controller
          control={control}
          name="clockMode"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={controlIds.clockMode}
                className="w-full"
                {...buildErrorAttributesForControl(controlIds.clockMode, errorMessages.clockMode)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clockModes.map((clockMode) => (
                  <SelectItem key={clockMode} value={clockMode}>
                    {ptBR.playout.clockModeLabels[clockMode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>

      <FormFieldRow
        label={fieldLabels.referenceTime}
        controlId={controlIds.referenceTime}
        errorMessage={errorMessages.referenceTime}
      >
        <Input
          id={controlIds.referenceTime}
          autoComplete="off"
          inputMode="numeric"
          {...buildErrorAttributesForControl(controlIds.referenceTime, errorMessages.referenceTime)}
          {...register('referenceTime')}
        />
      </FormFieldRow>

      <FormFieldRow
        label={fieldLabels.lapsCompletedByLeader}
        controlId={controlIds.lapsCompletedByLeader}
        errorMessage={errorMessages.lapsCompletedByLeader}
      >
        <Input
          id={controlIds.lapsCompletedByLeader}
          autoComplete="off"
          inputMode="numeric"
          {...buildErrorAttributesForControl(
            controlIds.lapsCompletedByLeader,
            errorMessages.lapsCompletedByLeader,
          )}
          {...register('lapsCompletedByLeader')}
        />
      </FormFieldRow>

      <div className="col-span-2">
        <FormFieldRow
          label={fieldLabels.running}
          controlId={controlIds.running}
          errorMessage={errorMessages.running}
        >
          <Controller
            control={control}
            name="running"
            render={({ field }) => (
              <Switch
                id={controlIds.running}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </FormFieldRow>
      </div>
    </div>
  );
}
