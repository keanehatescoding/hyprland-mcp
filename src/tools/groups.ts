import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, luaCall } from "../hyprctl.js";

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

function selectorFor(target: string): string {
  return target.startsWith("0x") ? `address:${target}` : target;
}

export function registerGroupTools(server: McpServer) {
  server.tool(
    "toggle_group",
    "Make a group from the active window (like i3wm's 'tabbed' container), or ungroup it if it's " +
      "already grouped. Confirmed: hl.dsp.group.toggle().",
    {},
    async () => {
      const out = await dispatchLua(luaCall("hl.dsp.group.toggle"));
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
      const out = await dispatchLua(luaCall(`hl.dsp.group.${direction}`));
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
      const out = await dispatchLua(luaCall("hl.dsp.group.lock"));
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
      const expr = luaCall("hl.dsp.window.deny_from_group", {
        window: target ? selectorFor(target) : undefined,
      });
      const out = await dispatchLua(expr);
      return text(out || "Toggled deny-from-group on window");
    },
  );
}
