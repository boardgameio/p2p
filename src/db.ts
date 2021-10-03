import { LogEntry, Server, State, StorageAPI } from "boardgame.io";
import { Sync } from "boardgame.io/internal";

/**
 * In-browser storage implementation for use by P2P hosts.
 *
 * Currently a simple in-memory store, but should be improved to provide
 * persistence across sessions using IndexedDB or similar.
 */
export class P2PDB extends Sync {
  initialState: Map<string, State> = new Map();
  state: Map<string, State> = new Map();
  log: Map<string, LogEntry[]> = new Map();
  metadata: Map<string, Server.MatchData> = new Map();

  connect(): void {
    // Required by parent class interface.
  }

  createMatch(matchID: string, opts: StorageAPI.CreateMatchOpts): void {
    this.initialState.set(matchID, opts.initialState);
    this.state.set(matchID, opts.initialState);
    this.log.set(matchID, []);
    this.metadata.set(matchID, opts.metadata);
  }

  setState(matchID: string, state: State, deltalog?: LogEntry[]): void {
    this.state.set(matchID, state);
    if (deltalog) {
      this.log.set(matchID, [...(this.log.get(matchID) || []), ...deltalog]);
    }
  }

  setMetadata(matchID: string, metadata: Server.MatchData): void {
    this.metadata.set(matchID, metadata);
  }

  fetch<O extends StorageAPI.FetchOpts>(
    matchID: string
  ): StorageAPI.FetchResult<O> {
    const res: StorageAPI.FetchFields = {
      initialState: this.initialState.get(matchID)!,
      state: this.state.get(matchID)!,
      log: this.log.get(matchID)!,
      metadata: this.metadata.get(matchID)!,
    };
    return res;
  }

  wipe(matchID: string): void {
    this.initialState.delete(matchID);
    this.state.delete(matchID);
    this.log.delete(matchID);
    this.metadata.delete(matchID);
  }

  listMatches(): string[] {
    return [...this.metadata.keys()];
  }
}
