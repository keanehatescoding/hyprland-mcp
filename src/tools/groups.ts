import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua } from "../hyprctl.js";
import {
  toggleGroupExpr,
  groupCycleExpr,
  toggleGroupLockExpr,
  groupActiveWindowExpr,
  moveGroupWindowExpr,
  denyWindowFromGroupExpr,
} from "../dispatch-expressions.js";

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

export function registerGroupTools(server: McpServer) {
  server.tool(
    "toggle_group",
    "Make a group from the active window (like i3wm's 'tabbed' container), or ungroup it if it's " +
      "already grouped. Confirmed: hl.dsp.group.toggle().",
    {},
    async () => {
      const out = await dispatchLua(toggleGroupExpr());
      return text(out || "Toggled group on active window");
    },
  );

  server.tool(
    "group_cycle",
    "Cycle to the next or previous window within the active group. Confirmed: hl.dsp.group.next() " +
      "and hl.dsp.group.prev().",
    {
      direction: z.enum(["next", "prev"]),
    },
    async ({ direction }) => {
      const out = await dispatchLua(groupCycleExpr(direction));
      return text(out || `Cycled to ${direction} window in group`);
    },
  );

  server.tool(
    "toggle_group_lock",
    "Lock/unlock the active group so new windows can't (or can) join it automatically. Confirmed " +
      "path: hl.dsp.group.lock(); exact toggle-vs-explicit-state argument shape isn't documented " +
      "anywhere I could confirm, so this calls it with no arguments (assumed toggle, matching the " +
      "pattern of group.toggle()). If it doesn't behave as expected, try hyprland_dispatch with a " +
      "raw_expression like \"hl.dsp.group.lock({ action = 'toggle' })\" instead.",
    {},
    async () => {
      const out = await dispatchLua(toggleGroupLockExpr());
      return text(out || "Toggled group lock");
    },
  );

  server.tool(
    "deny_window_from_group",
    "Prevent a window from being added to a group, or from becoming a group itself. NOTE: this is " +
      "documented as existing ('the window.deny_from_group dispatcher') but its Lua path is a " +
      "best-effort guess (hl.dsp.window.deny_from_group) by analogy with the other window.* " +
      "dispatchers — not directly confirmed. Verify before relying on it.",
    {
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ target }) => {
      const out = await dispatchLua(denyWindowFromGroupExpr(target));
      return text(out || "Toggled deny-from-group on window");
    },
  );

  server.tool(
    "group_active_window",
    "Switch to a specific window within the active group by its index (0-based). " +
      "If the window isn't in a group, this is a no-op.",
    {
      index: z
        .number()
        .int()
        .min(0)
        .describe("Zero-based index of the target window within the group"),
      target: z
        .string()
        .optional()
        .describe("Window address or selector; omit for active window"),
    },
    async ({ index, target }) => {
      const out = await dispatchLua(groupActiveWindowExpr({ index, target }));
      return text(out || `Switched to group window at index ${index}`);
    },
  );

  server.tool(
    "move_window_in_group",
    "Move a window forward or backward within its group's tab order. Forward moves it " +
      "toward the front (most-recently-focused), backward toward the back.",
    {
      forward: z
        .boolean()
        .optional()
        .describe("true (default) to move forward/backward in the group tab order"),
      target: z
        .string()
        .optional()
        .describe("Window address or selector; omit for active window"),
    },
    async ({ forward, target }) => {
      const out = await dispatchLua(moveGroupWindowExpr({ forward, target }));
      return text(
        out || `Moved window ${forward !== false ? "forward" : "backward"} in group`,
      );
    },
  );
}
