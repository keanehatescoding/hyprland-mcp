#!/usr/bin/env bash
# Run this ON YOUR MACHINE, inside your Hyprland session.
#
# ** WARNING: this WILL briefly lock your real screen. ** The script auto-unlocks
# itself via SIGUSR1 within ~2 seconds, but if that mechanism fails for any reason
# on your setup, you'll be stuck at a real hyprlock screen needing your actual
# password to get back in. Know your password before running this.
#
# hypridle tests preserve whatever state (running/not running) it was in before
# the script ran, restoring it at the end.

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

# For daemons that don't exit on their own (hypridle, hyprlock) — start detached
# and don't try to print an exit code, since there won't be one during this script.
start_detached() {
  local desc="$1" cmd="$2"
  echo "=================================================================="
  echo "TEST: $desc"
  echo "CMD:  $cmd (detached)"
  echo "---"
  setsid "$cmd" < /dev/null > /dev/null 2>&1 &
  disown
  echo "(spawned, pid $!)"
  echo
}

hypridle_running() {
  pgrep -x hypridle > /dev/null 2>&1 && echo "hypridle is running." || echo "hypridle is not running."
}

lock_running() {
  pgrep -x hyprlock > /dev/null 2>&1 && echo "Screen is locked." || echo "Screen is not locked."
}

if [ -z "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
  echo "HYPRLAND_INSTANCE_SIGNATURE is not set — run this inside your actual Hyprland session."
  exit 1
fi

# ---- pick_color ----

echo "About to test pick_color — hyprpicker will launch and turn your cursor into a"
echo "magnifying lens. Click any pixel on screen to pick a color (or press Escape to cancel)."
read -p "Press Enter when ready..." _

run "pick_color (click something on screen)" \
  hyprpicker --no-fancy --format hex

# ---- hypridle (preserves original running/not-running state) ----

HYPRIDLE_WAS_RUNNING=0
pgrep -x hypridle > /dev/null 2>&1 && HYPRIDLE_WAS_RUNNING=1

echo "=================================================================="
echo "hypridle baseline: $(hypridle_running)"
echo

if [ "$HYPRIDLE_WAS_RUNNING" = "1" ]; then
  run "stop_hypridle (it was running, so stop it first)" pkill -TERM -x hypridle
  sleep 1
  echo "get_hypridle_status after stop (expect not running): $(hypridle_running)"
  echo
  start_detached "start_hypridle (restore original running state)" hypridle
  sleep 1
  echo "get_hypridle_status after restore (expect running): $(hypridle_running)"
else
  start_detached "start_hypridle (it wasn't running, so start it)" hypridle
  sleep 1
  echo "get_hypridle_status after start (expect running): $(hypridle_running)"
  echo
  run "stop_hypridle (restore original not-running state)" pkill -TERM -x hypridle
  sleep 1
  echo "get_hypridle_status after restore (expect not running): $(hypridle_running)"
fi
echo

# ---- hyprlock ----

echo "About to briefly lock your screen and then auto-unlock it via SIGUSR1."
read -p "Press Enter when ready (make sure you know your password just in case)..." _

start_detached "lock_screen" hyprlock
sleep 1

echo "get_lock_status after lock (expect locked): $(lock_running)"
echo

run "refresh_lockscreen (SIGUSR2 — should redraw, low-risk)" pkill -USR2 -x hyprlock

sleep 1

run "unlock_screen (SIGUSR1)" pkill -USR1 -x hyprlock

sleep 1

echo "get_lock_status after unlock (expect not locked): $(lock_running)"

echo "=================================================================="
echo "Paste back:"
echo "  1) the color pick_color printed, and whether the format/value looked right"
echo "  2) whether hypridle's running/stopped state matched each 'expect' comment"
echo "  3) whether the screen actually locked, then actually unlocked on its own"
echo "  4) anything that errored or didn't match expectations"
