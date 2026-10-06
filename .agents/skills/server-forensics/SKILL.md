---
name: server-forensics
description: Read when a prod server misbehaves (disk full, OOM, crash loop, high load, port/network) BEFORE any fix.
---
# Server Forensics

You operate real production servers as root via monitor tooling. Diagnosis is read-only; interventions come last and are gated. A destructive "fix" without captured evidence is the cardinal sin — the platform's safety reviewer blocks reckless commands, and only the operator approves destructive steps.

## Hard rules
1. **Capture before change.** Evidence dies with the fix: journal context rotates, `/proc/PID` vanishes with the process, deleted-fd disk space frees on service stop. Run the snapshot script below before ANY intervention.
2. Every tree is ordered read-only → intervention. Anything marked **[APPROVAL]** goes into the findings block as a proposal — you do not run it unprompted.
3. Read the FIRST error, not the last. A crash loop repeats its final line forever; scroll to the first failure after the last clean start.
4. Act only on identifiers verified in the current session. Re-run `ss`/`ps` immediately before any kill; a PID from a ticket or an old shell is meaningless.
5. One hypothesis at a time: change one thing, re-measure, then move on.
6. Every investigation ends with the findings block. No findings block, no fix.

## Snapshot first (always)
`/bin/sh` is dash — run this with `bash snapshot.sh`. Read-only, safe on prod, ~10 s.

```bash
#!/usr/bin/env bash
# snapshot.sh — read-only evidence capture. Run BEFORE any intervention.
set -u
TS=$(date -u +%Y%m%dT%H%M%SZ)
DIR="${HOME:-/root}/forensics/$(hostname)-$TS"
mkdir -p "$DIR"
c() { local f="$DIR/$1"; shift; { echo "\$ $*"; "$@"; } >"$f.txt" 2>&1 || true; }

c date        date -u
c uptime      uptime
c df          df -h
c df-inodes   df -i
c free        free -h
c vmstat      vmstat 1 3
c top         sh -c 'top -bn1 | head -30'
c ps-rss      sh -c 'ps aux --sort=-rss | head -25'
c ps-dstate   sh -c 'ps -eo pid,stat,wchan:30,etime,cmd | awk "\$2 ~ /^D/"'
c dmesg       sh -c 'dmesg -T | tail -100'
c oom         sh -c 'dmesg -T | grep -iE "oom|killed process" | tail -50'
c journal-err journalctl -p err -n 200 --no-pager
c journal-du  journalctl --disk-usage
c failed      systemctl --failed --no-pager
c ss          ss -tulnp
c ss-summary  ss -s
c conntrack   sh -c 'sysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max 2>/dev/null || true'
c resolv      cat /etc/resolv.conf
c bigfiles    sh -c 'find / -xdev -type f -size +500M -printf "%s %p\n" 2>/dev/null | sort -rn | head -20'
c lsof-del    sh -c 'command -v lsof >/dev/null && lsof +L1 2>/dev/null | grep -i deleted | head -40 || echo "lsof missing: apt-get install -y lsof"'
if command -v docker >/dev/null 2>&1; then
  c docker-ps docker ps -a
  c docker-df docker system df
  for n in $(docker ps -aq | head -20); do
    c "docker-$n" docker inspect -f '{{.Name}} OOMKilled={{.State.OOMKilled}} Restarts={{.RestartCount}} Exit={{.State.ExitCode}} Started={{.State.StartedAt}}' "$n"
  done
fi
echo "Snapshot: $DIR"
```

Quote the snapshot dir path in the findings block.

## Decision trees

### 1. Disk full
```
df -h; df -i                       # -i: inode exhaustion reports as "full" with free bytes
du -xhd1 / | sort -h | tail -15    # -x stays on one fs; repeat into the biggest dir until the offender
journalctl --disk-usage
docker system df
find / -xdev -type f -size +500M -printf '%s %p\n' 2>/dev/null | sort -rn | head -20
lsof +L1 2>/dev/null | grep -i deleted | head -40   # space held by deleted-but-open files
```
Interventions, safest first:
- `journalctl --vacuum-size=500M` **[APPROVAL]** — trims journal, keeps recent.
- `docker image prune -f` / `docker builder prune -f` **[APPROVAL]**. NEVER `docker system prune -a --volumes` — deletes named volumes = data loss.
- Deleted-but-open file: restart the owning service (COMMAND/PID column of lsof) **[APPROVAL]**; `: > /proc/PID/fd/N` also frees it but is equally **[APPROVAL]**.
- Old logs/coredumps: list exact paths + sizes in findings; deletion per-file **[APPROVAL]**, never `rm -rf` a directory.

### 2. Memory / OOM
```
free -h
dmesg -T | grep -iE 'oom|killed process' | tail -30
ps aux --sort=-rss | head -15
systemd-cgtop -n1 -m | head -15    # -m: sort by memory; which unit/cgroup eats it
```
Leak vs spike: sample the suspect 3 times at 60 s intervals — `grep VmRSS /proc/PID/status`. RSS growing across all samples = leak (restart buys hours; real fix is in the app — say so). One OOM event in dmesg, RSS stable now = spike; find what ran at the dmesg timestamp (cron, batch, bad query).
Interventions: restart leaking service **[APPROVAL]**; `MemoryMax=` drop-in **[APPROVAL]**.

### 3. Service down / crash loop
```
systemctl status NAME --no-pager -l
systemctl show NAME -p NRestarts,ExecMainStatus,ExecMainStartTimestamp,Result
journalctl -u NAME -n 200 --no-pager
dmesg -T | grep -i oom | tail       # correlate kill time with unit start time; Result=oom-kill confirms
```
- ExecStart binary exists? `systemctl cat NAME | grep ExecStart` then `ls -l` that path. Exit 203/EXEC = bad path.
- Exit 137 = SIGKILL (usually OOM). Exit 139 = segfault.
- Config syntax BEFORE any restart: `nginx -t`, `sshd -t`, `apachectl configtest`, `haproxy -c -f /etc/haproxy/haproxy.cfg`, `named-checkconf`, `postfix check`.
- NEVER restart-loop blindly. One restart max, after the first error is read and config check passes — **[APPROVAL]** on prod.

### 4. Port conflict / bind failed
```
ss -tlnp | grep ':8080'
fuser -v 8080/tcp                                  # confirm PID
ls -l /proc/PID/exe /proc/PID/cwd
head -3 /proc/PID/cgroup                           # docker path => a container owns it
docker ps --format '{{.Names}} {{.Ports}}' | grep 8080
```
Establish who owns the port and WHY before anything else: previous instance still draining, docker-proxy, or a legitimately deployed second service. Killing the holder is **[APPROVAL]**.

### 5. High load
```
uptime; nproc                       # load means nothing without core count
top -bn1 | head -20
vmstat 1 5                          # r=runq, b=blocked, wa=iowait, st=steal
iostat -x 1 3                       # apt-get install -y sysstat if missing; watch %util, await
ps -eo pid,stat,wchan:30,etime,cmd | awk '$2 ~ /^D/'   # D-state = uninterruptible I/O
```
Read: high %us/%sy → CPU-bound, top names the process. High %wa or D-states → disk/NFS; check `iostat` await and `dmesg -T | grep -iE 'i/o error|nfs'`. High %st → hypervisor neighbor, nothing local to fix — report it. Load high but CPU idle → count D-states, it is I/O wait.

### 6. Network
```
curl -sv --max-time 5 https://target/ -o /dev/null   # WHERE does it stall: DNS, connect, TLS, first byte?
ss -s                                                # thousands of timewait/orphans?
sysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max 2>/dev/null
dmesg -T | grep -i conntrack | tail                  # "table full, dropping packet"
resolvectl status 2>/dev/null || cat /etc/resolv.conf
dig +time=2 +tries=1 example.com; dig +time=2 example.com @1.1.1.1   # local resolver vs upstream
```

### 7. Docker containers
```
docker ps -a --format 'table {{.Names}}\t{{.State}}\t{{.Status}}'   # Exited (137)=OOM/SIGKILL, (139)=segfault, (1)=app
docker logs --tail 200 --timestamps NAME 2>&1 | head -120           # first error, not last
docker inspect -f 'OOMKilled={{.State.OOMKilled}} Restarts={{.RestartCount}} Exit={{.State.ExitCode}} Started={{.State.StartedAt}}' NAME
docker events --since 1h --until now --filter container=NAME
docker exec NAME date -u; date -u                                   # clock drift check
```

## Findings block (mandatory)
End every investigation with exactly this shape, pasted to the operator (Turkish is fine for operator-facing text):

```
SYMPTOM: tüm vhost'larda 502, 14:02 UTC'den beri
EVIDENCE:
  $ systemctl show php8.2-fpm -p NRestarts,Result -> NRestarts=47 Result=oom-kill
  $ dmesg -T | grep -i oom -> [Tue Aug 19 14:01:58] Out of memory: Killed process 31337 (php-fpm8.2)
  $ free -h -> Mem: 3.8Gi total, 3.6Gi used, Swap: 0B
ROOT CAUSE: php-fpm RSS ~40MB/dk büyüyor (leak, 3 örnek), swap yok, OOM killer döngüde
PROPOSED FIX: php8.2-fpm restart (risk: ~2 sn 502) + pm.max_requests=500 (risk: düşük) [OPERATOR APPROVAL]
Snapshot: /root/forensics/web1-20260820T141530Z
```
EVIDENCE lines are pasted output, never paraphrase. Every destructive item carries a risk note; the operator decides.

## Self-check
- [ ] Snapshot script ran; its directory path is in the findings block?
- [ ] Every command executed so far read-only (no restart/kill/rm/prune/vacuum/truncate)?
- [ ] EVIDENCE quotes real output lines with the commands that produced them?
- [ ] Distinctions checked where relevant: inodes vs bytes, leak vs spike, CPU vs iowait vs steal, first vs last error?
- [ ] All destructive steps live only in PROPOSED FIX, each with a risk note, none executed?
- [ ] PIDs/ports re-verified in this session, within the last few minutes?

## Anti-patterns (all real incidents)
- `rm -rf /var/log/...` as the first move on disk-full: the logs were the evidence, and the daemon held the fd open — zero bytes freed.
- Restarting the service before `journalctl -u`: context gone; the crash loop returned 20 minutes later with no trail.
- `docker system prune -a --volumes` to free space: wiped named DB volumes. Prune images/builder cache only, with approval.
- "Fixed by reboot" with nothing captured: same OOM next Tuesday, investigation starts from zero.
- Killing a PID quoted in a days-old ticket: the PID had been reused by postgres. Verify with `ss -tlnp`/`ps` at execution time.
- Calling it "not disk" at `df -h` 60% while `df -i` showed 100% inodes (millions of stale session files).
- Reading the last log line of a crash loop (that IS the loop) instead of the first failure after the last clean start.
