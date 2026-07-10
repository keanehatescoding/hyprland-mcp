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
| Windows | `list_windows`, `get_active_window`, `focus_window`, `close_window`, `kill_active_window`, `move_window_to_workspace`, `move_active_window`, `resize_active_window`, `toggle_floating`, `toggle_fullscreen`, `pin_window` | Per-window inspection/manipulation |
| Workspaces | `list_workspaces`, `get_active_workspace`, `switch_workspace`, `move_workspace_to_monitor`, `rename_workspace` | Workspace-level ops |
| Monitors | `list_monitors`, `focus_monitor`, `set_monitor_config` | Output layout/resolution/scale |
| Config | `get_config_option`, `set_config_option`, `reload_hyprland_config`, `get_hyprland_version` | Reading/tweaking hyprland.conf values live |
| Keybinds | `list_keybinds` | Auditing/searching existing binds |
| Notifications | `send_notification`, `dismiss_notifications` | Desktop notifications or on-screen overlay |
| Screenshots | `take_screenshot`, `take_region_screenshot`, `screenshot_active_window` | Visual capture |
| Escape hatches | `hyprland_dispatch`, `hyprctl_raw` | Anything not covered above |

**Always look up state before mutating it.** Call `list_windows` / `list_workspaces` /
`list_monitors` first to get real addresses/ids/names rather than guessing — window
addresses in particular are opaque hex strings that change every time a window is
recreated, so never reuse one from an earlier conversation turn without re-checking it
still exists.

## The 0.55+ Lua dispatch change (read this if anything dispatch-related errors)

Since Hyprland 0.55, `hyprctl dispatch <arg>` parses `<arg>` as a Lua expression that
must evaluate to a dispatcher table (something built from `hl.dsp.*`) — not the old
`hyprctl dispatch <name> <args>` positional form. Every dedicated tool in this
project already emits the new form under the hood, so this normally isn't something
you need to think about. It matters when:

- `hyprland_dispatch` (the escape hatch) is used — give it `path` + `args` (a plain
  object) for the common case, or a full `raw_expression` string for dispatchers that
  take something other than a named-args table (e.g. `hl.dsp.exec_cmd('firefox')`
  takes a bare string, `hl.dsp.submap("reset")` takes a bare string).
- A dispatch call errors unexpectedly — a few paths (`pin_window`, `focus_monitor`,
  the notification dispatchers) are best-effort guesses flagged in their tool
  descriptions because no source could confirm their exact Lua path at authoring
  time. If one of those errors, don't assume the MCP server is broken — check
  https://wiki.hypr.land/Configuring/Basics/Dispatchers/ (or the user's own Lua LSP
  stubs) for the current signature and pass it via `raw_expression`.
- `hyprctl keyword`/`getoption`/`reload`/`version` are unaffected by any of this —
  they're a separate hyprctl subcommand family, not "dispatch".

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
- **`move_window_to_workspace`**: `silent: true` moves the window without switching
  the visible workspace (`movetoworkspacesilent`); omit `target` to act on the
  currently focused window rather than passing something like `"active"`.
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

## Screenshot tools: blocking behavior

`take_region_screenshot` calls `slurp`, which pauses and waits for the user to
click-drag a region **on their real screen, right now**. Only call this tool when the
user is actively present and expecting to make a selection (e.g. they just asked "let
me select a region to screenshot") — don't call it as a background/unattended step in
a longer chain, since it will hang until someone interacts with the screen or presses
Escape to cancel.

`take_screenshot` (whole layout or `-o <monitor>`) and `screenshot_active_window` do
not block on user input and are safe to call unattended.

## Reaching for the escape hatches

Prefer a dedicated tool whenever one exists — it has validated argument shapes and a
clearer error surface. Reach for `hyprland_dispatch` when the user wants a dispatcher
with no dedicated wrapper (e.g. `cyclenext`, `swapwindow`, `layoutmsg`, `submap`,
`togglespecialworkspace`, `centerwindow`, `exec` to launch an app) — pass the
dispatcher name and a raw argument string exactly as `hyprctl dispatch` would expect
it. Reach for `hyprctl_raw` for non-dispatch subcommands not wrapped elsewhere (e.g.
`splash`, `layers`, `devices`, `systeminfo`); pass `-j` as the first array element
yourself if structured output is wanted.

If Hyprland's dispatcher/subcommand list has changed since this was written, check
`hyprctl dispatch --help` or https://wiki.hyprland.org rather than guessing syntax.

## Common request → tool mappings

- "What's open right now?" → `list_windows`
- "Move this window to workspace 3" → `move_window_to_workspace` with no `target`
  (acts on active window)
- "Send Firefox to workspace 2 without switching to it" → `move_window_to_workspace`
  with `target: "class:^(firefox)$"`, `silent: true`
- "Put my monitor at 144Hz" → `list_monitors` first to get the exact output name, then
  `set_monitor_config`
- "Screenshot this window" → `screenshot_active_window`
- "Let me grab a screenshot of part of my screen" → `take_region_screenshot`
- "What are my gaps set to?" → `get_config_option` with `"general:gaps_in"`
- "Cycle to the next window" → `hyprland_dispatch` with `dispatcher: "cyclenext"`
