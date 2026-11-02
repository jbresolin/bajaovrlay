import type { CommandInput, ObsSceneSwitch, ObsStatus } from '@bajaovrlay/shared';
import { EventSubscription, OBSWebSocket } from 'obs-websocket-js/json';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { obsConnectionActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { ptBR } from '../../core/messages/ptBR.js';
import {
  buildConnectedStatusFromObsAnswers,
  describeObsAddress,
  describeWhyTheConnectionFailed,
  describeWhyTheSwitchFailed,
  ObsAnswerTooLateError,
  ObsConnectionGoneError,
} from './obsAnswers.js';

/** BAJAOVRLAY_OBS_URL and BAJAOVRLAY_OBS_PASSWORD as read at boot. */
export type ObsConnectionSettings = {
  /** `ws://127.0.0.1:4455`, as OBS's WebSocket Server Settings show it. */
  url: string;
  /** Undefined when OBS's authentication is off. Never logged. */
  password: string | undefined;
};

/** What the connection needs; the two timer functions default to Node's own. */
export type ObsConnectionOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  settings: ObsConnectionSettings;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running connection; stop() hangs up on OBS and calls every wait off. */
export type ObsConnection = { stop: () => Promise<void> };

/** How long the server waits between two attempts to reach OBS. */
const delayBetweenAttemptsInMilliseconds = 5_000;

/**
 * How long OBS has to answer one request. OBS runs on the same machine and answers in
 * milliseconds; a request unanswered after 3 s means OBS is frozen, and a macro waiting
 * on a switch must not wait for ever (its watchdog would end it only after 30 s).
 */
const timeObsHasToAnswerInMilliseconds = 3_000;

// The events after which the server reads OBS's scenes anew: a scene switched, lined up
// on Preview, added, removed or renamed, the list reordered, Studio Mode on or off. The
// first six are in OBS's Scenes category, the last in its Ui category, the two the
// connection subscribes to.
const eventsThatChangeWhatTheTallyShows = [
  'CurrentProgramSceneChanged',
  'CurrentPreviewSceneChanged',
  'SceneListChanged',
  'SceneNameChanged',
  'SceneCreated',
  'SceneRemoved',
  'StudioModeStateChanged',
] as const;

/** One attempt's client, and whether OBS let it in (Identified). */
type ObsSession = { client: OBSWebSocket; isIdentified: boolean };

/** A request waiting for OBS's answer, so a drop or a stop can settle it at once. */
type RequestWaitingForObs = { timerHandle: unknown; failWith: (error: Error) => void };

/**
 * Starts the server's one connection to OBS (obs-websocket v5) and keeps it up: it fills
 * the `obs` slice with recordObsState, signed `sistema:obs`, from OBS's events (never by
 * polling), and carries out every switchObsScene the store records, answering with
 * recordObsSceneSwitchAnswer. The slice says `conectando` until the first attempt ends.
 *
 * When an attempt fails or OBS drops, the slice says `erro` with the reason in pt-BR, its
 * scenes are emptied, a switch waiting for its answer is answered refused at once, and
 * the next attempt starts 5 s later, for as long as the server runs. A log line is
 * written when the connection is made, when it drops (or the first attempt fails) and
 * when it is back, never one per attempt. Back, everything is read anew.
 *
 * Deliberate trade-offs:
 * - Nothing else waits for OBS: commands, pollers and the renderer never block on it, and
 *   an OBS that is down only refuses switches (rule 4).
 * - Every event reads the whole list and Studio Mode again instead of patching the slice
 *   from the event's own data: two short requests on the same machine, and the slice
 *   can never drift from OBS. Reads run one at a time; an event during a read asks for
 *   one more read after it.
 * - The password goes to the client only; no log line and no slice field carries it.
 */
export function startObsConnection(options: ObsConnectionOptions): ObsConnection {
  const { stateStore, logger, settings } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const address = describeObsAddress(settings.url);
  let session: ObsSession | undefined;
  let lastError: string | null = null;
  let isStopped = false;
  let hasEverConnected = false;
  let isThisSpellOfFailuresLogged = false;
  let nextAttemptTimerHandle: unknown;
  let isReadingScenes = false;
  let isAnotherReadWanted = false;
  let numberOfTheLastSwitchTakenOn = 0;
  const requestsWaitingForObs = new Set<RequestWaitingForObs>();

  /** Sends one of the connection's reports through the store's one path; never throws. */
  function sendReport(command: CommandInput): void {
    if (isStopped) {
      return;
    }
    try {
      stateStore.applyCommand(command, obsConnectionActor);
    } catch (reportError) {
      logger.error({ err: reportError, command: command.type }, 'OBS report could not be saved');
    }
  }

  /** Reports OBS as not connected in this state: no scenes, no Program, no Preview. */
  function reportWithoutScenes(connectionState: ObsStatus['connectionState']): void {
    const status: ObsStatus = {
      connectionState,
      address,
      lastError,
      sceneNames: [],
      programSceneName: null,
      isStudioModeOn: false,
      previewSceneName: null,
    };
    sendReport({ type: 'recordObsState', status });
  }

  /** One attempt: a fresh client, so no listener of an older attempt can fire. */
  async function attemptToConnect(): Promise<void> {
    nextAttemptTimerHandle = undefined;
    if (isStopped) {
      return;
    }
    const attempt: ObsSession = { client: new OBSWebSocket(), isIdentified: false };
    session = attempt;
    attempt.client.on('ConnectionClosed', () => handleDrop(attempt));
    for (const eventName of eventsThatChangeWhatTheTallyShows) {
      attempt.client.on(eventName, () => void readScenesAndReportThem(attempt));
    }
    try {
      await attempt.client.connect(settings.url, settings.password, {
        rpcVersion: 1,
        eventSubscriptions: EventSubscription.Scenes | EventSubscription.Ui,
      });
    } catch (connectError) {
      if (session === attempt && !isStopped) {
        session = undefined;
        const reason = describeWhyTheConnectionFailed(
          connectError,
          settings.password !== undefined,
          address,
        );
        handleFailedAttempt(reason);
      }
      return;
    }
    if (session !== attempt || isStopped) {
      await disconnectQuietly(attempt.client);
      return;
    }
    attempt.isIdentified = true;
    if (!hasEverConnected) {
      logger.info({ obs_address: address }, 'connected to OBS');
    } else if (isThisSpellOfFailuresLogged) {
      logger.info({ obs_address: address }, 'OBS connection is back');
    }
    hasEverConnected = true;
    isThisSpellOfFailuresLogged = false;
    await readScenesAndReportThem(attempt);
  }

  /** An attempt that did not get in: `erro` with its reason, and the next attempt in 5 s. */
  function handleFailedAttempt(reason: string): void {
    lastError = reason;
    reportWithoutScenes('erro');
    if (!isThisSpellOfFailuresLogged) {
      logger.warn({ obs_address: address, reason }, 'cannot connect to OBS; trying again every 5 s');
      isThisSpellOfFailuresLogged = true;
    }
    planTheNextAttempt();
  }

  /** A connection that was in and closed: the drop is reported, a waiting switch answered. */
  function handleDrop(droppedSession: ObsSession): void {
    if (!droppedSession.isIdentified || session !== droppedSession || isStopped) {
      return;
    }
    session = undefined;
    lastError = ptBR.obs.connectionDropped;
    settleEveryRequestWaitingForObs();
    reportWithoutScenes('erro');
    logger.warn({ obs_address: address }, 'OBS connection dropped; trying again every 5 s');
    isThisSpellOfFailuresLogged = true;
    planTheNextAttempt();
  }

  function planTheNextAttempt(): void {
    if (isStopped) {
      return;
    }
    nextAttemptTimerHandle = startTimer(
      () => void attemptToConnect(),
      delayBetweenAttemptsInMilliseconds,
    );
  }

  /**
   * Reads the scene list and Studio Mode and reports them whole, one read at a time. A
   * read that fails or comes too late hangs up, so the drop is reported and the next
   * attempt reads everything anew: a tally half read is worse than none.
   */
  async function readScenesAndReportThem(readSession: ObsSession): Promise<void> {
    if (!readSession.isIdentified) {
      return;
    }
    if (isReadingScenes) {
      isAnotherReadWanted = true;
      return;
    }
    isReadingScenes = true;
    try {
      do {
        isAnotherReadWanted = false;
        const [sceneListAnswer, studioModeAnswer] = await Promise.all([
          askObs(readSession, 'GetSceneList', undefined),
          askObs(readSession, 'GetStudioModeEnabled', undefined),
        ]);
        if (session !== readSession) {
          return;
        }
        const status = buildConnectedStatusFromObsAnswers({
          address,
          lastError,
          sceneListAnswer,
          studioModeAnswer,
        });
        sendReport({ type: 'recordObsState', status });
      } while (isAnotherReadWanted);
    } catch (readError) {
      if (session === readSession) {
        logger.warn({ err: readError, obs_address: address }, 'OBS scenes could not be read');
        await disconnectQuietly(readSession.client);
      }
    } finally {
      isReadingScenes = false;
    }
  }

  /** Sends one request and resolves with OBS's answer, or rejects after 3 s or a drop. */
  function askObs(
    askedSession: ObsSession,
    requestType: 'GetSceneList' | 'GetStudioModeEnabled' | 'SetCurrentProgramScene' | 'SetCurrentPreviewScene',
    requestData: { sceneName: string } | undefined,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const waitingRequest: RequestWaitingForObs = {
        timerHandle: undefined,
        failWith: (error) => {
          requestsWaitingForObs.delete(waitingRequest);
          cancelTimer(waitingRequest.timerHandle);
          reject(error);
        },
      };
      waitingRequest.timerHandle = startTimer(
        () => waitingRequest.failWith(new ObsAnswerTooLateError(requestType)),
        timeObsHasToAnswerInMilliseconds,
      );
      requestsWaitingForObs.add(waitingRequest);
      const request = askedSession.client.call(requestType, requestData as never);
      request.then(
        (answer) => {
          if (requestsWaitingForObs.delete(waitingRequest)) {
            cancelTimer(waitingRequest.timerHandle);
            resolve(answer);
          }
        },
        (requestError: unknown) => {
          if (requestsWaitingForObs.has(waitingRequest)) {
            waitingRequest.failWith(
              requestError instanceof Error ? requestError : new Error(String(requestError)),
            );
          }
        },
      );
    });
  }

  /** Fails every request still waiting for OBS: the connection they were sent on is gone. */
  function settleEveryRequestWaitingForObs(): void {
    for (const waitingRequest of [...requestsWaitingForObs]) {
      waitingRequest.failWith(new ObsConnectionGoneError());
    }
  }

  /** Asks OBS for a switch the store recorded, and reports OBS's answer. Never throws. */
  async function carryOutSwitch(sceneSwitch: ObsSceneSwitch): Promise<void> {
    const requestType =
      sceneSwitch.target === 'program' ? 'SetCurrentProgramScene' : 'SetCurrentPreviewScene';
    let refusalReason: string | null = null;
    try {
      if (session === undefined || !session.isIdentified) {
        throw new ObsConnectionGoneError();
      }
      await askObs(session, requestType, { sceneName: sceneSwitch.sceneName });
    } catch (switchError) {
      refusalReason = describeWhyTheSwitchFailed(switchError, sceneSwitch.sceneName);
      logger.warn(
        { obs_address: address, scene_name: sceneSwitch.sceneName, reason: refusalReason },
        'OBS did not switch the scene',
      );
    }
    sendReport({
      type: 'recordObsSceneSwitchAnswer',
      number: sceneSwitch.number,
      isDone: refusalReason === null,
      refusalReason,
    });
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (!changedSliceNames.includes('obs')) {
      return;
    }
    const sceneSwitch = slices.obs.sceneSwitch;
    const isNewSwitchToCarryOut =
      sceneSwitch !== null &&
      sceneSwitch.status === 'enviada' &&
      sceneSwitch.number > numberOfTheLastSwitchTakenOn;
    if (isNewSwitchToCarryOut) {
      numberOfTheLastSwitchTakenOn = sceneSwitch.number;
      // Carried out after this listener returns: its answer is a command, and a command
      // sent from inside a listener would reach the listeners after it before this one.
      queueMicrotask(() => void carryOutSwitch(sceneSwitch));
    }
  });

  reportWithoutScenes('conectando');
  void attemptToConnect();

  return {
    stop: async () => {
      isStopped = true;
      stopWatchingTheStore();
      if (nextAttemptTimerHandle !== undefined) {
        cancelTimer(nextAttemptTimerHandle);
        nextAttemptTimerHandle = undefined;
      }
      settleEveryRequestWaitingForObs();
      const sessionToClose = session;
      session = undefined;
      if (sessionToClose !== undefined) {
        await disconnectQuietly(sessionToClose.client);
      }
    },
  };
}

/** Hangs up on OBS; a socket already gone is not an error worth reporting. */
async function disconnectQuietly(client: OBSWebSocket): Promise<void> {
  try {
    await client.disconnect();
  } catch {
    // Already closed: there is nothing left to hang up.
  }
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout, for a handle startNodeTimer returned. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as NodeJS.Timeout);
}
