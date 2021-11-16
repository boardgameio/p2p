import { P2PDB } from "../src/db";

const matchID = "matchID";
const initialState: any = {};
const metadata: any = {};

describe("P2PDB", () => {
  test("should be able to create a new instance", () => {
    const db = new P2PDB();
    expect(db).toBeInstanceOf(P2PDB);
  });

  test("provides connect method", () => {
    const db = new P2PDB();
    expect(db.connect).toBeInstanceOf(Function);
    expect(db.connect()).toBeUndefined();
  });

  describe("#createMatch", () => {
    const db = new P2PDB();
    db.createMatch(matchID, { initialState, metadata });

    test("stores initialState", () => {
      expect(db.fetch(matchID).initialState).toBe(initialState);
    });

    test("stores state", () => {
      expect(db.fetch(matchID).state).toBe(initialState);
    });

    test("initialises log", () => {
      expect(db.fetch(matchID).log).toEqual([]);
    });

    test("stores metadata", () => {
      expect(db.fetch(matchID).metadata).toBe(metadata);
    });
  });

  describe("#setState", () => {
    const db = new P2PDB();
    db.createMatch(matchID, { initialState, metadata });

    test("should set state", () => {
      const state: any = { foo: "bar" };
      db.setState(matchID, state);
      expect(db.fetch(matchID).state).toBe(state);
    });

    test("should append to log", () => {
      const state1: any = { foo: "baz" };
      const deltalog1: any = ["foo"];
      db.setState(matchID, state1, deltalog1);
      const state2: any = { foo: "buq" };
      const deltalog2: any = ["bar"];
      db.setState(matchID, state2, deltalog2);
      expect(db.fetch(matchID).state).toBe(state2);
      expect(db.fetch(matchID).log).toEqual([...deltalog1, ...deltalog2]);
    });

    test("handles uninitialised log", () => {
      const matchID = "new-match";
      const state: any = { foo: "bar" };
      const deltalog: any = ["foo"];
      db.setState(matchID, state, deltalog);
      expect(db.fetch(matchID).state).toBe(state);
      expect(db.fetch(matchID).log).toEqual(deltalog);
    });
  });

  describe("#setMetadata", () => {
    const db = new P2PDB();
    db.createMatch(matchID, { initialState, metadata });

    test("should set metadata", () => {
      const metadata: any = { foo: "bar" };
      db.setMetadata(matchID, metadata);
      expect(db.fetch(matchID).metadata).toBe(metadata);
    });
  });

  describe("#fetch", () => {
    const db = new P2PDB();
    db.createMatch(matchID, { initialState, metadata });

    test("should fetch match", () => {
      expect(db.fetch(matchID)).toEqual({
        initialState,
        state: initialState,
        log: [],
        metadata,
      });
    });
  });

  describe("wipe", () => {
    const db = new P2PDB();
    db.createMatch(matchID, { initialState, metadata });

    test("should wipe match", () => {
      expect(db.fetch(matchID)).toEqual({
        initialState,
        state: initialState,
        log: [],
        metadata,
      });
      db.wipe(matchID);
      expect(db.fetch(matchID).initialState).toBeUndefined();
      expect(db.fetch(matchID).state).toBeUndefined();
      expect(db.fetch(matchID).log).toBeUndefined();
      expect(db.fetch(matchID).metadata).toBeUndefined();
    });
  });

  describe("#listMatches", () => {
    const db = new P2PDB();
    db.createMatch("match1", { initialState, metadata });
    db.createMatch("match2", { initialState, metadata });
    db.createMatch("match3", { initialState, metadata });

    test("should list all matches", () => {
      expect(db.listMatches()).toEqual(["match1", "match2", "match3"]);
    });
  });
});
