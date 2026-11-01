# Eval x


npm run dev:deps
npm run dev


An online judge and contest platform (MERN-style stack) with a hardened Docker sandbox and three research contributions:

| | Feature | What it does |
|---|---|---|
| **C1** | Noise-aware verdicts | Every judging run measures the machine's current speed with a canary program and corrects CPU times. Tests whose time is close to the limit are re-run, and the verdict uses a bootstrap 95% confidence interval. The UI shows the interval and a confidence value instead of a coin-flip TLE. |
| **C2** | Complexity-explained TLE | When a submission gets TLE, the worker runs it on inputs of growing size (from the problem's generator), fits growth models and tells the user *why*: "scales like O(n^2), expected O(n log n)" or "right complexity, but N times slower than the reference". |
| **C3** | Test-suite strength scoring | Setters can mutation-test their own suite: the reference solution is mutated, the tests must catch each mutant, and bugs the suite misses are proposed as new tests (with the distinguishing input and expected output). |

Plus the platform around them: accounts and roles, problems with Markdown statements, a Monaco editor, C++/Python/Java/JavaScript, live verdicts over WebSockets, contests with an ICPC scoreboard and freeze, an admin page with queue and worker health, and an experiment harness.

Everything runs on **Windows 10/11** with Docker Desktop. You do not need a Linux machine.

---

## 1. What you need

| Requirement | Notes |
|---|---|
| Windows 10 (22H2) or Windows 11 | Virtualization must be enabled in the BIOS (usually is). |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Use the **WSL2 backend** (the default). It provides the Linux kernel for the sandbox containers. |
| [Node.js 20 or newer](https://nodejs.org/) | LTS version is fine. Check with `node -v`. |
| 8 GB RAM, 15 GB free disk | The sandbox image is about 1.2 GB. |

In Docker Desktop: Settings > Resources, give it at least 2 CPUs and 4 GB memory (6 CPUs / 8 GB is better for the experiments).

## 2. Quick start (about 15 minutes, mostly waiting for downloads)

Open **PowerShell** in the project folder (the folder that contains this README).

```powershell
# 1. Install JavaScript dependencies for all apps
npm install

# 2. Create .env with fresh random secrets
npm run setup

# 3. Start MongoDB and Redis in Docker
npm run dev:deps

# 4. Build the sandbox image (first time only, takes a few minutes)
npm run sandbox:build

# 5. Create the admin user, 3 sample problems and a demo contest
npm run seed

# 6. Check that everything is in place
npm run doctor

# 7. Start the API, the worker and the web app together
npm run dev
```

Open **http://localhost:5173**. Log in with **admin / Admin@12345** (from `.env`; change it for anything public).

The three processes print into the same window with colored prefixes: `api`, `worker`, `web`. Stop everything with `Ctrl+C`; stop MongoDB/Redis with `npm run dev:deps:down`.

### Try the three contributions in five minutes

1. **Normal judging.** Open *Sort Numbers*, choose C++, paste `docs/samples/sort-correct.cpp`, submit. You get Accepted, and the table shows CPU time per test.
2. **C2 (complexity-explained TLE).** Submit `docs/samples/sort-bubble-tle.cpp`. It gets **Time Limit Exceeded** on test 6. A "Why did it time out?" card appears, runs for a minute or so, and then shows a log-log chart plus the message that your solution scales like O(n^2) while O(n log n) is expected.
3. **C1 (noise-aware verdicts).** In the result table, tests close to the limit show a *borderline* badge with a confidence percentage and a 95% interval; hover to see every run. To see it on purpose, run the experiment: `npm run experiment:c1` (see `docs/EXPERIMENTS.md`). The Admin page shows each worker's current speed factor and a canary chart.
4. **C3 (test strength).** Go to *Manage > Maximum Subarray Sum > edit*, scroll to *Test-suite strength*, click **Analyse test strength**. After a few minutes you get a score, the mutants that were caught, and the survivors with the input that exposes each one. Select survivors and click **Add selected survivors as tests**, then analyse again to see the score rise.
5. **Contests.** Open *Contests > Welcome Contest*, join, submit from the problem links, and watch the scoreboard update live (open it in a second browser window).

More wrong/slow samples are in `docs/samples/`.

## 3. Everyday commands

| Command | Purpose |
|---|---|
| `npm run dev` | API + worker + web app with auto-reload |
| `npm run dev:deps` / `dev:deps:down` | Start / stop MongoDB and Redis |
| `npm run sandbox:build` | (Re)build the sandbox image after changing `sandbox/` |
| `npm run seed` | Create admin, sample problems, demo contest (safe to repeat) |
| `npm run doctor` | Diagnose missing pieces |
| `npm test` | Unit tests (shared logic). On Linux/macOS also the full judging pipeline test |
| `npm run build` | Production build of the web app |
| `npm run experiment:c1` | C1 stability experiment (needs Docker and the sandbox image) |
| `npm run loadtest` | Burst-load latency experiment against a running API |

## 4. Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `MONGO_URL`, `REDIS_URL` | local Docker ports | Database and queue |
| `PORT`, `CLIENT_ORIGIN` | 4000, http://localhost:5173 | API port and the allowed web origin |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | generated by `npm run setup` | Token signing secrets. The API refuses default secrets in production |
| `COOKIE_SECURE` | false | Set `true` behind HTTPS |
| `ADMIN_HANDLE/EMAIL/PASSWORD` | admin / admin@judgebox.local / Admin@12345 | Used by `npm run seed` |
| `SANDBOX_IMAGE` | judgebox-sandbox | Name of the sandbox image |
| `WORKER_CONCURRENCY` | 2 | Parallel submissions per worker (each gets 1 CPU) |
| `TIMING_POLICY` | adaptive | `adaptive` (C1), `single` or `fixed3` (baselines for experiments) |
| `STRENGTH_MAX_MUTANTS`, `STRENGTH_STRESS_INPUTS` | 30, 40 | Size of a C3 analysis |

## 5. Project layout

```
apps/api         Express API, auth, problems, submissions, contests, admin, Socket.io gateway
apps/worker      BullMQ worker: Docker sandbox wrapper, judge core, C1 timing, C2 and C3 analysis
apps/web         React + Vite frontend (Monaco editor, live results, charts)
packages/shared  Mongoose models and the pure logic that is unit-tested
                 (timing policy, bootstrap, complexity fitting, mutation operators, scoreboard)
sandbox          Sandbox image: Dockerfile, C runner (rlimits + CPU accounting), canary, in-container agent
scripts          seed, setup, doctor, experiment-c1, load-test
docs             DEPLOY.md, ARCHITECTURE.md, EXPERIMENTS.md, sample solutions
```

## 6. How the judge keeps submissions contained

Every submission runs in its own Docker container started with: no network, read-only root filesystem, tmpfs working directory, all Linux capabilities dropped, `no-new-privileges`, non-root user, memory limit with swap disabled, one CPU, and a process-count limit. Inside it, a small C program (`sandbox/runner.c`) applies CPU, address-space and output-size limits and reports CPU time and peak memory from the kernel. See `docs/ARCHITECTURE.md` for the honest limits of this design (containers share the Docker VM's kernel, so isolation is weaker than a dedicated sandbox such as isolate or gVisor on Linux).

**Do not run the worker on a machine that holds data you cannot afford to lose**, and do not expose the Docker socket to anything else.

## 7. What is and is not included

Included and working: accounts/roles (JWT access token + httpOnly refresh cookie with server-side revocation, bcrypt), problem CRUD with tests/reference/generator, submissions with queue, retries and live updates, 4 languages, token/exact/float checkers, contests with ICPC scoring, freeze and live scoreboard, rejudge, admin dashboard, C1, C2, C3, Docker Compose deployment, tests.

Not included (planned in the design document but intentionally left out of this first version): interactive problems and special-judge checkers, subtask scoring, virtual contests, Glicko-2 ratings, code-similarity detection, proctoring/edit-timeline (C4), Prometheus/Grafana dashboards, MinIO object storage (tests and sources are stored in MongoDB with size limits), warm sandbox pools (each submission starts a fresh container, adding roughly half a second to a second).

C2 currently classifies *asymptotic mismatch*, *constant-factor slowdown* and *unclear*. Detecting I/O-bound and input-sensitive cases is future work.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run doctor` says Docker is not reachable | Start Docker Desktop and wait for "Engine running". |
| Worker prints "Sandbox image ... not found" | Run `npm run sandbox:build`. |
| Submissions stay "In queue" | The worker is not running or cannot reach Redis/Docker. Check the `worker` lines in the terminal and the Admin page. |
| Verdict "System Error" with a message | Read the message in the submission page. Common: Docker Desktop out of memory (raise it in Settings > Resources), or Docker not running. |
| `npm install` fails on Windows with a build error | All dependencies are pure JavaScript, so this is usually a proxy or old Node version. Check `node -v` is 20+. |
| Everything is slow or timings are noisy | Plug in the laptop, use the High performance power plan, close other apps, add an antivirus exclusion for the project and Docker folders. C1 compensates for noise but cannot remove it. |
| Port already in use | Change `PORT` in `.env`, or stop what is using 4000, 5173, 27017 or 6379. |
| Editor does not load | Monaco loads from a CDN, so the browser needs internet access. |
| Windows line-ending problems | The repo ships `.gitattributes` forcing LF. If you edit test files in Notepad, save them with LF endings. |

## 9. Deploying

See `docs/DEPLOY.md`. Short version: you need a server where you can run Docker with access to its socket (a small VPS, or a Windows/Linux PC). Static hosts and most PaaS platforms (Vercel, Netlify, Render, Railway) cannot run the sandbox containers.
