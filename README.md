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
- **App launcher**: `toggle_launcher`, `prewarm_launcher_daemon` (controls
  [hyprlauncher](https://github.com/hyprwm/hyprlauncher), Hyprland's first-party
  app picker — a self-toggling daemon, not a hyprctl dispatcher)
- **Tags**: `tag_window`
- **Groups (tabbed containers)**: `toggle_group`, `group_cycle`, `toggle_group_lock`,
  `deny_window_from_group`
- **Cursor**: `move_cursor`, `move_cursor_to_corner`
- **Escape hatches**: `hyprland_dispatch` (any `hyprctl dispatch <dispatcher>`),
  `hyprctl_raw` (any raw `hyprctl` subcommand)

## Requirements

- Node.js 18+
- Hyprland (obviously) with `hyprctl` on `PATH`
- Optional: `grim` + `slurp` for screenshots, `notify-send` (mako/dunst/similar) for
  notifications, [`hyprlauncher`](https://github.com/hyprwm/hyprlauncher) for the app
  launcher tools — these tools degrade gracefully or error clearly if missing

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

## Hyprland 0.55+ Lua dispatch syntax

Hyprland 0.55 replaced hyprlang config with a Lua-based one, and — independent of
which config format *your own* hyprland.conf/.lua uses — the running 0.55+ binary
now parses `hyprctl dispatch <arg>` as a single Lua expression rather than the old
`<dispatcher-name> <args>` positional form. `hyprctl dispatch workspace 3` will error
on 0.55+; the equivalent is `hyprctl dispatch 'hl.dsp.workspace.change({workspace=3})'`.

This project targets that new syntax throughout (`src/hyprctl.ts` has `luaCall()` /
`dispatchLua()` helpers for building these expressions). Confidence varies by dispatcher:

- **Confirmed against the Hyprland wiki / a working example**: `hl.dsp.focus`,
  `hl.dsp.window.{close,kill,move,resize,float,fullscreen,tag}`,
  `hl.dsp.workspace.{change,rename,move_to_monitor,toggle_special}`,
  `hl.dsp.group.{toggle,next,prev}`, `hl.dsp.cursor.{move,move_to_corner}`,
  `hl.dsp.exec_cmd`, `hl.dsp.submap`, `hl.dsp.pass`, `hl.dsp.send_shortcut`.
- **Best-effort guesses, flagged in code/tool descriptions** — verify before relying
  on them: `pin_window`, `focus_monitor`, `toggle_group_lock` (the `hl.dsp.group.lock`
  path is confirmed to exist, but its argument shape isn't — called with no args
  here), `deny_window_from_group` (path itself is unconfirmed, only that the
  dispatcher exists), and the notification dispatchers (`send_notification`'s
  fallback, `dismiss_notifications`). None of these are in any wiki page or example
  found as of this writing; if they error, use `hyprland_dispatch` with a
  `raw_expression` you've checked against your own Lua LSP stubs (wiki: "Expanding
  functionality" → LSP setup) or `hyprctl dispatch --help`.
- `hyprctl keyword`/`getoption`/`reload`/`version` (used by `config.ts`) are a
  separate, non-dispatch subcommand family and should be unaffected by this change —
  they weren't reported broken anywhere in the sources checked.

This is a fast-moving part of Hyprland (0.55.0 → 0.55.3 shipped within about two
months of each other, with dispatcher-behavior bugfixes in each). If something that
used to work here breaks after a Hyprland update, check the dispatcher's current
signature on the wiki before assuming the MCP server itself regressed.

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
target/selector is the *only* possible key — build the whole args object
conditionally rather than relying on `luaCall`'s undefined-key filtering to save you.

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
