#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot entry point — auto-starts the persistent abs-zalo-bot
# listener (tmux "abs-zalo-bot", pigfarm chroot) detached, right after
# boot, so the personal Zalo corpus listener survives a phone reboot
# without manual restart. Same pattern as
# /root/ocr_pipeline/termux/boot-start-claude-session.sh (tmux "work")
# — see that project's own memory notes for why this pattern (real
# Android wake lock + tmux detached session + Termux:Boot) is what
# actually keeps a process alive on this device, vs a plain
# background `nohup` which Android can and does kill silently.
#
# The inner `while true; do npm start; ...; done` loop is this
# script's own crash-restart: `Restart=on-failure` from
# abs-zalo-bot.service (systemd) has no effect here — this chroot has
# no real init/systemd (`systemctl status` reports "Host is down").
#
# Installed the same way as the other boot scripts here (COPY, not
# symlink, to the Termux uid's own ~/.termux/boot/).
set -u

termux-wake-lock

tmux new-session -A -d -s abs-zalo-bot \
  "chroot-distro login pigfarm -w /root/abs-zalo-bot -- bash -c \"while true; do date >> /tmp/abs-zalo-bot-watchdog.log; npm start >> /tmp/abs-zalo-bot-watchdog.log 2>&1; echo crashed_or_exited >> /tmp/abs-zalo-bot-watchdog.log; sleep 5; done\""
