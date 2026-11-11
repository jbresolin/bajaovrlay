import type { EventRule, Graphic, Item } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand } from '@/state/ControlPageStateProvider';

const texts = ptBR.events.rules;

/**
 * The template part of a rule's row in "Regras" (BAJAOVRLAY-67): "Aparece como: …" (the
 * template the rule names as the server holds it), "Editar aparência" (the item editor on
 * it), "Prévia" (previewItem, filled from the sample of the row's kind), and a new template
 * on a graphic chosen beside "+ Novo modelo". "Trocar" belongs to the row's form, which
 * "Salvar" sends whole (EventRuleRow.tsx).
 */
export function EventRuleTemplateControls(props: {
  rule: EventRule;
  kindName: string;
  /** The template the rule names now, or undefined when it names none (or one deleted). */
  templateOfTheRule: Item | undefined;
  graphicsForANewTemplate: Graphic[];
  onEditTemplate: (template: Item) => void;
  onNewTemplate: (graphic: Graphic) => void;
}) {
  const { rule, kindName, templateOfTheRule } = props;
  const sendCommand = useSendCommand();
  const [graphicIdOfTheNewTemplate, setGraphicIdOfTheNewTemplate] = useState('');
  const graphicOfTheNewTemplate = props.graphicsForANewTemplate.find(
    (graphic) => graphic.id === graphicIdOfTheNewTemplate,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm">
          {texts.appearsAs(templateOfTheRule?.label ?? texts.noTemplate)}
        </p>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={templateOfTheRule === undefined}
          onClick={() => {
            if (templateOfTheRule !== undefined) {
              props.onEditTemplate(templateOfTheRule);
            }
          }}
        >
          {texts.editLookButton}
        </Button>
        <ActionButton
          commandType="previewItem"
          type="button"
          size="xs"
          variant="outline"
          disabled={templateOfTheRule === undefined}
          onClick={() => {
            if (templateOfTheRule !== undefined) {
              void sendCommand({
                type: 'previewItem',
                itemId: templateOfTheRule.id,
                origin: 'manual',
                sampleEventKind: rule.kind,
              });
            }
          }}
        >
          {texts.previewButton}
        </ActionButton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={graphicIdOfTheNewTemplate} onValueChange={setGraphicIdOfTheNewTemplate}>
          <SelectTrigger
            size="sm"
            className="min-w-40 flex-1"
            aria-label={texts.newTemplateGraphicLabel(kindName)}
          >
            <SelectValue placeholder={texts.newTemplateGraphicPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {props.graphicsForANewTemplate.map((graphic) => (
              <SelectItem key={graphic.id} value={graphic.id}>
                {graphic.manifest.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={graphicOfTheNewTemplate === undefined}
          onClick={() => {
            if (graphicOfTheNewTemplate !== undefined) {
              props.onNewTemplate(graphicOfTheNewTemplate);
            }
          }}
        >
          {texts.newTemplateButton}
        </Button>
      </div>
    </div>
  );
}
