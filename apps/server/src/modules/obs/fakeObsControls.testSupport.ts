// Test support: what a test can set up, do and read with the fake OBS
// (openFakeObs.testSupport.ts), kept apart so the fake's own file holds only
// how it speaks the protocol. Every "ByHand" call does what a person working OBS does,
// and the fake sends the events real OBS sends for it.

/** What the fake OBS starts with. */
export type FakeObsSetup = {
  /** Null: OBS's "Enable Authentication" is off. */
  password: string | null;
  /** The scenes as the Scenes panel lists them, top first. */
  sceneNames: string[];
  programSceneName: string;
  isStudioModeOn: boolean;
  /** Only read while Studio Mode is on. */
  previewSceneName: string;
};

/** One request a client sent, as the fake received it. */
export type RequestReceivedByFakeObs = { requestType: string; requestData: unknown };

/** The fake OBS a test drives, and what it saw. */
export type FakeObs = {
  /** `ws://127.0.0.1:<port>`, for BAJAOVRLAY_OBS_URL. */
  address: string;
  /** Every request received, in order. */
  readRequestsReceived: () => RequestReceivedByFakeObs[];
  /**
   * Resolves once this many requests of this type were received, one when left out (at
   * once if they already were).
   */
  waitForRequest: (requestType: string, numberOfRequests?: number) => Promise<void>;
  /** How many connection attempts were refused while OBS was closed. */
  countAttemptsRefusedWhileClosed: () => number;
  /** Resolves once this many attempts were refused while closed (counting from the start). */
  waitForAttemptsRefusedWhileClosed: (numberOfAttempts: number) => Promise<void>;
  /** How many clients are identified now. */
  countIdentifiedClients: () => number;
  /**
   * Resolves once no client is connected (at once if none is). A client's own hang-up
   * ends before OBS's side of the socket has closed, so a test waits for OBS's side.
   */
  waitUntilNoClientIsConnected: () => Promise<void>;
  /** Puts a scene on Program, as clicking it in OBS outside Studio Mode does. */
  switchProgramSceneByHand: (sceneName: string) => void;
  /** Lines a scene up on Preview, as clicking it in OBS in Studio Mode does. */
  switchPreviewSceneByHand: (sceneName: string) => void;
  /** Renames a scene, as OBS's "Rename" does. */
  renameSceneByHand: (oldSceneName: string, newSceneName: string) => void;
  /** Adds a scene at the top of the Scenes panel, as OBS's "+" does. */
  addSceneByHand: (sceneName: string) => void;
  /**
   * Deletes a scene and tells no one, as when it is deleted in the very moment a switch
   * to it is on its way: the server still lists it, OBS no longer has it.
   */
  removeSceneWithoutAnEvent: (sceneName: string) => void;
  /** Turns Studio Mode on (Preview then shows the Program scene) or off. */
  setStudioModeByHand: (isStudioModeOn: boolean) => void;
  /**
   * From now on, holds back the answer to every scene switch, as an OBS frozen by a heavy
   * scene would; the switch is still made.
   */
  stopAnsweringSceneSwitches: () => void;
  /**
   * From now on, takes new connections and never sends them Hello, as an OBS frozen while
   * starting does; the client waits for a greeting that never comes. Until greetNewConnectionsAgain().
   */
  stopGreetingNewConnections: () => void;
  /** Sends Hello to new connections again (those already left waiting stay waiting). */
  greetNewConnectionsAgain: () => void;
  /** Resolves once this many connections were taken and left without Hello. */
  waitForConnectionsLeftWithoutHello: (numberOfConnections: number) => Promise<void>;
  /**
   * From now on, lets the server in but never answers GetSceneList, as an OBS that
   * accepts the connection and then hangs does. Until answerSceneListReadsAgain().
   */
  stopAnsweringSceneListReads: () => void;
  /** Answers GetSceneList again. */
  answerSceneListReadsAgain: () => void;
  /** OBS quits: every connection drops and new attempts are refused until reopen(). */
  close: () => void;
  /** OBS is started again, on the same port, with the same scenes. */
  reopen: () => void;
};
