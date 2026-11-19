import type { CarGroup, EntityLibrary } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  describeRecordOfType,
  readKeyOfRecord,
} from '@/features/entityLibrary/entityRecordsOfType';
import { listRecordsFoundBySearch } from '@/features/entityLibrary/recordSearch';
import { ptBR } from '@/i18n/ptBR';

import type { FieldOfCarGroup } from './CarGroupFields';
import { buildEntityReferenceValuesOfTeamRecord } from './carGroupTeamRecord';
import type { AttributesOfTheGroupMessage, ControlOfTheGroupMessage } from './CarPickControls';
import { EntityValueNowLine } from './EntityReferenceControls';
import { emptySchemaFormEntityReferenceValue } from './entityReferenceFormValue';

const texts = ptBR.carGroups;

/** The library the picker reads when the page has none yet: no team to list. */
const emptyEntityLibrary: EntityLibrary = {
  teams: [],
  people: [],
  sponsors: [],
  scheduleSlots: [],
};

/**
 * The team picker of a car group on "Equipe dos Cadastros" (BAJAOVRLAY-80): a search box
 * (a team by its car number, its team or its school name, as the "Cadastro" kind finds
 * it), the team found, and what each field of the group reads now from that team. The team
 * chosen stays listed whatever the search, so its name stays in the box.
 */
export function TeamRecordPickControls(props: {
  carGroup: CarGroup;
  fieldsOfTheGroup: FieldOfCarGroup[];
  /** The team chosen, by its car number as text; '' for none yet. */
  carNumberTextChosen: string;
  controlId: string;
  dataSchema: unknown;
  entityLibrary: EntityLibrary | undefined;
  isDisabled: boolean;
  /** The group message's ARIA attributes for a control, empty when it is not about it. */
  describeControlWithTheMessage: (control: ControlOfTheGroupMessage) => AttributesOfTheGroupMessage;
  onTeamChosen: (carNumberText: string) => void;
}) {
  const { carGroup, controlId, isDisabled } = props;
  const groupLabel = carGroup.label;
  const [searchText, setSearchText] = useState('');
  const entityLibrary = props.entityLibrary ?? emptyEntityLibrary;

  const teamsFound = listRecordsFoundBySearch(entityLibrary, 'team', searchText);
  const teamChosen = listRecordsFoundBySearch(entityLibrary, 'team', '').find(
    (team) => readKeyOfRecord('team', team) === props.carNumberTextChosen,
  );
  const teamsListed =
    teamChosen === undefined || teamsFound.includes(teamChosen)
      ? teamsFound
      : [teamChosen, ...teamsFound];
  const referenceValues = buildEntityReferenceValuesOfTeamRecord(
    carGroup,
    props.carNumberTextChosen,
  );

  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label={texts.teamSearchLabel(groupLabel)}
        placeholder={ptBR.entityLibrary.editor.searchPlaceholder}
        value={searchText}
        disabled={isDisabled}
        onChange={(event) => setSearchText(event.target.value)}
      />
      {teamsListed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ptBR.entityLibrary.editor.noRecordFound}</p>
      ) : (
        <Select
          value={props.carNumberTextChosen}
          onValueChange={props.onTeamChosen}
          disabled={isDisabled}
        >
          <SelectTrigger
            id={`${controlId}-team`}
            size="sm"
            className="w-full"
            aria-label={texts.teamRecordLabel(groupLabel)}
            {...props.describeControlWithTheMessage('team')}
          >
            <SelectValue placeholder={ptBR.entityLibrary.form.noChoice} />
          </SelectTrigger>
          <SelectContent>
            {teamsListed.map((team) => (
              <SelectItem key={readKeyOfRecord('team', team)} value={readKeyOfRecord('team', team)}>
                {describeRecordOfType('team', team)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {props.carNumberTextChosen !== '' && (
        <ul className="flex flex-col gap-1" aria-label={texts.valuesNowHeading}>
          {props.fieldsOfTheGroup.map(({ field }) => (
            <li key={field.key} className="flex flex-col gap-0.5">
              <span className="text-xs">{field.label}</span>
              <EntityValueNowLine
                field={field}
                dataSchema={props.dataSchema}
                entityLibrary={entityLibrary}
                referenceValue={referenceValues[field.key] ?? emptySchemaFormEntityReferenceValue}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
