---
name: hyprland-mcp
description: Use whenever the user asks Claude to inspect or control their Hyprland desktop via the hyprland-mcp server — moving/resizing/closing windows, switching or reorganizing workspaces, listing or reconfiguring monitors, taking screenshots, sending notifications, reading or tweaking live Hyprland config, or running arbitrary hyprctl/dispatcher commands. Also consult this whenever a hyprland-mcp tool call fails or returns an unexpected error, before retrying blindly — the failure is very likely one of the documented gotchas below (selector syntax, dispatcher argument format, missing HYPRLAND_INSTANCE_SIGNATURE, or a missing grim/slurp/notify-send binary), not a deeper bug.
---

# hyprland-mcp

Tool reference and gotchas for the `hyprland-mcp` MCP server (window/workspace/monitor
control, screenshots, notifications, live config, and raw hyprctl access for Hyprland).
Source lives in `src/tools/*.ts`; this file is the operational cheat sheet for actually
calling the tools correctly — read it before chaining more than one or two calls.

## Before anything else: check the environment

Every tool ultimately shells out to `hyprctl`, which needs `HYPRLAND_INSTANCE_SIGNATURE`
set in the server process's environment. If a call fails with something like
`HYPRLAND_INSTANCE_SIGNATURE is not set`, that's not a Hyprland problem — the MCP
server itself isn't running inside (or inheriting from) the Hyprland session. Fix at
the process-launch level (see README "Wire it up"), don't retry the tool call.

If a screenshot or notification tool fails with `ENOENT`/"command not found", the
underlying binary (`grim`, `slurp`, `notify-send`) just isn't installed — tell the user
rather than trying alternate arguments.

## Tool categories and when to use each

| Category | Tools | Use for |
|---|---|---|
| Windows | `list_windows`, `get_active_window`, `focus_window`, `close_window`, `kill_active_window`, `kill_window`, `send_window_signal`, `move_window_to_workspace`, `move_active_window`, `resize_active_window`, `toggle_floating`, `toggle_pseudo_tiled`, `toggle_fullscreen`, `set_fullscreen_state`, `pin_window`, `bring_window_to_top`, `center_window`, `cycle_next_window`, `swap_window`, `alter_z_order`, `toggle_swallow` | Per-window inspection/manipulation |
| Workspaces | `list_workspaces`, `get_active_workspace`, `switch_workspace`, `move_workspace_to_monitor`, `rename_workspace`, `toggle_special_workspace`, `change_workspace_id`, `swap_monitor_workspaces` | Workspace-level ops incl. scratchpad |
| Monitors | `list_monitors`, `focus_monitor`, `set_monitor_config` | Output layout/resolution/scale |
| Config | `get_config_option`, `set_config_option`, `reload_hyprland_config`, `get_hyprland_version` | Reading/tweaking hyprland.conf values live |
| Keybinds | `list_keybinds` | Auditing/searching existing binds |
| Notifications | `send_notification`, `dismiss_notifications` | Desktop notifications or on-screen overlay |
| Screenshots | `take_screenshot`, `take_region_screenshot`, `screenshot_active_window` | Visual capture |
| Launcher | `toggle_launcher`, `prewarm_launcher_daemon` | hyprlauncher, the first-party app picker |
| Tags | `tag_window`, `clear_window_tags` | Static window tags for use in window rules |
| Groups | `toggle_group`, `group_cycle`, `toggle_group_lock`, `deny_window_from_group`, `group_active_window`, `move_window_in_group` | Tabbed-container windows |
| Cursor | `move_cursor`, `move_cursor_to_corner`, `focus_direction` | Programmatic cursor placement |
| System | `set_submap`, `exec_raw`, `exec_cmd`, `toggle_dpms`, `layout_message`, `list_instances`, `exit_hyprland` | General dispatchers, hyprctl subcommands |
| hyprsunset | `set_sunset_temperature`, `disable_sunset_filter`, `set_sunset_gamma`, `reset_sunset`, `get_sunset_profile` | Blue-light filter / gamma, own `hyprctl hyprsunset` family, not Lua |
| hyprpaper | `set_wallpaper`, `list_active_wallpapers` | Wallpaper daemon, own `hyprctl hyprpaper` family, not Lua |
| hypridle | `start_hypridle`, `stop_hypridle`, `get_hypridle_status` | Idle daemon — NO hyprctl/IPC surface, process control only |
| hyprlock | `lock_screen`, `unlock_screen`, `refresh_lockscreen`, `get_lock_status`, `clear_crashed_lockscreen` | Screen lock — NO hyprctl/IPC surface, process signals only |
| hyprpicker | `pick_color` | Blocking foreground CLI — no daemon, no hyprctl |
| Escape hatches | `hyprland_dispatch`, `hyprctl_raw` | Anything not covered above |

**Always look up state before mutating it.** Call `list_windows` / `list_workspaces` /
`list_monitors` first to get real addresses/ids/names rather than guessing — window
addresses in particular are opaque hex strings that change every time a window is
recreated, so never reuse one from an earlier conversation turn without re-checking it
still exists.

## The 0.55+ Lua dispatch change (read this if anything dispatch-related errors)

Since Hyprland 0.55, `hyprctl dispatch <arg>` parses `<arg>` as a Lua expression that
must evaluate to a dispatcher table (something built from `hl.dsp.*`) — not the old
`hyprctl dispatch <name> <args>` positional form. Every dedicated tool builds its
expression via a pure function in `src/dispatch-expressions.ts` (unit tested in
`src/__tests__/dispatch-expressions.test.ts` — run `npm test`), so this normally
isn't something you need to think about. It matters when:

- `hyprland_dispatch` (the escape hatch) is used — give it `path` + `args` (a plain
  object) for the common case, or a full `raw_expression` string for dispatchers that
  take something other than a named-args table (e.g. `hl.dsp.exec_cmd('firefox')`
  takes a bare string, `hl.dsp.submap("reset")` takes a bare string).
- A dispatch call errors unexpectedly. Real testing against Hyprland 0.55.4 already
  found and fixed one wrong guess: a bare `hl.dsp.pin()` errored with
  `attempt to call a nil value`; `hl.dsp.window.pin()` is the correct path
  (confirmed by a *semantic* "doesn't qualify" warning on a real session, not a
  missing-function error — pin only works on floating windows).
- Notifications are NOT handled via Lua dispatch at all — see the next section.
- For anything else that errors: don't assume the MCP server is broken generally
  — check https://wiki.hypr.land/Configuring/Basics/Dispatchers/,
  https://wiki.hypr.land/Configuring/Advanced-and-Cool/Expanding-functionality/, or
  the user's own Lua LSP stubs, and pass the fix via `raw_expression` (or `evalLua`
  for non-dispatcher calls) until the code itself is updated.
- `hyprctl keyword`/`getoption`/`reload`/`version` are unaffected by any of this —
  they're a separate hyprctl subcommand family, not "dispatch".

## Notifications: a different mechanism entirely, not Lua

`send_notification`'s fallback and `dismiss_notifications` use `hyprctl notify
<icon> <time_ms> <color> <message>` / `hyprctl dismissnotify [amount]` — plain,
non-Lua hyprctl subcommands that predate the 0.55 rewrite by about two years.
This project's first attempt used the newer `hl.notification.create`/`get()` Lua
API instead, which a real Hyprland 0.55.4 session confirmed produces no visible
on-screen effect at all — that's why the mechanism was switched, not because the
Lua call itself was wrong. Confirmed working end-to-end on a real session
(notification appeared, then dismissnotify cleared it). `icon` is a small integer enum (0=Warning, 1=Info,
2=Hint, 3=Error, 4=Confused, 5=OK, -1=None), not a name or path — `send_notification`
maps `urgency` onto it internally. If notifications still don't appear after this
fix, that points at something else (e.g. hyprctl not reaching a real Hyprland
instance) rather than a repeat of the old Lua-rendering-gap issue.

## Wiki versioning: rolling pages track git main, not the latest release

`wiki.hypr.land`'s un-versioned pages describe git `main`, which runs ahead of
whatever Hyprland version is actually installed — confirmed the hard way when
`hyprctl repl` (documented on the rolling wiki) turned out to not exist on a real
0.55.4 session. When a specific installed version's behavior matters, prefer
version-pinned docs (`wiki.hypr.land/<version>/...`) or testing against a real
session over trusting the rolling pages at face value. Treat anything from there
that isn't corroborated by a working example, a dated GitHub PR/issue, or a real
test as "probably true for the latest release, not guaranteed."

## Selector syntax gotchas (windows tools)

Tools that take a `target` (`focus_window`, `close_window`, `move_window_to_workspace`,
`toggle_floating`) accept either:
- A raw address starting with `0x` (from `list_windows`) — the tool itself prefixes it
  with `address:` before calling hyprctl, so just pass the bare `0x...` string.
- A selector string you write yourself, e.g. `class:^(firefox)$` or `title:^(Inbox)$`
  — pass these through as-is, don't add `address:`.

Don't hand-roll `address:0x...` yourself as the `target` value — the tool already does
that prefixing, so you'd end up double-prefixed and it won't match.

## Dispatcher argument format gotchas

A few dispatchers have argument conventions that aren't obvious from the name alone:

- **`move_active_window` / `resize_active_window`**: pass `mode: "exact"` for an
  absolute position/size or `mode: "relative"` for a pixel delta from the current
  position/size. Under the hood this becomes `exact x y` vs `x y` for
  `moveactive`/`resizeactive` — don't try to pass `exact` yourself inside a raw string.
- **`move_window_to_workspace`**: `follow: false` moves the window without switching
  the visible workspace (the 0.55+ Lua equivalent of the old `silent` param — the
  parameter is named `follow`, not `silent`; `follow` defaults to true). Omit `target`
  to act on the currently focused window rather than passing something like `"active"`.
- **`set_monitor_config`**: takes the exact same comma-separated syntax as a
  `monitor=` line in `hyprland.conf` (e.g. `DP-1,1920x1080@144,0x0,1` or
  `HDMI-A-1,disable`), not separate width/height/position fields.
- **`switch_workspace`**: accepts relative selectors too (`e+1`, `e-1`) in addition to
  plain ids/names — useful for "next/previous workspace" requests.

## Config tools: live vs. persistent

`set_config_option` and `set_monitor_config` both call `hyprctl keyword`, which is a
**live, in-memory override only** — it does NOT write to `hyprland.conf`. A
`reload_hyprland_config` call, or the user restarting Hyprland, reverts it. If the user
wants a change to stick permanently, that means editing their actual config file (a
separate, file-editing task, not something these tools do) — say so rather than
implying the tool call made it permanent.

## Blocking, interactive tools: don't call these unattended

`take_region_screenshot` calls `slurp`, and `pick_color` calls `hyprpicker` —
both pause and wait for the user to interact **on their real screen, right now**
(a click-drag region selection, or a single click respectively; Escape cancels
either). Only call these when the user is actively present and clearly expecting
to interact — never as a background/unattended step in a longer chain, since
they'll hang until someone acts.

`take_screenshot` (whole layout or `-o <monitor>`) and `screenshot_active_window`
do not block on user input and are safe to call unattended.

## Reaching for the escape hatches

Prefer a dedicated tool whenever one exists — it has validated argument shapes and a
clearer error surface. Reach for `hyprland_dispatch` when the user wants a dispatcher
with no dedicated wrapper (e.g. `cyclenext`, `swapwindow`, `layoutmsg`, `submap`,
`togglespecialworkspace`, `centerwindow`, `exec` to launch an app) — pass the
dispatcher name and a raw argument string exactly as `hyprctl dispatch` would expect
it. Reach for `hyprctl_raw` for non-dispatch subcommands not wrapped elsewhere (e.g.
`splash`, `layers`, `devices`, `systeminfo`, `globalshortcuts`, `instances`); pass
`-j` as the first array element yourself if structured output is wanted.

If Hyprland's dispatcher/subcommand list has changed since this was written, check
`hyprctl dispatch --help` or https://wiki.hypr.land/Configuring/Basics/Dispatchers/
rather than guessing syntax.

## hyprlauncher: not a dispatcher

`toggle_launcher` and `prewarm_launcher_daemon` don't go through `hyprctl` at all —
hyprlauncher is a separate first-party binary that self-manages as a daemon (first
run starts it and shows its window, every run after that just toggles the window).
Both tools spawn it detached (fire-and-forget) rather than waiting for it to exit,
since it's a persistent GUI process, not a one-shot command. If it's not installed,
the error message names the binary and points at the install source rather than
failing silently.

## hyprsunset and hyprpaper: not Lua dispatchers either

Like hyprlauncher, neither of these goes through `hl.dsp.*`/`hl.notification.*` —
they're each their own `hyprctl <name> <args>` subcommand family (`hyprctl
hyprsunset ...`, `hyprctl hyprpaper ...`), same category as `keyword`/`getoption`,
so none of the 0.55 Lua-dispatch caveats above apply to them.

- **hyprsunset**: all five commands (`temperature`, `identity`/`disable_sunset_filter`,
  `gamma`, `reset_sunset`, `get_sunset_profile`) work correctly on Hyprland 0.56+
  (the v0.3.3 bug on `reset`/`profile` is fixed — bug warnings removed).
- **hyprpaper**: only `wallpaper` and `listactive` are wrapped as dedicated tools,
  matching what the current Hyprland wiki documents. Older tutorials mention
  `preload`/`reload`/`unload`/`listloaded`, but the wiki itself now says these may
  not exist on current versions — deliberately not wrapped here to avoid presenting
  version-dependent commands as reliable. If you need them, use `hyprctl_raw` with
  `["hyprpaper", "--help"]` first to check what your installed version actually
  supports. Also requires `ipc = true` (the default) in hyprpaper.conf.

## hypridle and hyprlock: no hyprctl/IPC surface at all — process control only

Unlike everything else in this project, neither of these has ANY hyprctl
subcommand or Lua path to check — confirmed against the wiki, they're controlled
purely through process lifecycle (`start_hypridle`/`lock_screen` spawn the
binary, checking first via `pgrep` to avoid double-spawning) and, for hyprlock,
Unix signals (`SIGUSR1` unlocks, `SIGUSR2` refreshes labels/images — hyprlock's
own documented mechanism, not something reverse-engineered here). If a tool in
this category errors, the likely causes are: the binary isn't installed, `pgrep`/
`pkill` aren't on PATH (part of procps, virtually always present), or — for
hyprlock specifically — a process-name mismatch if the user is running some
wrapped/renamed variant of the binary.

**`unlock_screen` bypasses password authentication.** This is hyprlock's actual
documented unlock mechanism, not a security hole introduced here, but it means
anything able to call this MCP tool can unlock a locked session with no password
check. Only call it on a clear, direct request from the user to unlock their own
session right now — never as a side effect of some other task, and never if the
request's framing suggests someone other than the session owner is asking.

## Common request → tool mappings

- "What's open right now?" → `list_windows`
- "Move this window to workspace 3" → `move_window_to_workspace` with no `target`
  (acts on active window)
- "Send Firefox to workspace 2 without switching to it" → `move_window_to_workspace`
  with `target: "class:^(firefox)$"`, `follow: false`
- "Put my monitor at 144Hz" → `list_monitors` first to get the exact output name, then
  `set_monitor_config`
- "Screenshot this window" → `screenshot_active_window`
- "Let me grab a screenshot of part of my screen" → `take_region_screenshot`
- "What are my gaps set to?" → `get_config_option` with `"general:gaps_in"`
- "Cycle to the next window" → `cycle_next_window` (or `hyprland_dispatch` with
  `raw_expression: "hl.dsp.window.cycle_next()"`)
- "Open the app launcher" / "let me search for an app" → `toggle_launcher`
- "Show/hide my scratchpad terminal" → `toggle_special_workspace` with `name`
  matching what you moved the window into via `move_window_to_workspace`
  (`workspace: "special:<name>"`)
- "Tab these windows together" → `toggle_group` (call it on the window you want to
  become the group anchor, then move other windows into the same tiled slot)
- "Tag this as a 'code' window" → `tag_window` with `tag: "+code"`
- "Remove all tags from this window" → `clear_window_tags`
- "Send SIGTERM to a window's process" → `send_window_signal` with `signal: 15`
  (or `15` for SIGTERM, `9` for SIGKILL, `10` for SIGUSR1)
- "Turn on night mode / warm up my screen" → `set_sunset_temperature` (e.g. 3000)
- "Change my wallpaper" → `set_wallpaper` (ask which monitor if they have more than one)
- "Don't let my screen lock while I'm watching this" → `stop_hypridle`
- "Lock my screen" → `lock_screen`
- "Clear a crashed/hung lockscreen" → `clear_crashed_lockscreen` (Hyprland 0.56+)
- "What color is this?" / "grab this color for me" → `pick_color`
