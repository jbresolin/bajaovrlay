import {
  type EventLogActorKind,
  eventLogActorKindLabels,
  EventLogActorKindSchema,
  type EventLogCommandGroup,
  eventLogCommandGroupLabels,
  EventLogCommandGroupSchema,
  type EventLogFilters,
  type Layer,
  type Output,
} from '@bajaovrlay/shared';
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { listLayersInCamadasOrder } from '@/features/layers/layersInCamadasOrder';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.history.filters;

// A dropdown's value for "no filter": Radix's Select takes no empty value.
const noFilterValue = 'todos';

/**
 * The five filters of the "Histórico" page: who sent it (the kinds of sender), the type of
 * command, the layer it touched, only refusals, and a free text over the sentence. Each
 * change hands the whole new set of filters up; the page owns them.
 */
export function HistoryFilters(props: {
  filters: EventLogFilters;
  layers: Layer[];
  outputs: Output[];
  onFiltersChanged: (filters: EventLogFilters) => void;
}) {
  const { filters, onFiltersChanged } = props;
  const isOneOutputOnly = props.outputs.length <= 1;

  function chooseWho(chosenValue: string): void {
    const kind = EventLogActorKindSchema.safeParse(chosenValue);
    onFiltersChanged(replaceFilter(filters, 'who', kind.success ? kind.data : undefined));
  }

  function chooseGroup(chosenValue: string): void {
    const group = EventLogCommandGroupSchema.safeParse(chosenValue);
    onFiltersChanged(replaceFilter(filters, 'group', group.success ? group.data : undefined));
  }

  function chooseLayer(chosenValue: string): void {
    const layerId = chosenValue === noFilterValue ? undefined : chosenValue;
    onFiltersChanged(replaceFilter(filters, 'layerId', layerId));
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <FilterDropdown
        id="historico-quem"
        label={texts.whoLabel}
        value={filters.who ?? noFilterValue}
        onValueChange={chooseWho}
      >
        <SelectItem value={noFilterValue}>{texts.everyone}</SelectItem>
        {EventLogActorKindSchema.options.map((kind: EventLogActorKind) => (
          <SelectItem key={kind} value={kind}>
            {eventLogActorKindLabels[kind]}
          </SelectItem>
        ))}
      </FilterDropdown>
      <FilterDropdown
        id="historico-tipo"
        label={texts.groupLabel}
        value={filters.group ?? noFilterValue}
        onValueChange={chooseGroup}
      >
        <SelectItem value={noFilterValue}>{texts.everyGroup}</SelectItem>
        {EventLogCommandGroupSchema.options.map((group: EventLogCommandGroup) => (
          <SelectItem key={group} value={group}>
            {eventLogCommandGroupLabels[group]}
          </SelectItem>
        ))}
      </FilterDropdown>
      <FilterDropdown
        id="historico-camada"
        label={texts.layerLabel}
        value={filters.layerId ?? noFilterValue}
        onValueChange={chooseLayer}
      >
        <SelectItem value={noFilterValue}>{texts.everyLayer}</SelectItem>
        {listLayersInCamadasOrder(props.layers, props.outputs).map((layer) => (
          <SelectItem key={layer.id} value={layer.id}>
            {isOneOutputOnly
              ? layer.name
              : texts.layerOfOutput(layer.name, findOutputName(props.outputs, layer.outputId))}
          </SelectItem>
        ))}
      </FilterDropdown>
      <div className="flex items-center gap-2 pb-2">
        <Switch
          id="historico-so-recusas"
          checked={filters.onlyRefusals === true}
          onCheckedChange={(isChecked) =>
            onFiltersChanged(replaceFilter(filters, 'onlyRefusals', isChecked ? true : undefined))
          }
        />
        <Label htmlFor="historico-so-recusas">{texts.onlyRefusalsLabel}</Label>
      </div>
      <div className="flex min-w-64 flex-col gap-1">
        <Label htmlFor="historico-texto">{texts.textLabel}</Label>
        <Input
          id="historico-texto"
          type="search"
          placeholder={texts.textPlaceholder}
          value={filters.text ?? ''}
          onChange={(change) => {
            const typedText = change.target.value;
            onFiltersChanged(
              replaceFilter(filters, 'text', typedText === '' ? undefined : typedText),
            );
          }}
        />
      </div>
    </div>
  );
}

/** One labelled dropdown of the filters. */
function FilterDropdown(props: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onValueChange}>
        <SelectTrigger id={props.id} size="sm" className="min-w-40" aria-label={props.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{props.children}</SelectContent>
      </Select>
    </div>
  );
}

/**
 * The filters with one of them set to a value, or taken out when the value is undefined,
 * so a filter left open is absent (and leaves the server's query alone) rather than empty.
 */
function replaceFilter<FilterName extends keyof EventLogFilters>(
  filters: EventLogFilters,
  filterName: FilterName,
  value: EventLogFilters[FilterName] | undefined,
): EventLogFilters {
  const filtersAfter: EventLogFilters = { ...filters };
  if (value === undefined) {
    delete filtersAfter[filterName];
  } else {
    filtersAfter[filterName] = value;
  }
  return filtersAfter;
}

/** An output's name, or its id when the page does not list it. */
function findOutputName(outputs: Output[], outputId: string): string {
  return outputs.find((output) => output.outputId === outputId)?.name ?? outputId;
}
