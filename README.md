# hyprland-mcp

An MCP server that lets Claude control [Hyprland](https://hyprland.org) through `hyprctl`.

Talks to Hyprland over its IPC socket via `hyprctl`/`hyprctl -j`, and shells out to
`grim`/`slurp`/`notify-send` for screenshots and notifications. Runs over stdio, so
it only works when launched **inside your Hyprland session** (or with
`HYPRLAND_INSTANCE_SIGNATURE` forwarded to it).

## Tools

- **Windows**: `list_windows`, `get_active_window`, `focus_window`, `close_window`,
  `kill_active_window`, `move_window_to_workspace`, `move_active_window`,
  `resize_active_window`, `toggle_floating`, `toggle_fullscreen`, `pin_window`
- **Workspaces**: `list_workspaces`, `get_active_workspace`, `switch_workspace`,
  `move_workspace_to_monitor`, `rename_workspace`
- **Monitors**: `list_monitors`, `focus_monitor`, `set_monitor_config`
- **Config**: `get_config_option`, `set_config_option`, `reload_hyprland_config`,
  `get_hyprland_version`
- **Keybinds**: `list_keybinds`
- **Notifications**: `send_notification`, `dismiss_notifications`
- **Screenshots**: `take_screenshot`, `take_region_screenshot` (interactive, via slurp),
  `screenshot_active_window`
- **Escape hatches**: `hyprland_dispatch` (any `hyprctl dispatch <dispatcher>`),
  `hyprctl_raw` (any raw `hyprctl` subcommand)

## Requirements

- Node.js 18+
- Hyprland (obviously) with `hyprctl` on `PATH`
- Optional: `grim` + `slurp` for screenshots, `notify-send` (mako/dunst/similar) for
  notifications — these tools degrade gracefully or error clearly if missing

## Build

```bash
npm install
npm run build
```

This produces `build/index.js`.

## Wire it up

### Claude Code

```bash
claude mcp add hyprland -- node /absolute/path/to/hyprland-mcp/build/index.js
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hyprland": {
      "command": "node",
      "args": ["/absolute/path/to/hyprland-mcp/build/index.js"]
    }
  }
}
```

Claude Desktop on Linux is launched by your session, so `HYPRLAND_INSTANCE_SIGNATURE`
should already be in its environment. If you ever run this from a context that doesn't
have it (e.g. a systemd unit, SSH session, or this same tool running Claude Code from
inside a sandbox), export it first, e.g.:

```bash
export HYPRLAND_INSTANCE_SIGNATURE=$(ls /tmp/hypr | head -n1)
```

## Design notes

- All `hyprctl` calls go through `execFile` (never a shell), so arguments can never be
  used for shell injection.
- Read commands (`list_*`, `get_*`) always go through `hyprctl -j` and get parsed as
  JSON so Claude gets structured data, not text to eyeball.
- Every dedicated tool is a thin wrapper around a specific dispatcher/subcommand.
  `hyprland_dispatch` and `hyprctl_raw` exist as escape hatches for anything not yet
  wrapped (Hyprland adds dispatchers between releases) — check
  `hyprctl dispatch --help` or the [Hyprland wiki](https://wiki.hyprland.org) for the
  full list.
- Screenshot tools write to a temp dir, base64-encode, and clean up after themselves.
- Move/resize tools use Hyprland's `exact`/relative dispatcher argument conventions
  (`moveactive`, `resizeactive`) rather than reimplementing geometry math.

## Extending

Add a new file under `src/tools/`, export a `register*Tools(server)` function, and
call it from `src/index.ts`. Keep one `hyprctl` concern (e.g. layers, devices,
pin/special-workspaces) per file so the project stays easy to navigate.
