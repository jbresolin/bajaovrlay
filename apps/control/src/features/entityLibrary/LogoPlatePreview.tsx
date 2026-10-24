import { buildMediaUrl } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.entityLibrary.logoPlate;

/**
 * A team's or a sponsor's logo twice, side by side: on the on-air panel's slate as it is,
 * and on the light plate the team card or the sponsor bug puts it on when "Logo sobre
 * placa clara" is ticked (BAJAOVRLAY-24, and for sponsors BAJAOVRLAY-23). A dark logo, or
 * one on its own white box, reads badly on the slate and well on the plate; seeing both is
 * how the operator decides, since nothing detects it.
 * The two surfaces are the control page's `on-air-panel` and `on-air-plate` tokens
 * (index.css), stand-ins for the theme's `--panel-base` and `--panel-light`.
 */
export function LogoPlatePreview(props: { logoMediaId: string }) {
  if (props.logoMediaId === '') {
    return <p className="text-xs text-muted-foreground">{texts.sendTheLogoFirst}</p>;
  }
  const logoAddress = buildMediaUrl(props.logoMediaId);
  return (
    <div className="flex gap-3">
      <figure className="flex flex-col items-center gap-1">
        <div className="flex h-20 w-20 items-center justify-center rounded bg-on-air-panel p-2">
          <img src={logoAddress} alt={texts.onThePanelAlt} className="max-h-full object-contain" />
        </div>
        <figcaption className="text-xs text-muted-foreground">{texts.onThePanelCaption}</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <div className="flex h-20 w-20 items-center justify-center rounded bg-on-air-panel p-2">
          <div className="flex h-full w-full items-center justify-center rounded-sm bg-on-air-plate p-1">
            <img
              src={logoAddress}
              alt={texts.onThePlateAlt}
              className="max-h-full object-contain"
            />
          </div>
        </div>
        <figcaption className="text-xs text-muted-foreground">{texts.onThePlateCaption}</figcaption>
      </figure>
    </div>
  );
}
