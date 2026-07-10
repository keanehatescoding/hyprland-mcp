import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, runHyprctl, runHyprctlJson, HyprMonitor } from "../hyprctl.js";
import { focusMonitorExpr } from "../dispatch-expressions.js";

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
    "Move focus to a given monitor. NOTE: unlike window/workspace dispatchers, the 0.55+ Lua path " +
      "for monitor focus isn't documented anywhere confirmable at authoring time — this guesses " +
      "hl.dsp.focus() (the same top-level dispatcher used for window focus) also accepts a " +
      "`monitor` key. If it errors, use hyprland_dispatch with a raw_expression checked against " +
      "your Lua LSP stubs instead.",
    {
      monitor: z.union([z.number(), z.string()]).describe("Monitor id, name, or direction (l/r/u/d)"),
    },
    async ({ monitor }) => {
      const out = await dispatchLua(focusMonitorExpr(monitor));
      return text(out || `Focused monitor ${monitor}`);
    },
  );

  server.tool(
    "set_monitor_config",
    "Apply a monitor config via 'hyprctl keyword monitor', same syntax as hyprland.conf's monitor= line. " +
      "Useful for resolution/position/scale/enable-disable changes. Unlike 'dispatch', 'keyword' is a " +
      "config-value setter rather than the dispatch mechanism that changed in 0.55, so this should be " +
      "unaffected — but if it errors on your version, the Lua equivalent is likely " +
      "hl.config({ monitor = { ... } }), which isn't reachable through this tool's escape hatches " +
      "(they're dispatch-only) and would need a small code change.",
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
