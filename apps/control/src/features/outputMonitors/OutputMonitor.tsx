import { listOutputsProgramFirst, type Output, programOutputId } from '@bajaovrlay/shared';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import {
  readOutputOfMonitorFromBrowserStorage,
  writeOutputOfMonitorToBrowserStorage,
} from './monitoredOutputInBrowserStorage';

/** The two outputs a monitor can frame: what is on air, and what is being looked at first. */
export type MonitoredOutput = 'program' | 'preview';

/**
 * The renderer page each monitor frames. `monitor=1` makes that page connect without the
 * renderer role and never report an instance's status: only the program output (what OBS
 * loads, `/render/` with nothing after it) is the truth about what is on air. Without
 * the mark the "Programa" frame would turn the layer badge to "No ar" with OBS switched
 * off, and a fault in that frame alone would turn it to "Falhou" while the stream is
 * fine. `target=preview` makes the page draw the preview output instead of the program
 * output. What could go wrong: the renderer page only understands these exact words, so
 * a typo here silently gives a page that draws the program output, or reports like OBS.
 * An output other than program (BAJAOVRLAY-49) adds `&output=<id>`: the renderer passes it
 * on and the server sends that frame only the output's layers.
 */
const rendererPageAddressOfOutput: Record<MonitoredOutput, string> = {
  program: '/render/?monitor=1',
  preview: '/render/?target=preview&monitor=1',
};

const titleOfOutput: Record<MonitoredOutput, string> = {
  program: ptBR.outputMonitors.programTitle,
  preview: ptBR.outputMonitors.previewTitle,
};

// The size the renderer page is laid out at inside the frame: the stream's own, so a
// graphic is drawn in the monitor exactly as OBS draws it, only smaller.
const streamWidthInPixels = 1920;
const streamHeightInPixels = 1080;

/**
 * Shows the operator one output: the renderer page itself in a frame, drawing the same
 * state from its own connection to the server, so "Prévia" and "Programa" are the very
 * pixels OBS shows. The box is `widthInPixels` wide and always 16:9. The frame inside
 * stays 1920x1080, the size the renderer draws at, and is scaled down by
 * `widthInPixels / 1920` (a quarter in a 480 px box), so it fills the box exactly at any
 * width. PreviewAndProgramMonitors.tsx gives both monitors the same width.
 * With more than one output a picker beside the title chooses which output's page the
 * frame loads: program by default, the choice kept in this browser
 * (monitoredOutputInBrowserStorage.ts); a kept output that no longer exists is program.
 */
export function OutputMonitor(props: {
  output: MonitoredOutput;
  widthInPixels: number;
  /** Every output of the show (the server's `outputs` slice); with one, no picker. */
  outputs: Output[];
}) {
  const title = titleOfOutput[props.output];
  const scaleThatFitsTheFrameInTheBox = props.widthInPixels / streamWidthInPixels;
  const { outputs } = props;
  const [chosenOutputId, setChosenOutputId] = useState(
    () => readOutputOfMonitorFromBrowserStorage(props.output) ?? programOutputId,
  );
  const isChosenOutputListed = outputs.some((output) => output.outputId === chosenOutputId);
  const shownOutputId = isChosenOutputListed ? chosenOutputId : programOutputId;
  const isPickerOffered = outputs.length > 1;
  const outputQuery =
    shownOutputId === programOutputId ? '' : `&output=${encodeURIComponent(shownOutputId)}`;

  function chooseOutput(outputId: string): void {
    setChosenOutputId(outputId);
    writeOutputOfMonitorToBrowserStorage(props.output, outputId);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {isPickerOffered && (
          <Select value={shownOutputId} onValueChange={chooseOutput}>
            <SelectTrigger
              size="sm"
              className="h-7 w-36"
              aria-label={ptBR.outputs.outputPickerLabel(title)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {listOutputsProgramFirst(outputs).map((output) => (
                <SelectItem key={output.outputId} value={output.outputId}>
                  {output.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {/* The muted background stands in for the video: the renderer page is transparent.
          `aspect-video` is 16:9: the height always follows the width. */}
      <div
        className="aspect-video overflow-hidden rounded-md border bg-muted"
        style={{ width: props.widthInPixels }}
      >
        {/* pointer-events-none: the monitor is for looking, clicks must not land in it.
            max-w-none: the frame must stay 1920 px wide inside a box that is narrower. */}
        <iframe
          src={`${rendererPageAddressOfOutput[props.output]}${outputQuery}`}
          title={title}
          width={streamWidthInPixels}
          height={streamHeightInPixels}
          className="pointer-events-none max-w-none origin-top-left border-0"
          style={{ transform: `scale(${scaleThatFitsTheFrameInTheBox})` }}
        />
      </div>
    </section>
  );
}
