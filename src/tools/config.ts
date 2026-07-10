import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runHyprctl, runHyprctlJson } from "../hyprctl.js";

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

export function registerConfigTools(server: McpServer) {
  server.tool(
    "get_config_option",
    "Read the current value of a Hyprland config option, e.g. 'general:gaps_in' or 'decoration:rounding'.",
    {
      option: z.string(),
    },
    async ({ option }) => {
      const result = await runHyprctlJson(["getoption", option]);
      return text(result);
    },
  );

  server.tool(
    "set_config_option",
    "Set a Hyprland config option at runtime via 'hyprctl keyword'. This does NOT persist to " +
      "hyprland.conf \u2014 it's a live, in-memory override until reload. Good for experimenting " +
      "before writing the value into the actual config file.",
    {
      option: z.string().describe("e.g. 'general:gaps_in', 'decoration:rounding', 'animations:enabled'"),
      value: z.string().describe("e.g. '10', '0.6 0.4', 'true'"),
    },
    async ({ option, value }) => {
      const out = await runHyprctl(["keyword", option, value]);
      return text(out || `Set ${option} = ${value}`);
    },
  );

  server.tool(
    "reload_hyprland_config",
    "Reload hyprland.conf (equivalent to 'hyprctl reload').",
    {},
    async () => {
      const out = await runHyprctl(["reload"]);
      return text(out || "Config reloaded");
    },
  );

  server.tool(
    "get_hyprland_version",
    "Get the running Hyprland version, commit, and build flags.",
    {},
    async () => {
      const out = await runHyprctlJson(["version"]);
      return text(out);
    },
  );
}
