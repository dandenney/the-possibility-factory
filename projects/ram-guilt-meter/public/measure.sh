#!/bin/sh
# RAM Guilt Meter: counts your open browser tabs and how much memory your browsers are using,
# then opens your guilt card with those numbers.
#
#   curl -fsSL https://ram-guilt-meter.netlify.app/measure.sh | sh
#
# Nothing is uploaded. The only thing this does with the numbers is put them in the link it opens.
# macOS counts tabs in Chrome, Safari, Arc, Brave, Edge, Vivaldi and Chromium via AppleScript (the first run asks
# permission to control each browser). Firefox can't be counted that way, and neither can anything on Linux,
# so it asks you instead.
set -eu

SITE="${RAM_GUILT_SITE:-https://ram-guilt-meter.netlify.app/}"
OS="$(uname -s)"
tabs=0
found=""
pattern=""

add_pattern() { pattern="${pattern:+$pattern|}$1"; }

count_tabs() {
  # $1 = app name as AppleScript knows it
  osascript -e "tell application \"$1\"" \
    -e 'set n to 0' \
    -e 'repeat with w in windows' \
    -e 'set n to n + (count of tabs of w)' \
    -e 'end repeat' \
    -e 'return n' \
    -e 'end tell' 2>/dev/null || echo 0
}

if [ "$OS" = "Darwin" ]; then
  for app in "Google Chrome" "Safari" "Arc" "Brave Browser" "Microsoft Edge" "Vivaldi" "Chromium"; do
    if pgrep -xq "$app"; then
      n="$(count_tabs "$app")"
      case "$n" in '' | *[!0-9]*) n=0 ;; esac
      tabs=$((tabs + n))
      found="$found  $app: $n tabs\n"
      case "$app" in
        Safari) add_pattern 'Safari|com\.apple\.WebKit' ;;
        Arc) add_pattern 'Arc\.app' ;;
        *) add_pattern "$app" ;;
      esac
    fi
  done
  if pgrep -xq firefox; then add_pattern 'Firefox'; found="$found  Firefox: can't count tabs, memory included\n"; fi
  ram_gb=$(( $(sysctl -n hw.memsize) / 1073741824 ))
  opener="open"
elif [ "$OS" = "Linux" ]; then
  add_pattern 'chrome|chromium|brave|msedge|vivaldi|firefox|opera'
  # MemTotal leaves out memory reserved by the kernel, so round up to the next even GB.
  ram_gb=$(awk '/^MemTotal:/ {printf "%d", int(($2 / 1048576 + 1.99) / 2) * 2}' /proc/meminfo)
  opener="xdg-open"
else
  echo "Sorry, this script only knows macOS and Linux. Use the sliders on $SITE instead."
  exit 1
fi

# Resident memory of every browser process, in MB. Shared pages get counted more than once, which only adds to the guilt.
mem_mb=0
if [ -n "$pattern" ]; then
  mem_mb=$(ps -axo rss=,comm= 2>/dev/null | awk -v re="$pattern" 'tolower($0) ~ tolower(re) { kb += $1 } END { printf "%d", kb / 1024 }')
fi

if [ "$tabs" -eq 0 ]; then
  if (exec </dev/tty) 2>/dev/null; then
    printf "Couldn't count your tabs automatically. How many are open? " >/dev/tty
    read -r answer </dev/tty || answer=""
    case "$answer" in '' | *[!0-9]*) answer=27 ;; esac
    tabs="$answer"
  else
    tabs=27
  fi
fi
[ "$tabs" -lt 1 ] && tabs=1

echo "RAM Guilt Meter"
[ -n "$found" ] && printf "%b" "$found"
echo "  Tabs open:       $tabs"
echo "  Browser memory:  ${mem_mb} MB"
echo "  Machine RAM:     ${ram_gb} GB"

url="${SITE}?t=${tabs}&g=${ram_gb}&src=cli"
[ "$mem_mb" -gt 0 ] && url="${url}&m=${mem_mb}"
echo "Opening $url"
"$opener" "$url" >/dev/null 2>&1 || echo "Open that link in your browser to see your card."
