#!/usr/bin/env bash
# Run this ON YOUR MACHINE, inside your Hyprland session.
# Exercises the notify/hyprsunset/hyprpaper tools directly via hyprctl.
#
# hyprsunset and hyprpaper tests will fail with a connection-style error (not a
# syntax error) if those daemons aren't currently running — that's expected and
# not a bug in this project; just note whether they're running when you report back.
#
# Optional: pass a wallpaper image path as $1 to also test set_wallpaper, e.g.:
#   ./test-notify-sunset-paper.sh ~/Pictures/wall.png

set -uo pipefail

run() {
  local desc="$1"; shift
  echo "=================================================================="
  echo "TEST: $desc"
  echo "CMD:  $*"
  echo "---"
  "$@"
  echo "(exit code: $?)"
  echo
}

if [ -z "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
  echo "HYPRLAND_INSTANCE_SIGNATURE is not set — run this inside your actual Hyprland session."
  exit 1
fi

# ---- notifications (hyprctl notify / dismissnotify — NOT Lua) ----

run "send_notification fallback mechanism (should show an on-screen notification, icon=Info)" \
  hyprctl notify 1 4000 0 "hyprland-mcp test notification"

sleep 1

run "dismiss_notifications (should clear the notification above)" \
  hyprctl dismissnotify -1

# ---- hyprsunset ----

run "hyprsunset baseline: identity (resets filter to normal — should be a visual no-op if already normal)" \
  hyprctl hyprsunset identity

run "set_sunset_temperature (screen should visibly warm up/tint orange)" \
  hyprctl hyprsunset temperature 3000

run "set_sunset_gamma absolute (screen brightness should visibly change)" \
  hyprctl hyprsunset gamma 70

run "reset_sunset (fixed in Hyprland 0.56+ — the v0.3.3 'invalid command' bug is resolved)" \
  hyprctl hyprsunset reset

run "get_sunset_profile (returns the active time-based profile)" \
  hyprctl hyprsunset profile

run "cleanup: back to identity" \
  hyprctl hyprsunset identity

# ---- hyprpaper ----

run "list_active_wallpapers (safe, read-only)" \
  hyprctl hyprpaper listactive

if [ -n "${1:-}" ]; then
  run "set_wallpaper with $1 (should visibly change your wallpaper)" \
    hyprctl hyprpaper wallpaper ",$1"
else
  echo "(skipping set_wallpaper test — pass an image path as \$1 to test it, e.g.:"
  echo " ./test-notify-sunset-paper.sh ~/Pictures/wall.png)"
fi

echo "=================================================================="
echo "Paste back:"
echo "  1) exact output/errors for each test"
echo "  2) whether the notification actually appeared, then actually disappeared"
echo "  3) whether the screen visibly warmed/dimmed for the hyprsunset tests"
echo "  4) whether hyprsunset/hyprpaper daemons were even running when you ran this"
echo "  5) if you tested set_wallpaper: did it visibly change?"
