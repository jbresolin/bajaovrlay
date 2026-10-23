import { useState } from 'react';

import { useTakeThenPreviewNextItem } from '@/features/autoPreview/useTakeThenPreviewNextItem';
import { ActionButton } from '@/features/connection/ActionButton';
import { EventsTab } from '@/features/events/EventsTab';
import { countPendingEvents } from '@/features/events/inboxEventLists';
import { useEventSoundSetting } from '@/features/events/useEventSoundSetting';
import { usePendingEventAlert } from '@/features/events/usePendingEventAlert';
import { MacroGrid } from '@/features/macros/MacroGrid';
import { useStopRunningMacroKey } from '@/features/macros/useStopRunningMacroKey';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { PanelNameForm } from './PanelNameForm';
import { QuickFirePanelView } from './QuickFirePanelView';
import { useQuickFireTabChoice } from './QuickFireTabChoiceProvider';
import { buildQuickFireTabId, QuickFireTabList, quickFireTabPanelId } from './QuickFireTabList';
import { chooseTabShown, isSameQuickFireTab, listQuickFireTabsInOrder } from './quickFireTabs';
import { useQuickFireKeys } from './useQuickFireKeys';

const texts = ptBR.quickFire;

/**
 * The quick-fire strip, in the right column above the layer panel: a tab per quick-fire
 * panel (in the panels' order), "Macros" and "Eventos"; under the tabs, the panel's grid of
 * item buttons, the grid of macros, or the event inbox (features/events). The "Eventos"
 * tab's badge and its alert live here, so a new pending event is heard and seen whatever
 * tab is shown. The digits 1–9 fire the first nine buttons of the tab
 * shown and F1–F4 show the first four tabs (useQuickFireKeys.ts); P stops the running
 * macro from any tab (features/macros/useStopRunningMacroKey.ts).
 *
 * The tab shown is this page's own choice (two operators may look at different tabs),
 * kept for the whole page by QuickFireTabChoiceProvider so "Edição rápida" can read it;
 * when its panel is deleted the strip falls back to the first tab (quickFireTabs.ts).
 * A button's take goes through the page's one take path (features/autoPreview), the same
 * as Space and "Disparar"; since a panel item never moves the rundown's cursor (the
 * server's rule), no automatic preview ever follows it.
 *
 * Refusals of the commands sent from here are shown at the bottom of the strip. A
 * refused `takeItem` or `previewItem` also shows in the rundown column, which lists the
 * same two types: the page keeps one last refusal per type and cannot tell which button
 * sent it, so it is shown where either kind of button lives.
 */
export function QuickFireStrip() {
  const panels = useServerState((state) => state.quickFirePanels);
  const events = useServerState((state) => state.events);
  const { isEventSoundOn, chooseIsEventSoundOn } = useEventSoundSetting();
  const pendingEventCount = countPendingEvents(events);
  const isEventBadgePulsing = usePendingEventAlert(pendingEventCount, isEventSoundOn);
  const sendCommand = useSendCommand();
  const sendTakeByThisOperator = useTakeThenPreviewNextItem();
  const { chosenTab, chooseTab: setChosenTab } = useQuickFireTabChoice();
  const [isCreatingPanel, setIsCreatingPanel] = useState(false);

  const tabs = listQuickFireTabsInOrder(panels);
  const tabShown = chooseTabShown(tabs, chosenTab);
  const tabShownPosition = tabs.findIndex((tab) => isSameQuickFireTab(tab, tabShown));
  const panelShown =
    tabShown.kind === 'panel' ? panels.find((panel) => panel.id === tabShown.panelId) : undefined;

  useQuickFireKeys({ tabs, tabShown, chooseTab: setChosenTab, sendTakeByThisOperator });
  useStopRunningMacroKey();

  function createPanel(panelName: string): void {
    setIsCreatingPanel(false);
    void sendCommand({ type: 'createQuickFirePanel', name: panelName });
  }

  return (
    <section aria-label={texts.areaTitle} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{texts.areaTitle}</h2>
      <div className="flex flex-wrap items-center gap-1">
        <QuickFireTabList
          tabs={tabs}
          tabShown={tabShown}
          panels={panels}
          onTabChosen={setChosenTab}
          pendingEventCount={pendingEventCount}
          isEventBadgePulsing={isEventBadgePulsing}
        />
        <ActionButton size="xs" variant="outline" onClick={() => setIsCreatingPanel(true)}>
          {texts.addPanelButton}
        </ActionButton>
      </div>

      {isCreatingPanel ? (
        <PanelNameForm
          controlId="quick-fire-new-panel"
          fieldLabel={texts.newPanelNameLabel}
          submitButtonText={texts.createPanelButton}
          initialName=""
          onNameSubmitted={createPanel}
          onCancel={() => setIsCreatingPanel(false)}
        />
      ) : null}

      <div
        role="tabpanel"
        id={quickFireTabPanelId}
        aria-labelledby={buildQuickFireTabId(tabShownPosition)}
      >
        {tabShown.kind === 'events' ? (
          <EventsTab isEventSoundOn={isEventSoundOn} chooseIsEventSoundOn={chooseIsEventSoundOn} />
        ) : null}
        {tabShown.kind === 'macros' ? <MacroGrid /> : null}
        {panelShown === undefined ? null : (
          // The key gives each panel its own rename form, so one left open does not
          // follow the operator to another tab.
          <QuickFirePanelView
            key={panelShown.id}
            panel={panelShown}
            sendTakeByThisOperator={sendTakeByThisOperator}
          />
        )}
      </div>

      <CommandErrorMessage
        commandTypes={[
          'takeItem',
          'previewItem',
          'moveItemToHome',
          'createQuickFirePanel',
          'renameQuickFirePanel',
          'deleteQuickFirePanel',
          'runMacro',
          'previewMacro',
          'stopMacro',
          'createMacro',
          'updateMacro',
          'deleteMacro',
          'showEvent',
          'dismissEvent',
        ]}
      />
    </section>
  );
}
