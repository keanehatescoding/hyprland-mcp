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
- **hyprsunset (blue light filter)**: `set_sunset_temperature`, `disable_sunset_filter`,
  `set_sunset_gamma`, `reset_sunset`, `get_sunset_profile`
- **hyprpaper (wallpaper)**: `set_wallpaper`, `list_active_wallpapers`
- **hypridle (idle management)**: `start_hypridle`, `stop_hypridle`, `get_hypridle_status`
- **hyprlock (screen lock)**: `lock_screen`, `unlock_screen`, `refresh_lockscreen`,
  `get_lock_status`
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
  for idle/lock tools, `pgrep`/`pkill` (procps/procps-ng, virtually always
  preinstalled) for the hypridle/hyprlock and hyprlauncher tools — these all
  degrade gracefully or error clearly if missing

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
`dispatchLua()` / `evalLua()` helpers; `src/dispatch-expressions.ts` holds every
generated expression as a pure, unit-tested function). Confidence tiers, now backed
by real testing against Hyprland 0.55.4 (see `scripts/test-flagged-dispatchers*.sh`):

> **A documentation lesson learned building this**: `wiki.hypr.land`'s un-versioned
> pages track git `main`, not the latest tagged release — they can (and did)
> describe features not yet in any shipped 0.55.x build. `hyprctl repl` is one
> confirmed example: documented on the rolling wiki, absent on a real 0.55.4
> session. When verifying a specific version's behavior, prefer version-pinned
> docs (`wiki.hypr.land/<version>/...`) or a real session over the rolling pages,
> and treat anything from the rolling wiki that isn't independently corroborated
> (a working example, a dated GitHub PR/issue, multiple converging sources) as
> "probably true for the latest release, not guaranteed."

- **Confirmed against the wiki, a working example, or a real 0.55.4 session**:
  `hl.dsp.focus` (including `{ monitor = ... }`), `hl.dsp.window.{close,kill,move,
  resize,float,fullscreen,tag,deny_from_group,pin}`, `hl.dsp.workspace.{change,
  rename,move_to_monitor,toggle_special}`, `hl.dsp.group.{toggle,next,prev,lock}`,
  `hl.dsp.cursor.{move,move_to_corner}`, `hl.dsp.exec_cmd`, `hl.dsp.submap`,
  `hl.dsp.pass`, `hl.dsp.send_shortcut`.
  `window.pin()` specifically: confirmed by a *semantic* rejection ("Window does not
  qualify to be pinned" — Hyprland's own pin logic rejecting a non-floating window)
  rather than the "attempt to call a nil value" error a wrong path produces, which
  is what distinguishes "right path, wrong preconditions" from "guessed wrong".
- **Confirmed BROKEN against a real session, since fixed**: a bare `hl.dsp.pin()`
  errored with `attempt to call a nil value` on Hyprland 0.55.4; corrected to
  `hl.dsp.window.pin()`.
- **Notifications: fixed by using a different mechanism entirely.** The first pass
  at this project used the newer `hl.notification.create`/`get()` Lua API, which a
  real Hyprland 0.55.4 session confirmed produces no visible on-screen effect at
  all (call succeeds, nothing renders). `send_notification`'s fallback and
  `dismiss_notifications` now use `hyprctl notify <icon> <time_ms> <color>
  <message>` / `hyprctl dismissnotify [amount]` instead — plain, non-Lua hyprctl
  subcommands that predate the 0.55 rewrite by about two years (`dismissnotify`
  merged in [hyprwm/Hyprland#4790](https://github.com/hyprwm/Hyprland/pull/4790),
  2024) and are documented with exact parameter meanings on the wiki's
  [Notifications](https://wiki.hypr.land/Configuring/Advanced-and-Cool/Notifications/)
  page. See `src/tools/notify.ts` for the confirmed icon/color parameter mapping.
  **Confirmed working end-to-end on a real session**: notification created and
  visibly appeared, then `dismissnotify` visibly cleared it.
- `hyprctl keyword`/`getoption`/`reload`/`version`/`notify`/`dismissnotify` (used by
  `config.ts`/`notify.ts`) are all plain, non-dispatch subcommand families and
  remain unaffected — confirmed by omission for the first three, and by direct
  wiki documentation predating 0.55 for the notification pair.

This is a fast-moving part of Hyprland (0.55.0 → 0.55.4 shipped within about a
month, with dispatcher-behavior bugfixes in each). If something that used to work
here breaks after a Hyprland update, check the dispatcher's current signature on
the wiki before assuming the MCP server itself regressed.

**Real-session testing status (Hyprland 0.55.4, as of this writing):** every
dispatch-based tool is confirmed correct, and the non-Lua tools (`notify`/
`dismissnotify`, `hyprsunset`, `hyprpaper`) are confirmed working end-to-end via
`scripts/test-notify-sunset-paper.sh` — notification create/dismiss, temperature/
gamma/identity, and `listactive` all behaved as expected on a real session. Every
tool in this project has now been verified against a real Hyprland instance.

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
