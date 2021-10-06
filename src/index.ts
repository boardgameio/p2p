import Peer from "peerjs";
import type { PeerJSOption } from "peerjs";

import { createMatch, Transport } from "boardgame.io/internal";
import { Master } from "boardgame.io/master";
import type {
  ChatMessage,
  CredentialedActionShape,
  Game,
  PlayerID,
  State,
} from "boardgame.io";

import { P2PDB } from "./db";

type TransportOpts = ConstructorParameters<typeof Transport>[0];

interface P2POpts {
  isHost?: boolean;
  peerOptions?: PeerJSOption;
}

interface Client {
  send: Peer.DataConnection["send"];
  metadata: {
    playerID: PlayerID | null;
    credentials: string | undefined;
  };
}

/** Action data sent from clients to the host. */
type ClientAction =
  | {
      type: "update";
      args: Parameters<Master["onUpdate"]>;
    }
  | {
      type: "chat";
      args: Parameters<Master["onChatMessage"]>;
    }
  | {
      type: "sync";
      args: Parameters<Master["onSync"]>;
    };

/**
 * Peer-to-peer host class, which runs a local `Master` instance
 * and sends authoritative state updates to all connected players.
 */
class P2PHost {
  private clients: Map<Client, Client> = new Map();
  private matchID: string;
  private master: Master;
  private db: P2PDB;

  constructor({
    game,
    numPlayers = 2,
    matchID,
  }: {
    game: Game;
    numPlayers: number;
    matchID: string;
  }) {
    this.matchID = matchID;

    if (!game.name || game.name === "default") {
      console.error(
        'Using "default" as your game name.\n' +
          "Please set the `name` property of your game definition " +
          "to a unique string to help avoid peer ID conflicts."
      );
    }

    const match = createMatch({
      game,
      numPlayers,
      unlisted: false,
      setupData: undefined,
    });
    if ("setupDataError" in match) {
      throw new Error("setupData Error: " + match.setupDataError);
    }

    this.db = new P2PDB();
    this.db.createMatch(this.matchID, match);

    this.master = new Master(game, this.db, {
      send: ({ playerID, ...data }) => {
        for (const [client] of this.clients) {
          if (client.metadata.playerID === playerID) client.send(data);
        }
      },
      sendAll: (data) => {
        for (const [client] of this.clients) {
          client.send(data);
        }
      },
    });
  }

  registerClient(client: Client): void {
    const isAuthenticated: boolean = this.authenticateClient(client);
    // If the client failed to authenticate, don’t register it.
    if (!isAuthenticated) return;
    const { playerID, credentials } = client.metadata;
    this.clients.set(client, client);
    this.master.onConnectionChange(this.matchID, playerID, credentials, true);
  }

  /**
   * Store a player’s credentials on initial connection and authenticate them subsequently.
   * @param client Client to authenticate.
   * @returns `true` if the client was successfully authenticated, `false` if it wasn’t.
   */
  private authenticateClient(client: Client): boolean {
    const { playerID, credentials } = client.metadata;
    const { metadata } = this.db.fetch(this.matchID);

    // Spectators provide null/undefined playerIDs and don’t need authenticating.
    if (
      playerID === null ||
      playerID === undefined ||
      !(+playerID in metadata.players)
    ) {
      return true;
    }

    const existingCredentials = metadata.players[+playerID].credentials;

    // If no credentials exist yet for this player, store those
    // provided by the connecting client and authenticate.
    if (!existingCredentials && credentials) {
      this.db.setMetadata(this.matchID, {
        ...metadata,
        players: {
          ...metadata.players,
          [+playerID]: { ...metadata.players[+playerID], credentials },
        },
      });
      return true;
    }

    // If credentials are neither provided nor stored, authenticate.
    if (!existingCredentials && !credentials) return true;

    // If credentials match, authenticate.
    return credentials === existingCredentials;
  }

  unregisterClient(client: Client): void {
    const { credentials, playerID } = client.metadata;
    this.clients.delete(client);
    this.master.onConnectionChange(this.matchID, playerID, credentials, false);
  }

  processAction(data: ClientAction): void {
    switch (data.type) {
      case "update":
        this.master.onUpdate(...data.args);
        break;
      case "chat":
        this.master.onChatMessage(...data.args);
        break;
      case "sync":
        this.master.onSync(...data.args);
        break;
    }
  }
}

class P2PTransport extends Transport {
  private peer: Peer | null = null;
  private peerOptions: PeerJSOption;
  private isHost: boolean;
  private game: Game;
  private emit?: (data: ClientAction) => void;

  constructor({ isHost, peerOptions = {}, ...opts }: TransportOpts & P2POpts) {
    super(opts);
    this.isHost = Boolean(isHost);
    this.peerOptions = peerOptions;
    this.game = opts.game;
  }

  private namespacedPeerID(): string {
    if (!this.matchID) throw new Error("matchID must be provided");
    return `boardgameio-${this.gameName}-matchid-${this.matchID}`;
  }

  connect(): void {
    const hostID = this.namespacedPeerID();
    const metadata = { playerID: this.playerID, credentials: this.credentials };

    this.peer = new Peer(this.isHost ? hostID : undefined, this.peerOptions);

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

      this.requestSync();
    } else {
      this.peer.on("open", () => {
        if (!this.peer) return;
        const host = this.peer.connect(hostID, { metadata });
        // Forward actions to the host.
        this.emit = (action) => void host.send(action);
        // Emit sync action when a connection to the host is established.
        host.on("open", () => void this.requestSync());
        // Apply updates received from the host.
        host.on("data", (data) => {
          this.notifyClient(data);
        });
      });
    }

    this.setConnectionStatus(true);
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
