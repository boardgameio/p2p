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
});
