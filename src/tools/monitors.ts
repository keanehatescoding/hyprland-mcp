import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatch, runHyprctl, runHyprctlJson, HyprMonitor } from "../hyprctl.js";

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

export function registerMonitorTools(server: McpServer) {
  server.tool(
    "list_monitors",
    "List all connected monitors with resolution, position, scale, refresh rate, and active workspace.",
    {},
    async () => {
      const monitors = await runHyprctlJson<HyprMonitor[]>(["monitors"]);
      return text(monitors);
    },
  );

  server.tool(
    "focus_monitor",
    "Move focus to a given monitor.",
    {
      monitor: z.union([z.number(), z.string()]).describe("Monitor id, name, or direction (l/r/u/d)"),
    },
    async ({ monitor }) => {
      const out = await dispatch("focusmonitor", `${monitor}`);
      return text(out || `Focused monitor ${monitor}`);
    },
  );

  server.tool(
    "set_monitor_config",
    "Apply a monitor config via 'hyprctl keyword monitor', same syntax as hyprland.conf's monitor= line. Useful for resolution/position/scale/enable-disable changes.",
    {
      config: z
        .string()
        .describe(
          "e.g. 'DP-1,1920x1080@144,0x0,1' or 'HDMI-A-1,disable' or 'eDP-1,preferred,auto,1.5'",
        ),
    },
    async ({ config }) => {
      const out = await runHyprctl(["keyword", "monitor", config]);
      return text(out || `Applied monitor config: ${config}`);
    },
  );
}
