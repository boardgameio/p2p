import { Client } from "boardgame.io/client";
import { P2P } from "../src";

describe("P2P", () => {
  test("it returns a transport factory", () => {
    const p2p = P2P();
    expect(p2p).toBeInstanceOf(Function);
  });

  test("can be used by boardgame.io client", () => {
    expect(() => {
      const multiplayer = P2P();
      const client = Client({ game: {}, multiplayer });
      expect(client.multiplayer).toBe(multiplayer);
      client.start();
      client.stop();
    }).not.toThrow();
  });

  test("will sanitize matchid for peerjs", () => {
    const game = { name: "test" };
    const matchID = "-_-ABC---def01%2&3_-_";
    const multiplayer = P2P();
    const client = Client({ game, matchID, multiplayer });
    client.start();
    expect((client as any).transport.hostID).toBe(
      "boardgameio-test-matchid-ABC-def0123"
    );
  });
});
