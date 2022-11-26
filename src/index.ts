import Peer from "peerjs";
import type { PeerJSOption } from "peerjs";
import { sign, hash } from "tweetnacl";
import { decodeUTF8, encodeBase64 } from "tweetnacl-util";

import { Transport } from "boardgame.io/internal";
import type {
  ChatMessage,
  CredentialedActionShape,
  Game,
  State,
} from "boardgame.io";

import { P2PHost } from "./host";
import type { ClientAction, Client } from "./types";
import { signMessage } from "./authentication";

export { generateCredentials } from "./authentication";

type TransportOpts = ConstructorParameters<typeof Transport>[0];
type TransportData = Parameters<Transport["notifyClient"]>[0];

type PeerError = Error & {
  type:
    | "browser-incompatible"
    | "disconnected"
    | "invalid-id"
    | "invalid-key"
    | "network"
    | "peer-unavailable"
    | "ssl-unavailable"
    | "server-error"
    | "socket-error"
    | "socket-closed"
    | "unavailable-id"
    | "webrtc";
};

interface P2POpts {
  isHost?: boolean;
  peerOptions?: PeerJSOption;
  onError?: (error: PeerError) => void;
}

/**
 * Abstraction around `setTimeout`/`clearTimeout` that doubles the timeout
 * interval each time it is run until reaches a maximum interval length.
 */
class BackoffScheduler {
  private readonly initialInterval = 500;
  private readonly maxInterval = 32_000;
  private interval = this.initialInterval;
  private taskID?: NodeJS.Timeout;

  private cancelTask() {
    if (this.taskID) {
      clearTimeout(this.taskID);
      delete this.taskID;
    }
  }

  schedule(task: () => void) {
    this.cancelTask();
    this.taskID = setTimeout(() => {
      if (this.interval < this.maxInterval) this.interval *= 2;
      task();
    }, this.interval);
  }

  clear() {
    this.cancelTask();
    this.interval = this.initialInterval;
  }
}

class P2PTransport extends Transport {
  private peer: Peer | null = null;
  private peerOptions: PeerJSOption;
  private onError: (error: PeerError) => void;
  private isHost: boolean;
  private game: Game;
  private emit?: (data: ClientAction) => void;
  private retryHandler: BackoffScheduler;
  private privateKey?: string;

  constructor({
    isHost,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onError = () => {},
    peerOptions = {},
    ...opts
  }: TransportOpts & P2POpts) {
    super(opts);
    this.isHost = Boolean(isHost);
    this.onError = onError;
    this.peerOptions = peerOptions;
    this.game = opts.game;
    this.retryHandler = new BackoffScheduler();
    this.setCredentials(opts.credentials);
  }

  /** Synthesized peer ID for looking up this match’s host. */
  private get hostID(): string {
    if (!this.matchID) throw new Error("matchID must be provided");
    // Sanitize host ID for PeerJS: remove any non-alphanumeric characters, trim
    // leading/trailing hyphens/underscores and collapse consecutive hyphens/underscores.
    return `boardgameio-${this.gameName}-matchid-${this.matchID}`
      .replace(/([^A-Za-z0-9_-]|^[_-]+|[_-]+$)/g, "")
      .replace(/([_-])[_-]+/g, "$1");
  }

  /** Keep credentials and encryption keys in sync. */
  private setCredentials(credentials: string | undefined): void {
    if (!credentials) {
      this.privateKey = this.credentials = undefined;
      return;
    }
    // TODO: implement a real sha256 not just sha512 and cut of the end!
    const seed = hash(decodeUTF8(credentials)).slice(0, 32);
    const { publicKey, secretKey } = sign.keyPair.fromSeed(seed);
    this.credentials = encodeBase64(publicKey);
    this.privateKey = encodeBase64(secretKey);
  }

  /** Client metadata for this client instance. */
  private get metadata(): Client["metadata"] {
    return {
      playerID: this.playerID,
      credentials: this.credentials,
      message:
        this.playerID && this.privateKey
          ? signMessage(this.playerID, this.privateKey)
          : undefined,
    };
  }

  connect(): void {
    this.peer = new Peer(
      (this.isHost ? this.hostID : undefined) as string,
      this.peerOptions
    );

    if (this.isHost) {
      const host = new P2PHost({
        game: this.game,
        numPlayers: this.numPlayers,
        matchID: this.matchID,
      });

      // Process actions locally.
      this.emit = (action) => void host.processAction(action);

      // Register a local client for the host that applies updates directly to itself.
      host.registerClient({
        send: (data: TransportData) => void this.notifyClient(data),
        metadata: this.metadata,
      });

      // When a peer connects to the host, register it and set up event handlers.
      this.peer.on("connection", (client) => {
        host.registerClient(client);
        client.on("data", (data) => {
          host.processAction(data as ClientAction);
        });
        client.on("close", () => void host.unregisterClient(client));
        window && window.addEventListener("beforeunload", () => client.close());
      });
      this.peer.on("error", (err) => this.onError(err as PeerError));

      this.onConnect();
    } else {
      this.peer.on("open", () => void this.connectToHost());
      this.peer.on("error", (err) => {
        const error = err as PeerError;
        if (error.type === "network" || error.type === "peer-unavailable") {
          this.retryHandler.schedule(() => void this.connectToHost());
        } else {
          this.onError(error);
        }
      });
    }
  }

  /** Establish a connection to a remote host from a peer client. */
  private connectToHost(): void {
    if (!this.peer) return;
    const host = this.peer.connect(this.hostID, { metadata: this.metadata });
    // Forward actions to the host.
    this.emit = (action) => void host.send(action);
    // Emit sync action when a connection to the host is established.
    host.on("open", () => void this.onConnect());
    // Apply updates received from the host.
    host.on("data", (data) => void this.notifyClient(data as TransportData));
    window && window.addEventListener("beforeunload", () => host.close());
  }

  /** Execute tasks once the connection to a remote or local host has been established. */
  private onConnect(): void {
    this.retryHandler.clear();
    this.setConnectionStatus(true);
    this.requestSync();
  }

  disconnect(): void {
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.retryHandler.clear();
    this.setConnectionStatus(false);
  }

  requestSync(): void {
    if (!this.emit) return;
    this.emit({
      type: "sync",
      args: [this.matchID, this.playerID, this.credentials, this.numPlayers],
    });
  }

  sendAction(state: State, action: CredentialedActionShape.Any): void {
    if (!this.emit) return;
    this.emit({
      type: "update",
      args: [action, state._stateID, this.matchID, this.playerID!],
    });
  }

  sendChatMessage(matchID: string, chatMessage: ChatMessage): void {
    if (!this.emit) return;
    this.emit({ type: "chat", args: [matchID, chatMessage, this.credentials] });
  }

  private reconnect(): void {
    this.disconnect();
    this.connect();
  }

  updateMatchID(id: string): void {
    this.matchID = id;
    this.reconnect();
  }

  updatePlayerID(id: string): void {
    this.playerID = id;
    this.reconnect();
  }

  updateCredentials(credentials?: string): void {
    this.setCredentials(credentials);
    this.reconnect();
  }
}

/**
 * Experimental peer-to-peer multiplayer transport for boardgame.io.
 *
 * @param p2pOpts Transport configuration options.
 * @param p2pOpts.isHost Boolean flag to indicate if this client is responsible for the authoritative game state.
 * @param p2pOpts.onError Error callback.
 * @param p2pOpts.peerOptions Options to pass when instantiating a new PeerJS `Peer`.
 * @returns A transport factory for use by a boardgame.io client.
 * @example
 * import { Client } from 'boardgame.io/client';
 * import { P2P } from '@boardgame.io/p2p';
 * import { MyGame } from './game';
 *
 * const matchID = 'random-id-string';
 *
 * // Host clients maintain the authoritative game state and manage
 * // communication between all other peers.
 * const hostClient = Client({
 *   game: MyGame,
 *   matchID,
 *   playerID: '0',
 *   credentials: 'string-to-protect-playerID-zero',
 *   multiplayer: P2P({ isHost: true }),
 * });
 *
 * // Peer clients look up a host using the `matchID` and communicate
 * // with the host much like they would with a server.
 * const peerClient = Client({
 *   game: MyGame,
 *   matchID,
 *   playerID: '1',
 *   credentials: 'string-to-protect-playerID-one',
 *   multiplayer: P2P(),
 * });
 */
export const P2P =
  (p2pOpts: P2POpts = {}): ((transportOpts: TransportOpts) => P2PTransport) =>
  (transportOpts: TransportOpts): P2PTransport =>
    new P2PTransport({ ...transportOpts, ...p2pOpts });
