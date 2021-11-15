import { P2PHost } from "../src/host";
import { ClientAction } from "../src/types";

const matchID = "matchID";
const initialState = "Game State";

const createHost = (
  opts: Partial<ConstructorParameters<typeof P2PHost>[0]> = {}
) =>
  new P2PHost({
    game: { name: "Test", setup: () => initialState },
    matchID,
    ...opts,
  });

const createClient = (playerID: "0" | "1" | null, credentials?: string) => ({
  send: jest.fn(),
  metadata: { playerID, credentials },
});

describe("P2PHost", () => {
  describe("construction", () => {
    test("logs error if game name is missing", () => {
      jest.spyOn(console, "error").mockImplementation(jest.fn());
      createHost({ game: {} });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(
          "Please set the `name` property of your game definition"
        )
      );
    });

    test("throws error if game requires setupData", () => {
      expect(() =>
        createHost({ game: { name: "Test", validateSetupData: () => "BAD!" } })
      ).toThrow("setupData Error: BAD!");
    });
  });

  describe("#registerClient", () => {
    test("client receives metadata update when registering", () => {
      const client = createClient("0");
      const host = createHost();
      host.registerClient(client);
      expect(client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "matchData",
          args: [matchID, [{ id: 0, isConnected: true }, { id: 1 }]],
        })
      );
    });

    test("all clients receive metadata updates when a client registers", () => {
      const client0 = createClient("0");
      const client1 = createClient("1");
      const host = createHost();
      host.registerClient(client0);
      jest.clearAllMocks();
      host.registerClient(client1);
      const metadata = expect.objectContaining({
        type: "matchData",
        args: [
          matchID,
          [
            { id: 0, isConnected: true },
            { id: 1, isConnected: true },
          ],
        ],
      });
      expect(client0.send).toHaveBeenCalledWith(metadata);
      expect(client1.send).toHaveBeenCalledWith(metadata);
    });

    test("registering a spectator doesn’t trigger metadata updates", () => {
      const player0 = createClient("0");
      const host = createHost();
      host.registerClient(player0);
      jest.clearAllMocks();
      const spectator = createClient(null);
      host.registerClient(spectator);
      expect(player0.send).not.toHaveBeenCalled();
    });

    test("registering an inauthentic player doesn’t trigger metadata updates", () => {
      const player0 = createClient("0");
      const host = createHost();
      host.registerClient(player0);
      jest.clearAllMocks();
      const player1 = createClient("1", "badcred");
      host.registerClient(player1);
      expect(player0.send).not.toHaveBeenCalled();
    });
  });

  describe("#unregisterClient", () => {
    test("unregistering a client notifies other clients", () => {
      const player0 = createClient("0");
      const player1 = createClient("1");
      const host = createHost();
      host.registerClient(player0);
      host.registerClient(player1);
      jest.clearAllMocks();
      host.unregisterClient(player0);
      expect(player1.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "matchData",
          args: [
            matchID,
            [
              { id: 0, isConnected: false },
              { id: 1, isConnected: true },
            ],
          ],
        })
      );
    });
  });

  describe("#processAction", () => {
    let player0: ReturnType<typeof createClient>;
    let player1: ReturnType<typeof createClient>;
    let spectator: ReturnType<typeof createClient>;
    let host: P2PHost;

    beforeEach(() => {
      player0 = createClient("0");
      player1 = createClient("1");
      spectator = createClient(null);
      host = createHost();
      host.registerClient(player0);
      host.registerClient(player1);
      host.registerClient(spectator);
      jest.clearAllMocks();
    });

    afterEach(() => {
      host.unregisterClient(player0);
      host.unregisterClient(player1);
      host.unregisterClient(spectator);
    });

    describe("sync", () => {
      test("sends state to player requesting sync", () => {
        host.processAction({ type: "sync", args: [matchID, "0"] });
        expect(player0.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "sync",
            args: [
              matchID,
              expect.objectContaining({
                state: expect.objectContaining({ G: initialState }),
              }),
            ],
          })
        );
        expect(player1.send).not.toHaveBeenCalled();
        expect(spectator.send).not.toHaveBeenCalled();
      });
    });

    describe("update", () => {
      test("update triggers update for all clients", () => {
        const endTurn = {
          type: "GAME_EVENT",
          payload: {
            type: "endTurn",
            args: undefined,
            playerID: "0",
            credentials: undefined as any,
          },
        } as const;
        host.processAction({
          type: "update",
          args: [endTurn, 0, matchID, "0"],
        });

        // Each client has received new state and the turn has incremented.
        expect(player0.send).toHaveBeenCalled();
        expect(player0.send.mock.calls[0][0].args[1].ctx.turn).toBe(2);
        expect(player1.send).toHaveBeenCalled();
        expect(player1.send.mock.calls[0][0].args[1].ctx.turn).toBe(2);
        expect(spectator.send).toHaveBeenCalled();
        expect(spectator.send.mock.calls[0][0].args[1].ctx.turn).toBe(2);
      });
    });

    describe("chat", () => {
      test("all clients receive chat messages", () => {
        const message = { id: "foo", sender: "0", payload: "Hello" };
        const payload = { type: "chat", args: [matchID, message] };
        host.processAction(payload as ClientAction);

        // Each client has received the chat message.
        expect(player0.send).toHaveBeenCalledWith(payload);
        expect(player1.send).toHaveBeenCalledWith(payload);
        expect(spectator.send).toHaveBeenCalledWith(payload);
      });
    });
  });
});
