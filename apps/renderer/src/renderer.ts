// Entry point of the renderer page that OBS loads as a browser source.
// For now it only finds the stage and announces it is ready; graphics arrive later.
import { logRendererEvent } from './rendererLog.js';

const stage = document.getElementById('stage');
if (stage === null) {
  logRendererEvent('error', 'renderer stage missing', { expectedElementId: 'stage' });
} else {
  logRendererEvent('info', 'renderer ready', {
    stageWidth: stage.offsetWidth,
    stageHeight: stage.offsetHeight,
  });
}
