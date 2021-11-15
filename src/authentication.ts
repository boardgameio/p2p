import { sign } from "tweetnacl";
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from "tweetnacl-util";
import type { P2PDB } from "./db";
import type { Client } from "./types";

/**
 * Verify that a signed message was signed by the given public key.
 * @param message Message signed by the client’s private key encoded as a base64 string.
 * @param publicKey Client’s public key encoded as a base64 string.
 * @param playerID playerID that the message is expected to decrypt to.
 * @returns `true` if the message is valid, `false` otherwise.
 */
export function verifyMessage(
  message: string,
  publicKey: string,
  playerID: string
): boolean {
  try {
    const verifedMessage = sign.open(
      decodeBase64(message),
      decodeBase64(publicKey)
    );
    return verifedMessage !== null && encodeUTF8(verifedMessage) === playerID;
  } catch (error) {
    return false;
  }
}

/**
 * Sign and encode a message string with the given private key.
 * @param message utf8 string to be signed.
 * @param privateKey base64-encoded private key to sign the message with.
 * @returns Signed message encoded as a base64 string.
 */
export function signMessage(message: string, privateKey: string): string {
  return encodeBase64(sign(decodeUTF8(message), decodeBase64(privateKey)));
}

/**
 * Authenticate a client by comparing its metadata with the credentials
 * stored in the database for the given match.
 */
export function authenticate(
  matchID: string,
  clientMetadata: Client["metadata"],
  db: P2PDB
): boolean {
  const { playerID, credentials, message } = clientMetadata;
  const { metadata } = db.fetch(matchID);
  // Spectators provide null/undefined playerIDs and don’t need authenticating.
  if (
    playerID === null ||
    playerID === undefined ||
    !(+playerID in metadata.players)
  ) {
    return true;
  }

  const existingCredentials = metadata.players[+playerID].credentials;

  const isMessageValid = credentials
    ? !!message && verifyMessage(message, credentials, playerID)
    : false;

  // If no credentials exist yet for this player, store those
  // provided by the connecting client and authenticate.
  if (!existingCredentials && isMessageValid) {
    db.setMetadata(matchID, {
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
  if (
    existingCredentials &&
    existingCredentials === credentials &&
    isMessageValid
  ) {
    return true;
  }
  return false;
}
