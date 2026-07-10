import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatch, runHyprctl } from "../hyprctl.js";

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

export function registerDispatchTools(server: McpServer) {
  server.tool(
    "hyprland_dispatch",
    "Escape hatch: run any Hyprland dispatcher directly via `hyprctl dispatch <dispatcher> <args>`. " +
      "Use this for dispatchers not covered by the dedicated tools (e.g. 'exec', 'cyclenext', 'swapwindow', " +
      "'layoutmsg', 'submap', 'togglespecialworkspace', 'centerwindow', 'alterzorder'). " +
      "See `hyprctl dispatch --help` or the Hyprland wiki for the full dispatcher list.",
    {
      dispatcher: z.string().describe("Dispatcher name, e.g. 'exec', 'cyclenext', 'swapwindow'"),
      args: z.string().optional().describe("Raw argument string for the dispatcher, if any"),
    },
    async ({ dispatcher, args }) => {
      const out = await dispatch(dispatcher, args ?? "");
      return text(out || `Ran dispatcher '${dispatcher}' ${args ?? ""}`.trim());
    },
  );

  server.tool(
    "hyprctl_raw",
    "Escape hatch: run any raw hyprctl subcommand (not 'dispatch'), e.g. 'reload', 'version', " +
      "'splash', 'layers', 'devices', 'systeminfo'. Output is returned as plain text; pass '-j' " +
      "yourself as the first arg if you want JSON.",
    {
      args: z.array(z.string()).describe("Argv to pass to hyprctl, e.g. ['devices'] or ['-j', 'layers']"),
    },
    async ({ args }) => {
      const out = await runHyprctl(args);
      return text(out);
    },
  );
}
