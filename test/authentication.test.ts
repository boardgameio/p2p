import { Server } from "boardgame.io";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { authenticate, signMessage } from "../src/authentication";
import { Client } from "../src/types";

const matchID = "TestMatch";
const defaultMetadata = { gameName: "TestGame", createdAt: 0, updatedAt: 0 };

function keys() {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  };
}

//[+player1Metadata.playerID]: {id: +player1Metadata.playerID}

test("PlayerID not registered", () => {
  const player1keyPair = nacl.sign.keyPair();
  const player1Metadata: Client["metadata"] & { playerID: string } = {
    playerID: "Player1",
    credentials: encodeBase64(player1keyPair.publicKey),
    message: undefined,
  };

  let serverMetadata: Server.MatchData = { ...defaultMetadata, players: {} };

  const db: any = {
    setMetadata: (_matchID: string, _serverMetadata: Server.MatchData) => {
      serverMetadata = _serverMetadata;
    },
  };

  expect(
    authenticate(matchID, player1Metadata, serverMetadata, db)
  ).toBeTruthy();
});

test("PlayerID null", () => {
  const player1keyPair = nacl.sign.keyPair();
  const player1Metadata: Client["metadata"] = {
    playerID: null,
    credentials: encodeBase64(player1keyPair.publicKey),
    message: undefined,
  };

  let serverMetadata: Server.MatchData = { ...defaultMetadata, players: {} };

  const db: any = {
    setMetadata: (_matchID: string, _serverMetadata: Server.MatchData) => {
      serverMetadata = _serverMetadata;
    },
  };

  expect(
    authenticate(matchID, player1Metadata, serverMetadata, db)
  ).toBeTruthy();
});

test("Player1 is registered and Player2 sends wrong message", () => {
  const player1Keys = keys();
  const message = signMessage("Test", player1Keys.privateKey);
  const player1Metadata: Client["metadata"] & { playerID: string } = {
    playerID: "1",
    credentials: player1Keys.publicKey,
    message,
  };

  const player2Keys = keys();
  const player2Metadata: Client["metadata"] & { playerID: string } = {
    playerID: "2",
    credentials: player2Keys.publicKey,
    message,
  };

  let serverMetadata: Server.MatchData = {
    ...defaultMetadata,
    players: {
      [+player1Metadata.playerID]: { id: +player1Metadata.playerID },
      [+player2Metadata.playerID]: { id: +player2Metadata.playerID },
    },
  };

  const db: any = {
    setMetadata: (_matchID: string, _serverMetadata: Server.MatchData) => {
      serverMetadata = _serverMetadata;
    },
  };

  expect(
    serverMetadata.players[+player1Metadata.playerID].credentials
  ).toBeUndefined();
  expect(
    authenticate(matchID, player1Metadata, serverMetadata, db)
  ).toBeTruthy();
  expect(serverMetadata.players[+player1Metadata.playerID].credentials).toBe(
    player1Keys.publicKey
  );
  expect(
    authenticate(matchID, player2Metadata, serverMetadata, db)
  ).toBeFalsy();
});

test("Player1 is registered and Player2 sends wrong message", () => {
  const player1Keys = keys();
  const message1 = signMessage("Test", player1Keys.privateKey);
  const player1Metadata: Client["metadata"] & { playerID: string } = {
    playerID: "1",
    credentials: player1Keys.publicKey,
    message: message1,
  };

  const player2Keys = keys();
  const message2 = signMessage("Test", player2Keys.privateKey);
  const player2Metadata: Client["metadata"] & { playerID: string } = {
    playerID: "2",
    credentials: player2Keys.publicKey,
    message: message2,
  };

  let serverMetadata: Server.MatchData = {
    ...defaultMetadata,
    players: {
      [+player1Metadata.playerID]: { id: +player1Metadata.playerID },
      [+player2Metadata.playerID]: { id: +player2Metadata.playerID },
    },
  };

  const db: any = {
    setMetadata: (_matchID: string, _serverMetadata: Server.MatchData) => {
      serverMetadata = _serverMetadata;
    },
  };

  expect(
    serverMetadata.players[+player1Metadata.playerID].credentials
  ).toBeUndefined();
  expect(
    authenticate(matchID, player1Metadata, serverMetadata, db)
  ).toBeTruthy();
  expect(serverMetadata.players[+player1Metadata.playerID].credentials).toBe(
    player1Keys.publicKey
  );
  expect(
    authenticate(matchID, player2Metadata, serverMetadata, db)
  ).toBeTruthy();
});
