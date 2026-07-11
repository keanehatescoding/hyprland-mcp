import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runHyprctl } from "../hyprctl.js";

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
 * hyprpaper is controlled through its own `hyprctl hyprpaper <args>` subcommand
 * family — NOT through the Lua `dispatch`/`eval` mechanism, unaffected by 0.55.
 * Confirmed against the Hyprland wiki (Hypr-Ecosystem/hyprpaper, last updated
 * within days of this writing): `wallpaper` and `listactive` are the current,
 * documented requests. The wiki itself notes older tutorials mention `preload`,
 * `reload`, `unload`, and `listloaded`, but that these may not exist on current
 * versions — check `hyprctl hyprpaper --help` (via hyprctl_raw) if you need them;
 * they're deliberately not wrapped as dedicated tools here to avoid presenting
 * version-dependent commands with false confidence. hyprpaper also requires
 * `ipc = true` (the default) in hyprpaper.conf for any of this to work at all.
 * `wallpaper` and `listactive` both confirmed working on a real session.
 */
export function registerHyprpaperTools(server: McpServer) {
  server.tool(
    "set_wallpaper",
    "Set the wallpaper for a monitor (or the fallback for all monitors that don't have one " +
      "specifically assigned, if monitor is omitted). Loads the image on demand — no separate " +
      "preload step needed on current hyprpaper versions.",
    {
      path: z.string().describe("Path to the image file"),
      monitor: z
        .string()
        .optional()
        .describe("Monitor name from list_monitors, e.g. 'DP-1'; omit to set the fallback wallpaper"),
      fit_mode: z
        .string()
        .optional()
        .describe(
          "e.g. 'cover' (default), 'contain', 'tile' — exact supported values can vary by " +
            "hyprpaper version; omit to use hyprpaper's own default",
        ),
    },
    async ({ path, monitor, fit_mode }) => {
      const parts = [monitor ?? "", path, ...(fit_mode ? [fit_mode] : [])];
      const arg = parts.join(",");
      const out = await runHyprctl(["hyprpaper", "wallpaper", arg]);
      return text(
        out || `Set wallpaper${monitor ? ` on ${monitor}` : " (fallback)"} to ${path}`,
      );
    },
  );

  server.tool(
    "list_active_wallpapers",
    "List the currently active wallpaper path for each monitor.",
    {},
    async () => {
      const out = await runHyprctl(["hyprpaper", "listactive"]);
      return text(out);
    },
  );
}
