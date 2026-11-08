// Everything about the operator login (BAJAOVRLAY-29) that @bajaovrlay/shared exports. The
// package's own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The two roles, `produtor` and `dados`.
export { type OperatorRole, OperatorRoleSchema } from './operatorRole.js';
// The login body, the session as the page reads it, and GET /api/v1/session's answer.
export {
  type LoginRequest,
  LoginRequestSchema,
  longestStationNameLength,
  type OperatorSession,
  OperatorSessionSchema,
  type SessionAnswer,
  SessionAnswerSchema,
  StationNameSchema,
} from './operatorSession.js';
// The pt-BR sentence for a command Dados may not send: the server's refusal and the tooltip.
export { describeWhyTheDataRoleCannotSend } from './whyTheRoleCannotSend.js';
// The pt-BR sentences for an auto trigger or rule Dados may not set up or change.
export { whyTheDataRoleCannotAutomate } from './whyTheDataRoleCannotAutomate.js';
