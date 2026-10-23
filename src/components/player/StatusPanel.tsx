import { StateWord } from "@/components/ui/StateWord";
import type { PublicState } from "@/lib/game/types";
import type { PlayerView } from "@/lib/player/view";
import { PlayerStage } from "./PlayerStage";

type Tone = "cyan" | "amber" | "lime" | "red" | "gold";

function copy(view: PlayerView, pub: PublicState | null): { tone: Tone; word: string; text: string } {
  switch (view.kind) {
    case "lobby":
      return { tone: "cyan", word: "You're in", text: `Waiting for the host to start. ${pub?.playersTotal ?? 0} players have joined.` };
    case "walk":
      return { tone: "cyan", word: "Walk!", text: "The music is on. Keep circling the chairs." };
    case "stay_seated":
      return { tone: "lime", word: "Stay seated", text: "Keep your chair until the round ends." };
    case "stand_up":
      return { tone: "amber", word: "Stand up", text: "Back into the circle for the next spin." };
    case "wait_next_spin":
      return { tone: "cyan", word: "Get ready", text: "The next spin is about to start." };
    case "answered":
      return { tone: "cyan", word: "Answer in", text: "Stay on your chair. The host will call you." };
    case "round_cleared":
      return { tone: "lime", word: "You're through", text: `Round ${view.round ?? ""} is over. Wait for the next round.` };
    case "eliminated":
      return { tone: "red", word: "Eliminated", text: `Out in round ${view.round ?? "?"}. Thanks for playing!` };
    case "missed":
      return { tone: "cyan", word: "Round 1 is over", text: "You didn't get a chair this game. You can play in the next game." };
    case "winner":
      return { tone: "gold", word: "Champion", text: view.rank ? `You finished #${view.rank}!` : "You made the final!" };
    case "spectator":
      return { tone: "cyan", word: "Watching", text: "This game already started. Ask the host to join the next game." };
    case "removed":
      return { tone: "red", word: "Removed", text: "The host removed you from this game." };
    case "registration_closed":
      return { tone: "amber", word: "Closed", text: "Registration is closed right now. Ask the host." };
    default:
      return { tone: "cyan", word: "Loading", text: "" };
  }
}

export function StatusPanel({ view, pub, version }: { view: PlayerView; pub: PublicState | null; version: number }) {
  const { tone, word, text } = copy(view, pub);
  return (
    <section className="flex w-full flex-col items-center gap-3 text-center sm:gap-4">
      <StateWord tone={tone}>{word}</StateWord>
      <p className="max-w-sm text-base text-text/80 sm:text-lg">{text}</p>
      {pub && pub.chairs.length > 0 && <PlayerStage pub={pub} version={version} />}
    </section>
  );
}
