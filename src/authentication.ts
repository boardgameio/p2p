import { Server } from "boardgame.io";
import nacl from "tweetnacl";
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from "tweetnacl-util";
import { P2PDB } from "./db";
import { Client } from "./types";

export function verifyMessage(message: string, publicKey: string): string | null {
    const verifedMessage = nacl.sign.open(decodeBase64(message), decodeBase64(publicKey));
    if(verifedMessage === null) {
      return null;
    }
    return encodeUTF8(verifedMessage);
}

export function signMessage(message: string, privateKey: string): string {
    return encodeBase64(nacl.sign(decodeUTF8(message), decodeBase64(privateKey)));
}

export function authentication(matchID: string, clientMetadata: Client['metadata'], serverMetadata: Server.MatchData, db: P2PDB): boolean {
    const { playerID, credentials, message } = clientMetadata;
    const metadata = serverMetadata;
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
        existingCredentials = credentials
      }
  
      // If credentials are neither provided nor stored, authenticate.
      if (!existingCredentials && !credentials) return true;
  
      // If credentials match, authenticate.
      if( message && existingCredentials && existingCredentials === credentials && verifyMessage(message, existingCredentials) !== null) {
          return true
      }
      return false
}