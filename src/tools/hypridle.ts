import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isProcessRunning, sendSignal, spawnDetached } from "../procs.js";

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
 * hypridle has NO hyprctl/IPC control surface at all (confirmed against the
 * Hyprland wiki) — it's a purely config-driven daemon (~/.config/hypr/hypridle.conf
 * defines idle 'listener' blocks that shell out to arbitrary commands on timeout/
 * resume, plus D-Bus lock/unlock/sleep hooks). The only control available from
 * outside is starting/stopping the daemon process itself, which is what these
 * tools do via src/procs.ts rather than anything hyprctl-based.
 */
export function registerHypridleTools(server: McpServer) {
  server.tool(
    "start_hypridle",
    "Start the hypridle idle-management daemon (auto-lock, auto-suspend, screen/keyboard " +
      "dimming, per the user's hypridle.conf) if it isn't already running. Checks first and " +
      "won't spawn a duplicate — running two instances would double-fire every idle action.",
    {},
    async () => {
      if (await isProcessRunning("hypridle")) {
        return text("hypridle is already running; did not start a second instance.");
      }
      await spawnDetached("hypridle");
      return text("Started hypridle.");
    },
  );

  server.tool(
    "stop_hypridle",
    "Stop the hypridle daemon, pausing ALL idle-triggered actions it manages — auto-lock, " +
      "auto-suspend, screen/keyboard-backlight dimming, whatever the user's hypridle.conf " +
      "defines, all at once (hypridle has no finer-grained 'pause just locking' control). " +
      "Useful for 'don't let my screen lock or sleep while I'm doing X'. Does not affect " +
      "Hyprland itself or unlock an already-locked screen.",
    {},
    async () => {
      const matched = await sendSignal("hypridle", "TERM");
      return text(matched ? "Stopped hypridle." : "hypridle was not running.");
    },
  );

  server.tool(
    "get_hypridle_status",
    "Check whether the hypridle daemon is currently running.",
    {},
    async () => {
      const running = await isProcessRunning("hypridle");
      return text(running ? "hypridle is running." : "hypridle is not running.");
    },
  );
}
