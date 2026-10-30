import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ptBR } from '@/i18n/ptBR';

import { copyRendererAddress } from './addressCopy';

const texts = ptBR.outputs;

/**
 * The address of one output's renderer, read-only, with "Copiar": what the operator
 * pastes into an OBS browser source. Copying sends no command, so it works without a
 * connection. One status line says whether it was copied.
 */
export function RendererAddressField(props: { address: string }) {
  const fieldId = useId();
  const addressField = useRef<HTMLInputElement>(null);
  const [copyOutcome, setCopyOutcome] = useState<'copied' | 'notCopied' | null>(null);

  async function copyTheAddress(): Promise<void> {
    const isCopied = await copyRendererAddress(props.address, addressField.current);
    setCopyOutcome(isCopied ? 'copied' : 'notCopied');
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={fieldId}>{texts.rendererAddressLabel}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          ref={addressField}
          readOnly
          value={props.address}
          className="font-mono"
        />
        <Button type="button" size="sm" variant="secondary" onClick={() => void copyTheAddress()}>
          {texts.copyAddressButton}
        </Button>
      </div>
      <p role="status" className="text-muted-foreground min-h-4 text-xs">
        {copyOutcome === 'copied' && texts.addressCopied}
        {copyOutcome === 'notCopied' && texts.addressNotCopied}
      </p>
    </div>
  );
}
