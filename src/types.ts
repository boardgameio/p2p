import type Peer from "peerjs";
import type { Master } from "boardgame.io/master";
import type { PlayerID } from "boardgame.io";

export interface Client {
  send: Peer.DataConnection["send"];
  metadata: {
    playerID: PlayerID | null;
    credentials: string | undefined;
  };
}

/** Action data sent from clients to the host. */
export type ClientAction =
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
