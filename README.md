# hyprland-mcp

An MCP server that lets Claude control [Hyprland](https://hyprland.org) through `hyprctl`.

Talks to Hyprland over its IPC socket via `hyprctl`/`hyprctl -j`, and shells out to
`grim`/`slurp`/`notify-send` for screenshots and notifications. Runs over stdio, so
it only works when launched **inside your Hyprland session** (or with
`HYPRLAND_INSTANCE_SIGNATURE` forwarded to it).

## Tools

- **Windows**: `list_windows`, `get_active_window`, `focus_window`, `close_window`,
  `kill_active_window`, `kill_window`, `send_window_signal`, `move_window_to_workspace`,
  `move_active_window`, `resize_active_window`, `toggle_floating`, `toggle_pseudo_tiled`,
  `toggle_fullscreen`, `set_fullscreen_state`, `pin_window`, `bring_window_to_top`,
  `center_window`, `cycle_next_window`, `swap_window`, `alter_z_order`, `toggle_swallow`
- **Workspaces**: `list_workspaces`, `get_active_workspace`, `switch_workspace`,
  `move_workspace_to_monitor`, `rename_workspace`, `toggle_special_workspace`,
  `change_workspace_id`, `swap_monitor_workspaces`
- **Monitors**: `list_monitors`, `focus_monitor`, `set_monitor_config`
- **Config**: `get_config_option`, `set_config_option`, `reload_hyprland_config`,
  `get_hyprland_version`
- **Keybinds**: `list_keybinds`
- **Notifications**: `send_notification`, `dismiss_notifications`
- **Screenshots**: `take_screenshot`, `take_region_screenshot` (interactive, via slurp),
  `screenshot_active_window`
- **App launcher**: `toggle_launcher`, `prewarm_launcher_daemon` (controls
  [hyprlauncher](https://github.com/hyprwm/hyprlauncher), Hyprland's first-party
  app picker — a self-toggling daemon, not a hyprctl dispatcher)
- **Tags**: `tag_window`, `clear_window_tags`
- **Groups (tabbed containers)**: `toggle_group`, `group_cycle`, `toggle_group_lock`,
  `deny_window_from_group`, `group_active_window`, `move_window_in_group`
- **Cursor**: `move_cursor`, `move_cursor_to_corner`, `focus_direction`
- **System**: `set_submap`, `exec_raw`, `exec_cmd`, `toggle_dpms`, `layout_message`,
  `list_instances`, `exit_hyprland`
- **hyprsunset (blue light filter)**: `set_sunset_temperature`, `disable_sunset_filter`,
  `set_sunset_gamma`, `reset_sunset`, `get_sunset_profile`
- **hyprpaper (wallpaper)**: `set_wallpaper`, `list_active_wallpapers`
- **hypridle (idle management)**: `start_hypridle`, `stop_hypridle`, `get_hypridle_status`
- **hyprlock (screen lock)**: `lock_screen`, `unlock_screen`, `refresh_lockscreen`,
  `get_lock_status`, `clear_crashed_lockscreen`
- **hyprpicker (color picker)**: `pick_color`
- **Escape hatches**: `hyprland_dispatch` (any `hyprctl dispatch <dispatcher>`),
  `hyprctl_raw` (any raw `hyprctl` subcommand)

## Requirements

- Node.js 18+
- Hyprland (obviously) with `hyprctl` on `PATH`
- Optional: `grim` + `slurp` for screenshots, `notify-send` (mako/dunst/similar) for
  notifications, [`hyprlauncher`](https://github.com/hyprwm/hyprlauncher) for the app
  launcher tools, [`hyprsunset`](https://github.com/hyprwm/hyprsunset) for blue-light
  filter tools, [`hyprpaper`](https://github.com/hyprwm/hyprpaper) (with `ipc = true`,
  the default, in `hyprpaper.conf`) for wallpaper tools,
  [`hypridle`](https://github.com/hyprwm/hypridle)/[`hyprlock`](https://github.com/hyprwm/hyprlock)
  for idle/lock tools, [`hyprpicker`](https://github.com/hyprwm/hyprpicker) (+
  `wl-clipboard` for its autocopy option) for the color picker tool, `pgrep`/`pkill`
  (procps/procps-ng, virtually always preinstalled) for the hypridle/hyprlock and
  hyprlauncher tools — these all degrade gracefully or error clearly if missing

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

## Testing

`src/dispatch-expressions.ts` holds pure, side-effect-free builders for every Lua
expression this project sends to `hyprctl dispatch` — no `hyprctl`/`child_process`
calls, so they're unit-testable without a real Hyprland session:

```bash
npm test
```

This runs `tsc` then Node's built-in test runner over
`src/__tests__/dispatch-expressions.test.ts`, asserting the exact string each
builder produces — including the two verbatim wiki examples (`window.tag` with a
target, `workspace.toggle_special`'s bare-string argument). This is what actually
catches syntax drift: when a future Hyprland release changes an `hl.dsp.*` shape,
update the builder and its test together rather than only touching the call site
buried inside a tool handler.

It already caught one real bug during development: `denyWindowFromGroupExpr()`
with no target was emitting `hl.dsp.window.deny_from_group({  })` (an empty table)
instead of a clean `()`, because the builder always passed an args object even when
every key in it was `undefined`. Worth knowing if you add a new builder where a
target/selector is the *only* possible key — `luaCall()` in `src/hyprctl.ts` now
auto-detects all-`undefined` objects and collapses them to a bare `path()` call,
but it's still good practice to build the whole args object conditionally for
non-obvious cases. A similar `luaCall` improvement (auto-collapsing empty tables to
bare `()`) also fixed the same edge case for `clearWindowTagsExpr`, `bringWindowToTopExpr`,
`centerWindowExpr`, `cycleNextWindowExpr`, and `moveGroupWindowExpr` when called
without targets.

## Security note: `unlock_screen`

`hyprlock` has no password-aware IPC — its only documented unlock mechanism is
`SIGUSR1` (`pkill -USR1 hyprlock`), which this project's `unlock_screen` tool uses
directly. That means it **bypasses PAM/password authentication entirely**: anything
able to invoke this MCP tool can unlock a locked session without knowing the
password. This isn't a bug or an oversight, it's the only unlock mechanism hyprlock
exposes — but it does mean access to this MCP server should be treated as
equivalent in sensitivity to your screen lock's own security boundary. Don't wire
this server up somewhere a lock screen is meant to be a real barrier (e.g. a
shared/untrusted machine) without accounting for that.

## Design notes

- `hyprsunset` and `hyprpaper` are controlled through their own `hyprctl <name> <args>`
  subcommand families (`hyprctl hyprsunset ...`, `hyprctl hyprpaper ...`) — like
  `keyword`/`getoption`, these are untouched by the 0.55 Lua dispatch rewrite, so
  `src/tools/hyprsunset.ts` and `hyprpaper.ts` call `runHyprctl()` directly with no
  Lua expression involved.
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
