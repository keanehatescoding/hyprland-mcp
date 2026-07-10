import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatch, runHyprctlJson, HyprWorkspace } from "../hyprctl.js";

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
      const out = await dispatch("workspace", `${workspace}`);
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
      const out = await dispatch("moveworkspacetomonitor", `${workspace} ${monitor}`);
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
      const out = await dispatch("renameworkspace", `${workspace} ${name}`);
      return text(out || `Renamed workspace ${workspace} to ${name}`);
    },
  );
}
