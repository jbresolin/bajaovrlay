import type { CarGroup } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { readAgreementOfCarGroupFields } from './carGroupChoice';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.carGroups;

/**
 * The lines that say why a group's fields are separate, when they do not follow one car,
 * and how to group them again: choosing a way, which fills every field alike.
 */
export function SeparateFieldsNote(props: { carGroup: CarGroup; formValues: SchemaFormValues }) {
  const agreement = readAgreementOfCarGroupFields(props.carGroup, props.formValues);
  const groupLabel = props.carGroup.label;
  let whyNote: string | undefined;
  if (agreement.status === 'differentCars') {
    whyNote = texts.differentCarsNote(groupLabel);
  } else if (agreement.status === 'notOnePick') {
    whyNote = texts.notOnePickNote(groupLabel);
  }
  if (whyNote === undefined) {
    return null;
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">{whyNote}</p>
      <p className="text-sm text-muted-foreground">{texts.chooseWayToGroupNote(groupLabel)}</p>
    </>
  );
}
