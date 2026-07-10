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

export function registerTagTools(server: McpServer) {
  server.tool(
    "tag_window",
    "Add, remove, or toggle a static tag on a window. Tags are used for grouping windows and can " +
      "be matched in window rules (e.g. hl.window_rule({ match = { tag = 'code' }, ... })). " +
      "Confirmed syntax: hl.dsp.window.tag({ tag = '+code' }) adds, '-code' removes, 'code' " +
      "(no prefix) toggles.",
    {
      tag: z
        .string()
        .describe(
          "Tag name with an action prefix: '+name' to add, '-name' to remove, 'name' (no prefix) to toggle",
        ),
      target: z
        .string()
        .optional()
        .describe("Window address or selector; omit to tag the currently active window"),
    },
    async ({ tag, target }) => {
      const expr = luaCall("hl.dsp.window.tag", {
        tag,
        window: target ? selectorFor(target) : undefined,
      });
      const out = await dispatchLua(expr);
      return text(out || `Applied tag '${tag}'${target ? ` to ${target}` : ""}`);
    },
  );
}
