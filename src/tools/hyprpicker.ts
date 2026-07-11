import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
 * hyprpicker has no daemon, no hyprctl subcommand, no IPC — it's a blocking
 * foreground CLI: launch it, the cursor becomes a magnifier, a click prints the
 * picked color to stdout and the process exits (confirmed via the Hyprland wiki
 * and hyprpicker's own man page). Always pass -n/--no-fancy ourselves regardless
 * of user preference: that flag only controls ANSI color escape codes wrapping
 * the output for terminal display, which would just pollute a value this tool
 * needs to return cleanly — there is no reason to ever want it in a programmatic
 * caller.
 */
export function registerHyprpickerTools(server: McpServer) {
  server.tool(
    "pick_color",
    "Pick a color from anywhere on screen using hyprpicker. BLOCKS until the user actually " +
      "clicks a pixel on their real screen (or presses Escape to cancel) — the cursor turns into " +
      "a magnifying lens in the meantime. Only call this when the user is actively present and " +
      "expecting to click something right now (e.g. they just asked to pick a color); don't call " +
      "it as an unattended step in a longer chain, since it will hang until someone interacts.",
    {
      format: z
        .enum(["hex", "rgb", "hsl", "hsv", "cmyk"])
        .optional()
        .describe("Output color format; defaults to hex if omitted"),
      autocopy: z
        .boolean()
        .optional()
        .describe("Also copy the picked color to the clipboard (requires wl-clipboard/wl-copy)"),
    },
    async ({ format, autocopy }) => {
      const args = ["--no-fancy"];
      if (format) args.push("--format", format);
      if (autocopy) args.push("--autocopy");

      try {
        const { stdout } = await execFileAsync("hyprpicker", args);
        const color = stdout.trim();
        return text(color || "No color returned (user likely pressed Escape to cancel)");
      } catch (err: any) {
        if (err.code === "ENOENT") {
          throw new Error(
            "'hyprpicker' was not found on PATH. Install it first (e.g. 'pacman -S hyprpicker' " +
              "on Arch/CachyOS, or see https://github.com/hyprwm/hyprpicker).",
          );
        }
        throw err;
      }
    },
  );
}
