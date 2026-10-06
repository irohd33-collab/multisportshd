---
name: systemd-timer-authoring
description: Read before installing any scheduled job (watcher, report, cleanup) on a server — timer+service pairs, not cron.
---
# systemd Timer Authoring

Every recurring job you install on a server is a **pair**: `job-name.service` (what runs) + `job-name.timer` (when). Timers beat cron because output lands in journald, `list-timers` shows the next fire, `Persistent=true` survives reboots, and a timer never double-starts a still-running job. On prod hosts this is the only accepted form.

## Hard rules

1. **Verify the schedule BEFORE installing.** Run `systemd-analyze calendar "<expr>" --iterations 3` and read the next 3 fire times. If they are wrong on paper they will be wrong at 03:00.
2. **`ExecStart` takes absolute paths only.** systemd rejects relative paths outright, and `PATH` inside units is minimal (`/usr/bin:/bin`). Same for the interpreter: `/opt/report/venv/bin/python`, not `python3`.
3. **Secrets go in `EnvironmentFile=/etc/job-name.env` with mode 0600 root:root.** Never in `ExecStart=`, never in a crontab line (both are world-readable via `systemctl show` / `/etc/crontab`).
4. **`Type=oneshot`** for script jobs. `Type=simple` makes systemd consider the job "done" the instant it forks — success/failure state and `start` blocking semantics break.
5. **`Persistent=true` on every timer.** Without it, a run missed because the box was rebooting at fire time is silently skipped.
6. **`RandomizedDelaySec=300` on anything installed fleet-wide.** 50 hosts firing at exactly `03:00:00` is a thundering herd on the DB/API they all hit.
7. **`systemctl daemon-reload` after every edit** to a unit file. systemd runs the in-memory copy; without reload your edit is invisible.
8. **Enable the `.timer`, never the `.service`.** `systemctl enable --now job.timer`. Enabling the service makes it run at boot, once, which is not a schedule.
9. **`systemctl start job.service` BLOCKS** until a oneshot finishes. For a job longer than ~1 min, test with `systemctl start --no-block job.service` and watch `journalctl -fu job.service`.
10. **Print progress lines from the script.** stdout/stderr go to journald automatically; a silent job is undebuggable at 03:00. Set `SyslogIdentifier=` for clean `journalctl -t` filtering.

## OnCalendar cookbook

| Want | OnCalendar= |
|---|---|
| daily 03:00 | `*-*-* 03:00:00` |
| every 3 hours | `*-*-* 00/3:00:00` |
| every 15 minutes | `*-*-* *:00/15:00` |
| weekdays 08:30 | `Mon..Fri 08:30` |
| weekly, Sunday 05:00 | `Sun *-*-* 05:00:00` |
| monthly, 1st, 04:00 | `*-*-01 04:00:00` |
| hourly at :07 | `*-*-* *:07:00` |

Always verify first:

```sh
systemd-analyze calendar "Mon..Fri 08:30" --iterations 3
# Next elapse: Thu 2026-08-20 08:30:00 UTC  (then Fri, then Mon — gap over the weekend = correct)
```

## Worked example: nightly report job

Run as root on the target host (bash, not dash):

```bash
#!/usr/bin/env bash
set -euo pipefail

# 0) Verify the schedule on paper
systemd-analyze calendar "*-*-* 03:00:00" --iterations 3

# 1) Service user (no shell, no login)
id -u report >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d /opt/report report

# 2) Secrets file: create with 0600 BEFORE writing content
install -m 0600 -o root -g root /dev/null /etc/nightly-report.env
cat > /etc/nightly-report.env <<'EOF'
REPORT_DB_URL=postgres://report:{{secret:report_db_password}}@10.0.0.5:5432/app
TELEGRAM_BOT_TOKEN={{secret:telegram_bot_token}}
EOF

# 3) The pair
cat > /etc/systemd/system/nightly-report.service <<'EOF'
[Unit]
Description=Gecelik kullanim raporu (nightly usage report)
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=report
WorkingDirectory=/opt/report
EnvironmentFile=/etc/nightly-report.env
ExecStart=/opt/report/venv/bin/python /opt/report/report.py --out /opt/report/out
SyslogIdentifier=nightly-report
TimeoutStartSec=30min
Nice=10
IOSchedulingClass=idle
ProtectSystem=full
EOF

cat > /etc/systemd/system/nightly-report.timer <<'EOF'
[Unit]
Description=Nightly report at 03:00 (+0-5 min jitter)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF

# 4) Load + arm + confirm NEXT
systemctl daemon-reload
systemctl enable --now nightly-report.timer
systemctl list-timers nightly-report.timer --no-pager
# NEXT must show tomorrow 03:00:00-03:05:00. If '-', the timer is not armed.

# 5) Manual test run NOW (oneshot: this blocks until the script exits)
systemctl start nightly-report.service
journalctl -u nightly-report.service -n 50 --no-pager
```

Notes on the unit choices:

- `TimeoutStartSec=30min` — a hung report is killed instead of running until someone notices. Size it at ~3x the normal runtime.
- `Nice=10` + `IOSchedulingClass=idle` — the report loses every CPU/disk fight against the prod workload. Use on any heavy batch job on a serving host.
- `ProtectSystem=full` — `/usr`, `/boot`, `/etc` mounted read-only for the job. Only for jobs that don't write there (a report job never should). Drop it if the job legitimately edits config.
- If the timer fires while the previous run is still going, systemd **skips** the trigger — no overlap, no queue. Long job + short interval means runs are silently dropped; check `journalctl -u nightly-report.service` for gaps.
- Output lives under the **.service**, not the .timer: `journalctl -u nightly-report.service` or `journalctl -t nightly-report`.

## Removal (leave no orphans)

```bash
systemctl disable --now nightly-report.timer
systemctl stop nightly-report.service 2>/dev/null || true
rm -f /etc/systemd/system/nightly-report.service \
      /etc/systemd/system/nightly-report.timer \
      /etc/nightly-report.env
systemctl daemon-reload
systemctl list-timers nightly-report.timer --no-pager   # must show 0 timers
```

## When cron is still fine

User-level quick hacks on disposable/dev boxes (`crontab -e`, no secrets, you'll delete the box anyway). Everything on a prod host = timers. If you catch yourself writing `/etc/cron.d/...` on prod, stop and write the pair.

## Self-check (before calling it done)

- [ ] `systemd-analyze calendar` output shows the next 3 fires and they match the intent (weekend gap for `Mon..Fri`, etc.).
- [ ] `ExecStart` is absolute, the file exists, and is executable/readable by `User=`.
- [ ] Env file is `0600 root root` (`stat -c '%a %U' /etc/job-name.env` → `600 root`); no secret appears in `systemctl cat job-name.service`.
- [ ] `daemon-reload` ran after the last file edit.
- [ ] `systemctl list-timers job-name.timer` shows a real NEXT timestamp, not `-`.
- [ ] One manual `systemctl start job-name.service` succeeded and `journalctl -u job-name.service -n 50` shows the expected progress lines and exit.
- [ ] Timer has both `Persistent=true` and `RandomizedDelaySec=`.
- [ ] `systemctl is-enabled job-name.timer` → `enabled`; `systemctl is-enabled job-name.service` → `static`/`disabled` (you did NOT enable the service).

## Anti-patterns (seen in the wild)

- **Secrets inline in crontab or `ExecStart=`** — visible to every local user via `/etc/crontab` or `systemctl show`. Env file 0600 or nothing.
- **`ExecStart=./run.sh` or `ExecStart=python report.py`** — relative path is rejected; bare `python` resolves against systemd's minimal PATH, not your venv.
- **Missing `Persistent=true`** — host reboots at 02:58, the 03:00 run never happens, nobody is told.
- **No `RandomizedDelaySec` on a fleet-wide timer** — every host hits the central DB at 03:00:00.000; the DB pages you, not the timers.
- **Editing the unit file and re-running `systemctl start`, wondering why the old command still runs** — no `daemon-reload`.
- **`systemctl enable job.service`** instead of the timer — job runs once at boot, schedule never engages.
- **`journalctl -u job.timer` to read job output** — the timer's log only says "Triggered"; the output is under `-u job.service`.
- **Blocking `systemctl start` on a 40-minute job from a session with a command timeout** — the shell kills your session, the job keeps running server-side and you lose the exit status. Use `--no-block` + `journalctl -fu`.
- **`Type=simple` for a batch script** — unit reports "active" then "dead" instantly; failures don't mark the unit failed and `OnFailure=` hooks never fire.
