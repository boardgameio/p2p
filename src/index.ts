import Peer from "peerjs";
import type { PeerJSOption } from "peerjs";

import { Transport } from "boardgame.io/internal";
import type {
  ChatMessage,
  CredentialedActionShape,
  Game,
  State,
} from "boardgame.io";

import { P2PHost } from "./host";
import type { ClientAction, Client } from "./types";

type TransportOpts = ConstructorParameters<typeof Transport>[0];

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

class P2PTransport extends Transport {
  private peer: Peer | null = null;
  private peerOptions: PeerJSOption;
  private onError: (error: PeerError) => void;
  private isHost: boolean;
  private game: Game;
  private emit?: (data: ClientAction) => void;

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
  }

  private get hostID(): string {
    if (!this.matchID) throw new Error("matchID must be provided");
    return `boardgameio-${this.gameName}-matchid-${this.matchID}`;
  }

  private get metadata(): Client["metadata"] {
    return { playerID: this.playerID, credentials: this.credentials };
  }

  connect(): void {
    const hostID = this.hostID;
    const metadata = this.metadata;

    this.peer = new Peer(this.isHost ? hostID : undefined, this.peerOptions);
    this.peer.on("error", this.onError);

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
        send: (data) => void this.notifyClient(data),
        metadata,
      });

      // When a peer connects to the host, register it and set up event handlers.
      this.peer.on("connection", (client) => {
        host.registerClient(client);
        client.on("data", (data) => void host.processAction(data));
        client.on("close", () => void host.unregisterClient(client));
      });

      this.onConnect();
    } else {
      this.peer.on("open", () => void this.connectToHost());
    }
  }

  private connectToHost() {
    if (!this.peer) return;
    const host = this.peer.connect(this.hostID, { metadata: this.metadata });
    // Forward actions to the host.
    this.emit = (action) => void host.send(action);
    // Emit sync action when a connection to the host is established.
    host.on("open", () => void this.onConnect());
    // Apply updates received from the host.
    host.on("data", (data) => void this.notifyClient(data));
  }

  private onConnect() {
    this.setConnectionStatus(true);
    this.requestSync();
  }

  disconnect(): void {
    if (this.peer) this.peer.destroy();
    this.peer = null;
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
    this.credentials = credentials;
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
  (p2pOpts: P2POpts = {}) =>
  (transportOpts: TransportOpts): P2PTransport =>
    new P2PTransport({ ...transportOpts, ...p2pOpts });
