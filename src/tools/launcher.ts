import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";

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
 * Launch a GUI binary detached from this process (fire-and-forget): we only wait
 * for the OS to confirm the process actually started, not for it to exit, since
 * hyprlauncher is a long-lived daemon/window.
 */
function spawnDetached(command: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `'${command}' was not found on PATH. Install it first (e.g. 'pacman -S hyprlauncher' ` +
              `on Arch/CachyOS, or see https://github.com/hyprwm/hyprlauncher).`,
          ),
        );
      } else {
        reject(err);
      }
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export function registerLauncherTools(server: McpServer) {
  server.tool(
    "toggle_launcher",
    "Open Hyprland's first-party app launcher/picker (hyprlauncher), or close it if it's already " +
      "open. hyprlauncher runs as a self-managing daemon: the first call starts the daemon and " +
      "shows its window; every call after that just toggles the window, near-instantly, without " +
      "restarting the daemon. Use this for 'open the launcher' / 'let me search for an app' style " +
      "requests.",
    {},
    async () => {
      await spawnDetached("hyprlauncher");
      return text("Toggled hyprlauncher (opened it if it was closed, closed it if it was open)");
    },
  );

  server.tool(
    "prewarm_launcher_daemon",
    "Start the hyprlauncher daemon in the background WITHOUT opening its window (hyprlauncher -d). " +
      "Useful once at session start so the first real toggle_launcher call is instant rather than " +
      "paying daemon-startup cost. Safe to call even if the daemon is already running.",
    {},
    async () => {
      await spawnDetached("hyprlauncher", ["-d"]);
      return text("Started hyprlauncher daemon in the background (no window shown)");
    },
  );
}
