import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.triggers.http;

/** The address of an HTTP trigger on the server this page came from. */
export function buildAddressOfHttpTrigger(origin: string, triggerId: string): string {
  return `${origin}/api/v1/triggers/${triggerId}`;
}

/** A curl that calls the address with the API's token and a flat body, as a D200 would. */
export function buildCurlExampleOfHttpTrigger(address: string): string {
  return `curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"nome": "Ana Souza"}' ${address}`;
}

/**
 * Under an HTTP trigger in the editor: its address to copy and a `curl` example, read-only
 * and selectable, and what the call may carry. The page's own origin is the server's, since
 * the server serves this page; behind a reverse proxy it is the proxy's, which is what a
 * device must call. A trigger not saved yet has no id: the page says the address comes then.
 */
export function HttpTriggerAddress(props: { triggerId: string | null }) {
  if (props.triggerId === null) {
    return <p className="text-sm text-muted-foreground">{texts.addressAfterSave}</p>;
  }
  const address = buildAddressOfHttpTrigger(window.location.origin, props.triggerId);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="http-trigger-address" className="text-xs">
          {texts.addressLabel}
        </Label>
        <Input
          id="http-trigger-address"
          readOnly
          value={address}
          onFocus={(focus) => focus.currentTarget.select()}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="http-trigger-curl" className="text-xs">
          {texts.curlLabel}
        </Label>
        <Textarea
          id="http-trigger-curl"
          readOnly
          rows={3}
          className="font-mono text-xs"
          value={buildCurlExampleOfHttpTrigger(address)}
          onFocus={(focus) => focus.currentTarget.select()}
        />
      </div>
      <p className="text-xs text-muted-foreground">{texts.explanation}</p>
    </div>
  );
}
