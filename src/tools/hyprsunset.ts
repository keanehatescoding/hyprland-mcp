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
 * hyprsunset is controlled entirely through its own `hyprctl hyprsunset <args>`
 * subcommand family — NOT through the Lua `dispatch`/`eval` mechanism that changed
 * in 0.55. Confirmed against the Hyprland wiki (Hypr-Ecosystem/hyprsunset):
 *   hyprctl hyprsunset temperature <K>
 *   hyprctl hyprsunset identity
 *   hyprctl hyprsunset gamma <percent|+delta|-delta>
 *   hyprctl hyprsunset reset [temperature|gamma|identity]
 *   hyprctl hyprsunset profile
 * All five commands confirmed working on a real Hyprland 0.56.2 session (temperature,
 * gamma, and identity produced visible effects; reset and profile returned correct
 * results — the v0.3.3 bug reported on the Hyprland forum that caused "invalid command"
 * for reset/profile has been fixed).
 */
export function registerHyprsunsetTools(server: McpServer) {
  server.tool(
    "set_sunset_temperature",
    "Set hyprsunset's color temperature in Kelvin (lower = warmer/more orange, e.g. 2500-4000 for " +
      "a strong blue-light filter; higher, e.g. 6500, is closer to neutral daylight). This override " +
      "is temporary and will be replaced once hyprsunset's next scheduled profile activates.",
    {
      kelvin: z.number().int().describe("Color temperature in Kelvin, e.g. 2500"),
    },
    async ({ kelvin }) => {
      const out = await runHyprctl(["hyprsunset", "temperature", `${kelvin}`]);
      return text(out || `Set hyprsunset temperature to ${kelvin}K`);
    },
  );

  server.tool(
    "disable_sunset_filter",
    "Disable hyprsunset's blue-light filter entirely, returning color temperature to normal " +
      "(hyprctl hyprsunset identity). Temporary — reverts at the next scheduled profile.",
    {},
    async () => {
      const out = await runHyprctl(["hyprsunset", "identity"]);
      return text(out || "Disabled hyprsunset filter (identity)");
    },
  );

  server.tool(
    "set_sunset_gamma",
    "Set or adjust hyprsunset's gamma (perceived brightness). Absolute percent (e.g. '50' = 50%) " +
      "or a relative delta with an explicit sign (e.g. '+10', '-10'). Max is 150% by default, " +
      "raisable via max-gamma in hyprsunset.conf, hard-capped at 200%. Using gamma for brightness " +
      "degrades color accuracy — prefer real monitor brightness control (DDC/backlight) if available.",
    {
      value: z
        .string()
        .describe("e.g. '50' for an absolute 50% gamma, or '+10'/'-10' for a relative change"),
    },
    async ({ value }) => {
      const out = await runHyprctl(["hyprsunset", "gamma", value]);
      return text(out || `Set hyprsunset gamma to ${value}`);
    },
  );

  server.tool(
    "reset_sunset",
    "Reset hyprsunset override(s) back to whatever the current time-based profile specifies. " +
      "Pass a sub-key to reset only one setting, or omit for 'all'.",
    {
      target: z
        .enum(["all", "temperature", "gamma", "identity"])
        .optional()
        .describe("Reset just one setting, or omit/'all' to reset everything"),
    },
    async ({ target }) => {
      const args =
        target && target !== "all" ? ["hyprsunset", "reset", target] : ["hyprsunset", "reset"];
      const out = await runHyprctl(args);
      return text(out || `Reset hyprsunset ${target ?? "(all)"}`);
    },
  );

  server.tool(
    "get_sunset_profile",
    "Print hyprsunset's currently active time-based profile, including the configured " +
      "temperature, gamma, and whether identity (no filter) is set.",
    {},
    async () => {
      const out = await runHyprctl(["hyprsunset", "profile"]);
      return text(out);
    },
  );
}
