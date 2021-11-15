import type { Server, State } from "boardgame.io";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { authenticate, signMessage } from "../src/authentication";
import { P2PDB } from "../src/db";
import { Client } from "../src/types";

const matchID = "TestMatch";

/** Generate a base64-encoded public/private key pair. */
function keys() {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  };
}

/** Create and pre-populate a database instance. */
function createDB(matchID: string, numPlayers = 2) {
  const db = new P2PDB();
  db.createMatch(matchID, {
    initialState: {} as State,
    metadata: {
      gameName: "TestGame",
      createdAt: 0,
      updatedAt: 0,
      players: Array.from({ length: numPlayers }).reduce(
        (players: Server.MatchData["players"], _, id) => ({
          ...players,
          [id]: { id },
        }),
        {}
      ),
    },
  });
  return db;
}

describe("without credentials", () => {
  const db = createDB(matchID);
  const player0Metadata = { playerID: "0", credentials: undefined };

  test("successfully authenticates on first connection", () => {
    expect(authenticate(matchID, player0Metadata, db)).toBe(true);
  });

  test("successfully authenticates on subsequent connection", () => {
    expect(authenticate(matchID, player0Metadata, db)).toBe(true);
  });
});

describe("with public-key encryption", () => {
  test("successfully authenticates if playerID not registered", () => {
    const db = createDB(matchID);
    const player0Keys = keys();
    const player0Metadata: Client["metadata"] & { playerID: string } = {
      playerID: "0",
      credentials: player0Keys.publicKey,
      message: signMessage("0", player0Keys.privateKey),
    };

    expect(authenticate(matchID, player0Metadata, db)).toBe(true);
    expect(db.fetch(matchID).metadata.players["0"].credentials).toEqual(
      player0Keys.publicKey
    );
  });

  test("successfully authenticates after initial registration", () => {
    const db = createDB(matchID);
    const player0Keys = keys();
    const player0Metadata: Client["metadata"] & { playerID: string } = {
      playerID: "0",
      credentials: player0Keys.publicKey,
      message: signMessage("0", player0Keys.privateKey),
    };

    expect(authenticate(matchID, player0Metadata, db)).toBe(true);
    expect(db.fetch(matchID).metadata.players["0"].credentials).toEqual(
      player0Keys.publicKey
    );

    const newMetadata = {
      ...player0Metadata,
      message: signMessage("0", player0Keys.privateKey),
    };
    expect(authenticate(matchID, newMetadata, db)).toBe(true);
  });

  test("successfully authenticates if playerID is null (spectator)", () => {
    const db = createDB(matchID);
    const spectatorKeys = keys();
    const spectatorMetadata: Client["metadata"] = {
      playerID: null,
      credentials: spectatorKeys.publicKey,
    };
    expect(authenticate(matchID, spectatorMetadata, db)).toBe(true);
  });

  test("authentication fails if player sends invalid message", () => {
    const db = createDB(matchID);
    const clientMetadata = {
      playerID: "1",
      credentials: keys().publicKey,
      message: "unsigned-message",
    };
    expect(authenticate(matchID, clientMetadata, db)).toBe(false);
    expect(db.fetch(matchID).metadata.players["1"].credentials).toBeUndefined();
  });

  test("multiple players can successfully authenticate", () => {
    const db = createDB(matchID);

    const player0Keys = keys();
    const player0Metadata = {
      playerID: "0",
      credentials: player0Keys.publicKey,
      message: signMessage("0", player0Keys.privateKey),
    };

    const player1Keys = keys();
    const player1Metadata: Client["metadata"] & { playerID: string } = {
      playerID: "1",
      credentials: player1Keys.publicKey,
      message: signMessage("1", player1Keys.privateKey),
    };

    // Player 0 authenticates successfully and their public key is stored.
    expect(authenticate(matchID, player0Metadata, db)).toBe(true);
    expect(
      db.fetch(matchID).metadata.players[+player0Metadata.playerID].credentials
    ).toBe(player0Keys.publicKey);

    // Player 1 authenticates successfully and their public key is stored.
    expect(authenticate(matchID, player1Metadata, db)).toBe(true);
    expect(
      db.fetch(matchID).metadata.players[+player1Metadata.playerID].credentials
    ).toBe(player1Keys.publicKey);
  });
});
