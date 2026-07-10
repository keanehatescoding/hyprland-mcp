import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dispatchLua, luaCall, runHyprctl } from "../hyprctl.js";

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
    "Escape hatch: run any Hyprland dispatcher not covered by a dedicated tool. As of Hyprland " +
      "0.55, `hyprctl dispatch` takes a single Lua expression that must evaluate to a dispatcher " +
      "table built from the hl.dsp.* namespace (e.g. hl.dsp.window.tag, hl.dsp.group.toggle, " +
      "hl.dsp.submap, hl.dsp.cursor.move, hl.dsp.exec_cmd) — it is NOT the old " +
      "`hyprctl dispatch <name> <args>` positional form, which will error under 0.55+. " +
      "Give EITHER (path + args) to have this tool build the call for you, OR raw_expression " +
      "for anything with unusual shape (e.g. a dispatcher taking a bare string/number instead of " +
      "a table, like hl.dsp.exec_cmd('firefox') or hl.dsp.submap(\"reset\")). Check " +
      "https://wiki.hypr.land/Configuring/Basics/Dispatchers/ or your Lua LSP stubs for the " +
      "current dispatcher list and signatures if unsure.",
    {
      path: z
        .string()
        .optional()
        .describe("Dot path under hl.dsp, e.g. 'hl.dsp.window.tag' or 'hl.dsp.group.toggle'"),
      args: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe("Table of named args for `path`, e.g. { tag: '+code' }. Omit for a no-arg call."),
      raw_expression: z
        .string()
        .optional()
        .describe(
          "A full Lua expression to pass straight to `hyprctl dispatch`, e.g. " +
            "\"hl.dsp.exec_cmd('firefox')\" or 'hl.dsp.submap(\"reset\")'. Use this when the " +
            "dispatcher doesn't take a plain named-args table.",
        ),
    },
    async ({ path, args, raw_expression }) => {
      const expr = raw_expression ?? (path ? luaCall(path, args) : undefined);
      if (!expr) {
        throw new Error("Provide either 'path' (with optional 'args') or 'raw_expression'.");
      }
      const out = await dispatchLua(expr);
      return text(out || `Ran: ${expr}`);
    },
  );

  server.tool(
    "hyprctl_raw",
    "Escape hatch: run any raw hyprctl subcommand that ISN'T 'dispatch' — e.g. 'reload', " +
      "'version', 'splash', 'layers', 'devices', 'systeminfo'. These take plain argv, not Lua " +
      "expressions (only 'dispatch' changed syntax in 0.55). Pass '-j' yourself as the first arg " +
      "if you want JSON output.",
    {
      args: z.array(z.string()).describe("Argv to pass to hyprctl, e.g. ['devices'] or ['-j', 'layers']"),
    },
    async ({ args }) => {
      const out = await runHyprctl(args);
      return text(out);
    },
  );
}
