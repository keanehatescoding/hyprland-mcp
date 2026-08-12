import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isProcessRunning, sendSignal, spawnDetached } from "../procs.js";
import { evalLua } from "../hyprctl.js";
import { clearCrashedLockscreenExpr } from "../dispatch-expressions.js";

function text(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * hyprlock has NO hyprctl/IPC control surface either (confirmed against the
 * Hyprland wiki) — it's controlled purely via process lifecycle and signals:
 * launching the binary locks the screen, SIGUSR1 unlocks it, SIGUSR2 refreshes
 * labels/images. The wiki's own recommended guard against double-locking is
 * `pidof hyprlock || hyprlock`; lock_screen below does the equivalent via
 * isProcessRunning() before spawning.
 */
export function registerHyprlockTools(server: McpServer) {
  server.tool(
    "lock_screen",
    "Lock the screen by starting hyprlock. Checks first and won't spawn a second lock instance " +
      "if the screen is already locked (matching hyprlock's own documented " +
      "'pidof hyprlock || hyprlock' guard pattern).",
    {},
    async () => {
      if (await isProcessRunning("hyprlock")) {
        return text("Screen is already locked (hyprlock is already running).");
      }
      await spawnDetached("hyprlock");
      return text("Locked the screen.");
    },
  );

  server.tool(
    "unlock_screen",
    "Unlock the screen by sending SIGUSR1 to the running hyprlock process — confirmed via the " +
      "Hyprland wiki as hyprlock's own documented unlock mechanism ('pkill -USR1 hyprlock'). " +
      "SECURITY NOTE, not a caveat to skip past: this bypasses PAM/password authentication " +
      "entirely. Anything able to invoke this MCP tool can unlock the session without knowing " +
      "the password — access to this MCP server is therefore equivalent in sensitivity to the " +
      "screen lock's own security boundary. Only call this when the user themselves has clearly " +
      "asked to unlock their own session right now, not as a side effect of some other request.",
    {},
    async () => {
      const matched = await sendSignal("hyprlock", "USR1");
      return text(matched ? "Unlocked the screen." : "hyprlock was not running (screen wasn't locked).");
    },
  );

  server.tool(
    "refresh_lockscreen",
    "Send SIGUSR2 to hyprlock to refresh its labels and images (e.g. after changing a background " +
      "image it references dynamically). Low-risk — does not unlock anything, just redraws.",
    {},
    async () => {
      const matched = await sendSignal("hyprlock", "USR2");
      return text(matched ? "Refreshed lockscreen labels/images." : "hyprlock was not running.");
    },
  );

  server.tool(
    "get_lock_status",
    "Check whether the screen is currently locked (i.e. whether hyprlock is running).",
    {},
    async () => {
      const locked = await isProcessRunning("hyprlock");
      return text(locked ? "Screen is locked." : "Screen is not locked.");
    },
  );

  server.tool(
    "clear_crashed_lockscreen",
    "Clear a crashed lockscreen that won't go away (Hyprland 0.56+ only). When hyprlock " +
      "crashes or gets stuck, the session can be left in a state where the lock screen " +
      "persists even though no hyprlock process is running — this calls hl.clear_crashed_lockscreen(), " +
      "added in Hyprland 0.56, which forces the compositor to release the lock-screen surface. " +
      "Safe to call if the screen is locked but hyprlock isn't running (zombie lock screen).",
    {},
    async () => {
      const out = await evalLua(clearCrashedLockscreenExpr());
      return text(out || "Cleared crashed lockscreen surface");
    },
  );
}
