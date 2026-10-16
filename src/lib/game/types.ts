// Shapes returned by the database (public_state.data and the my_status RPC). See 0005_sessions.sql.
import type { GameStatus, PlayerStatus, SpinPhase } from "@/lib/engine";

export type PublicState = {
  session: { number: number; startedAt: string } | null;
  game: {
    name: string;
    status: GameStatus;
    registrationOpen: boolean;
    finalChairCount: number;
    timerSeconds: number;
    autoOpenOnPause: boolean;
  };
  round: { number: number; difficulty: number; isFinal: boolean; status: "active" | "complete"; timerSeconds: number } | null;
  spin: { number: number; phase: SpinPhase; scanOpenedAt: string | null } | null;
  chairs: { number: number; holder: string | null }[];
  playersRemaining: number;
  playersTotal: number;
  winners: { rank: number; name: string }[];
  event: { kind: string; seq: number; round?: number; eliminated?: string[]; isFinal?: boolean } | null;
};

export type Question = {
  id: string;
  text: string;
  type: "mcq" | "one_word";
  options: string[] | null;
};

export type MyAttempt = {
  id: string;
  chairNumber: number;
  deadline: string;
  answered: boolean;
  question: Question | null;
};

export type MyStatus =
  | { registered: false; playedBefore: boolean; registrationOpen: boolean; serverNow: string }
  | {
      registered: true;
      player: {
        name: string;
        usn: string;
        branch: string;
        status: PlayerStatus;
        eliminatedInRound: number | null;
        finalRank: number | null;
      };
      gameStatus: GameStatus;
      roundNumber: number | null;
      phase: SpinPhase | null;
      lockedThisRound: boolean;
      attempt: MyAttempt | null;
      serverNow: string;
    };

export type ClaimResult = {
  attemptId: string;
  chairNumber: number;
  deadline: string;
  serverNow: string;
  question: Question;
};
