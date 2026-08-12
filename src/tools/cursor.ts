import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua } from "../hyprctl.js";
import { moveCursorExpr, moveCursorToCornerExpr, focusDirectionExpr } from "../dispatch-expressions.js";

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

export function registerCursorTools(server: McpServer) {
  server.tool(
    "move_cursor",
    "Move the cursor to absolute screen coordinates. Confirmed: hl.dsp.cursor.move({ x, y }).",
    {
      x: z.number(),
      y: z.number(),
    },
    async ({ x, y }) => {
      const out = await dispatchLua(moveCursorExpr({ x, y }));
      return text(out || `Moved cursor to ${x},${y}`);
    },
  );

  server.tool(
    "move_cursor_to_corner",
    "Move the cursor to one of a window's four corners. Confirmed: " +
      "hl.dsp.cursor.move_to_corner({ corner, window? }).",
    {
      corner: z
        .number()
        .int()
        .min(0)
        .max(3)
        .describe("0-3, identifying which of the window's four corners to move to"),
      target: z.string().optional().describe("Window address or selector; omit for active window"),
    },
    async ({ corner, target }) => {
      const out = await dispatchLua(moveCursorToCornerExpr({ corner, target }));
      return text(out || `Moved cursor to corner ${corner}`);
    },
  );

  server.tool(
    "focus_direction",
    "Move window focus in a cardinal direction (l=left, r=right, u=up, d=down). " +
      "This is the programmatic equivalent of moving focus with arrow-key/window-hopping keybinds. " +
      "Confirmed: hl.dsp.focus({ direction = 'l' }).",
    {
      direction: z
        .enum(["l", "r", "u", "d"])
        .describe("Direction to move focus: l (left), r (right), u (up), d (down)"),
    },
    async ({ direction }) => {
      const out = await dispatchLua(focusDirectionExpr(direction));
      return text(out || `Focused window in direction ${direction}`);
    },
  );
}
