import { sign } from "tweetnacl";
import { decodeBase64, decodeUTF8, encodeBase64 } from "tweetnacl-util";
import type { P2PDB } from "./db";
import type { Client } from "./types";

/**
 * Verify that a signed message was signed by the given public key.
 * @param message Message signed by the client’s private key encoded as a base64 string.
 * @param publicKey Client’s public key encoded as a base64 string.
 * @returns `true` if the message is valid, `false` otherwise.
 */
export function verifyMessage(message: string, publicKey: string): boolean {
  try {
    const verifedMessage = sign.open(
      decodeBase64(message),
      decodeBase64(publicKey)
    );
    return verifedMessage !== null;
  } catch (error) {
    return false;
  }
}

export function signMessage(message: string, privateKey: string): string {
  return encodeBase64(sign(decodeUTF8(message), decodeBase64(privateKey)));
}

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

  let existingCredentials = metadata.players[+playerID].credentials;

  // If no credentials exist yet for this player, store those
  // provided by the connecting client and authenticate.
  if (!existingCredentials && credentials) {
    db.setMetadata(matchID, {
      ...metadata,
      players: {
        ...metadata.players,
        [+playerID]: { ...metadata.players[+playerID], credentials },
      },
    });
    existingCredentials = credentials;
  }

  // If credentials are neither provided nor stored, authenticate.
  if (!existingCredentials && !credentials) return true;

  // If credentials match, authenticate.
  if (
    message &&
    existingCredentials &&
    existingCredentials === credentials &&
    verifyMessage(message, existingCredentials)
  ) {
    return true;
  }
  return false;
}
