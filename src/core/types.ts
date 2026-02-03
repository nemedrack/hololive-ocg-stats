export type Result = "A" | "B" | "D" | "BYE";

export type Player = { pid: string; name: string };
export type Deck = { did: string; name: string };

export type Entry = { pid: string; did: string };

export type Match = {
  mid: string;
  table: number;
  a: string;
  b?: string;
  result?: Result;
};

export type Round = {
  r: number;
  matches: Match[];
  locked: boolean;
};

export type Tournament = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  location?: string;
  format: {
    type: "swiss";
    rounds: number;
    rules: { winPoints: number; drawPoints: number; lossPoints: number };
  };
  players: Player[];
  decks: Deck[];
  entries: Entry[];
  rounds: Round[];
  notes?: string;
};
