// Error codes raised by the RPCs (TRD › APIs) → what a player or admin should read.
// Unknown text is never shown: it could leak internals (SECURITY.md › Secrets).

const messages: Record<string, string> = {
  NOT_AUTHENTICATED: "Your session expired. Log in again.",
  NOT_ADMIN: "Only the host can do that.",
  NOT_REGISTERED: "You're not in this game yet. Register to play.",
  NOT_ACTIVE: "You're not playing in this game right now.",
  ALREADY_LOCKED: "You already have a chair this round. Stay seated!",
  ALREADY_SCANNED_THIS_SPIN: "You've already scanned a chair this spin.",
  SCAN_WINDOW_CLOSED: "Wait for the music to stop before scanning.",
  CHAIR_INACTIVE: "That chair isn't in play this round.",
  CHAIR_TAKEN: "Someone scanned that chair first.",
  CHAIR_LOCKED: "That chair is already won this round.",
  BAD_QR: "That QR code isn't a valid game chair.",
  ALREADY_ANSWERED: "Your answer is already in.",
  NOT_FOUND: "That isn't available any more.",
  REGISTRATION_CLOSED: "Registration is closed right now. Ask the host.",
  DUPLICATE_USN: "That USN is already registered in this game. Log in instead.",
  DUPLICATE_PHONE: "That phone number is already registered in this game.",
  ALREADY_REGISTERED: "You're already registered in this game.",
  VALIDATION: "Some details aren't valid. Check and try again.",
  NO_QUESTIONS: "No questions are loaded yet. Tell the host.",
  INVALID_TRANSITION: "That step isn't available right now.",
  ROUND_NOT_COMPLETE: "Not every chair is locked yet.",
  ROUND_COMPLETE: "Every chair is locked: end the round.",
  NO_CHAIRS: "Add or activate at least one chair first.",
  NO_PLAYERS: "No active players yet.",
  // Question bank / AI (P5)
  AI_NOT_CONFIGURED: "AI isn't set up yet: add GEMINI_API_KEY to the server environment.",
  RATE_LIMITED: "Too many AI requests. Wait a minute and try again.",
  AI_BAD_OUTPUT: "The AI's reply didn't make sense. Try again.",
  AI_TIMEOUT: "The AI took too long. Try a smaller file or fewer questions.",
  AI_FAILED: "The AI request failed. Check the API key and try again.",
  UNSUPPORTED_FILE: "Use a PDF, Word (.docx), image, text or CSV file.",
  FILE_TOO_LARGE: "That file is over 4 MB. Split it or use a smaller one.",
  EMPTY_FILE: "That file is empty.",
  UNREADABLE_FILE: "Couldn't read any text from that file.",
  NO_FILE: "Choose a file first.",
  FORBIDDEN: "Request blocked. Reload the page and try again.",
  // Supabase Auth messages
  "Invalid login credentials": "Wrong USN or PIN.",
  "User already registered": "That USN already has an account. Log in with your PIN.",
};

export function friendlyError(codeOrMessage: string | undefined | null): string {
  if (codeOrMessage && messages[codeOrMessage]) return messages[codeOrMessage];
  if (codeOrMessage && /rate limit|too many/i.test(codeOrMessage)) return "Too many attempts. Wait a minute and try again.";
  if (codeOrMessage && /network|fetch/i.test(codeOrMessage)) return "No connection. Check your internet and try again.";
  return "Something went wrong. Try again.";
}
