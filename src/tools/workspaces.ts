import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, runHyprctlJson, HyprWorkspace } from "../hyprctl.js";
import { switchWorkspaceExpr, moveWorkspaceToMonitorExpr, renameWorkspaceExpr, toggleSpecialWorkspaceExpr, changeWorkspaceIdExpr, swapMonitorWorkspacesExpr } from "../dispatch-expressions.js";

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

export function registerWorkspaceTools(server: McpServer) {
  server.tool(
    "list_workspaces",
    "List all workspaces across all monitors, including window counts and last-focused window.",
    {},
    async () => {
      const workspaces = await runHyprctlJson<HyprWorkspace[]>(["workspaces"]);
      return text(workspaces);
    },
  );

  server.tool(
    "get_active_workspace",
    "Get the currently active workspace on the focused monitor.",
    {},
    async () => {
      const ws = await runHyprctlJson<HyprWorkspace>(["activeworkspace"]);
      return text(ws);
    },
  );

  server.tool(
    "switch_workspace",
    "Switch the focused monitor to a given workspace.",
    {
      workspace: z
        .union([z.number(), z.string()])
        .describe("Workspace id, name, or relative selector like 'e+1' / 'e-1'"),
    },
    async ({ workspace }) => {
      const out = await dispatchLua(switchWorkspaceExpr(workspace));
      return text(out || `Switched to workspace ${workspace}`);
    },
  );

  server.tool(
    "move_workspace_to_monitor",
    "Move an entire workspace (and all its windows) to a different monitor.",
    {
      workspace: z.union([z.number(), z.string()]),
      monitor: z.union([z.number(), z.string()]).describe("Monitor id or name"),
    },
    async ({ workspace, monitor }) => {
      const out = await dispatchLua(moveWorkspaceToMonitorExpr({ workspace, monitor }));
      return text(out || `Moved workspace ${workspace} to monitor ${monitor}`);
    },
  );

  server.tool(
    "rename_workspace",
    "Rename a workspace by id.",
    {
      workspace: z.number(),
      name: z.string(),
    },
    async ({ workspace, name }) => {
      const out = await dispatchLua(renameWorkspaceExpr({ workspace, name }));
      return text(out || `Renamed workspace ${workspace} to ${name}`);
    },
  );

  server.tool(
    "toggle_special_workspace",
    "Show or hide a named special workspace (Hyprland's version of a scratchpad) on the current " +
      "monitor. To put a window INTO a special workspace in the first place, use " +
      "move_window_to_workspace with workspace set to 'special:<name>' — this tool only toggles " +
      "its visibility. Confirmed: hl.dsp.workspace.toggle_special('name') (bare string arg, not a table).",
    {
      name: z.string().describe("Special workspace name, without the 'special:' prefix, e.g. 'magic'"),
    },
    async ({ name }) => {
      const out = await dispatchLua(toggleSpecialWorkspaceExpr(name));
      return text(out || `Toggled special workspace '${name}'`);
    },
  );

  server.tool(
    "change_workspace_id",
    "Change a workspace's numeric ID. The workspace keeps all its windows, monitor, and " +
      "settings — only the number changes. Useful for normalizing workspace numbering or " +
      "fixing collisions after workspace rules. The new ID must not already be in use and must be > 0.",
    {
      workspace: z
        .number()
        .int()
        .positive()
        .describe("Current workspace ID to rename (e.g. 1, 2, 3)"),
      new_id: z
        .number()
        .int()
        .positive()
        .describe("New workspace ID to assign (must not be in use, must be > 0)"),
    },
    async ({ workspace, new_id }) => {
      const out = await dispatchLua(changeWorkspaceIdExpr({ workspace, id: new_id }));
      return text(out || `Changed workspace ${workspace} to ID ${new_id}`);
    },
  );

  server.tool(
    "swap_monitor_workspaces",
    "Swap the workspaces currently shown on two monitors. A convenience over " +
      "individually moving each workspace — swaps the active workspaces between two monitors.",
    {
      monitor1: z
        .union([z.number(), z.string()])
        .describe("First monitor (id or name, e.g. 0 or 'DP-1')"),
      monitor2: z
        .union([z.number(), z.string()])
        .describe("Second monitor (id or name, e.g. 1 or 'HDMI-A-1')"),
    },
    async ({ monitor1, monitor2 }) => {
      const out = await dispatchLua(
        swapMonitorWorkspacesExpr({ monitor1, monitor2 }),
      );
      return text(out || `Swapped workspaces on monitors ${monitor1} and ${monitor2}`);
    },
  );
}
