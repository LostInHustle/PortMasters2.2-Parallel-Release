// The wire each consent market speaks on, named once for both ends.
//
// A socket event name is a string contract between the server that emits
// it and every client already connected. The three markets used to write
// their names in two places, the hook that listens and the handler that
// emits, and a renamed event on one side would have failed silently on the
// other. One table ends that: the server's board, its handler and the
// client hook all read the same entry.
//
// The field and id labels are part of the same contract, because a board
// arrives as a payload field and a press carries its row id under a field
// the handler names. They travel with the event names rather than being
// inferred from the kind.

export type ConsentChannel = {
  /** The event a personalized board arrives on. */
  update: string;
  /** The event a refusal arrives on. */
  error: string;
  /** The event this client asks for the board on. */
  stateRequest: string;
  /** The field the rows arrive in. */
  field: string;
  /** The event a seller posts an offer on. */
  post: string;
  /** The event a buyer's acceptance speaks on. */
  accept: string;
  /** The event a seller's withdrawal speaks on. */
  cancel: string;
  /** The field a row's id travels in, on the two shared presses above. */
  idField: string;
};

type ConsentMarketChannel = ConsentChannel & {
  /** The event a buyer's decline speaks on, where the market has one. */
  decline?: string;
  /** The event a covered buyer's raid claim speaks on, where it has one. */
  claim?: string;
};

export const CONSENT_CHANNELS = {
  escort: {
    update: "contract:update",
    error: "contract:error",
    stateRequest: "contract:state:request",
    field: "contracts",
    post: "contract:post",
    accept: "contract:accept",
    cancel: "contract:cancel",
    decline: "contract:decline",
    claim: "contract:claim",
    idField: "contractId",
  },
  refit: {
    update: "refit:update",
    error: "refit:error",
    stateRequest: "refit:state:request",
    field: "refits",
    post: "refit:post",
    accept: "refit:accept",
    cancel: "refit:cancel",
    idField: "contractId",
  },
  module: {
    update: "module:update",
    error: "module:error",
    stateRequest: "module:state:request",
    field: "moduleTrades",
    post: "module:post",
    accept: "module:accept",
    cancel: "module:cancel",
    idField: "tradeId",
  },
} as const satisfies Record<string, ConsentMarketChannel>;
