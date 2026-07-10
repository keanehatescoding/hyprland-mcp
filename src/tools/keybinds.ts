import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runHyprctlJson, HyprBind } from "../hyprctl.js";

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

export function registerKeybindTools(server: McpServer) {
  server.tool(
    "list_keybinds",
    "List all configured keybindings, including modmask, key, dispatcher, and argument.",
    {},
    async () => {
      const binds = await runHyprctlJson<HyprBind[]>(["binds"]);
      return text(binds);
    },
  );
}
