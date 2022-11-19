import type { DataConnection } from "peerjs";
import type { Master } from "boardgame.io/master";
import type { PlayerID } from "boardgame.io";

/** Interface used by `P2PHost` to communicate with connected clients. */
export interface Client {
  send: DataConnection["send"];
  metadata: {
    playerID: PlayerID | null;
    credentials: string | undefined;
    message?: string;
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
