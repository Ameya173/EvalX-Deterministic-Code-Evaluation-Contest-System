# Architecture

```
 Browser (React, Monaco, Socket.io client)
        |  HTTPS + WebSocket
        v
 +--------------------------+        +--------------------+
 |  API (Express)           |<------>|  MongoDB           |
 |  auth, problems,         |        |  users, problems,  |
 |  submissions, contests,  |        |  tests, submissions|
 |  admin, Socket.io        |        |  reports, calib.   |
 +----+-------------+-------+        +---------^----------+
      | enqueue     ^ events (pub/sub)         | results
      v             |                          |
 +--------------------------+                  |
 |  Redis                   |                  |
 |  BullMQ queues: judge,   |                  |
 |  analysis; pub/sub;      |                  |
 |  worker heartbeats       |                  |
 +------------+-------------+                  |
              | jobs                           |
              v                                |
 +----------------------------------------------+---+
 |  Worker (Node)                                   |
 |  judgeCore: compile, calibrate (C1), run tests   |
 |  complexityCore (C2), strengthCore (C3)          |
 +--------------------+-----------------------------+
                      | Docker API (named pipe on Windows, socket on Linux)
                      v
 +----------------------------------------------+
 |  Sandbox container (one per job)              |
 |  no network, read-only root, tmpfs /work,     |
 |  cap-drop ALL, no-new-privileges, non-root    |
 |  agent.cjs <--JSON lines--> worker            |
 |  runner (C): rlimits + wait4 CPU/memory       |
 +----------------------------------------------+
```

## Flow of a submission

1. `POST /api/submissions` validates input, checks access (and contest rules), stores the submission as `queued` and adds a BullMQ job (contest submissions get higher priority).
2. A worker takes the job, starts a sandbox container, and sends line-delimited JSON commands to the in-container agent: `compile`, `canary`, `run`.
3. **C1:** the canary program runs 3 times; its median CPU time compared with the machine's fastest historical runs gives a *speed factor* (clamped to 0.5 to 1.05). Every measured CPU time is multiplied by it.
4. For each test: run once. Hard failures (wall-clock kill, signals, output flood, non-zero exit, memory) are decided immediately. Otherwise the output is compared (token, exact or float checker) and the timing policy decides:
   * time < 0.8 x limit: accept after one run;
   * time > 1.2 x limit: TLE after one run;
   * in between ("borderline"): up to 5 runs in total, bootstrap 1000 resamples of the median, verdict by P(median <= limit) >= 0.5, confidence = that probability (or its complement), plus a 95% percentile interval.
5. Judging stops at the first failing test. The result is written to MongoDB, an event is published on Redis, the API forwards it to the user's Socket.io room, and for contest submissions the scoreboard cache is invalidated.
6. On **TLE** (and if the problem has a generator and an expected complexity) an analysis job is queued: **C2**.

Retries: a failed job is retried up to 3 times with exponential backoff; the result is written by submission id, so a retry cannot double count. After the last attempt the submission gets `SE` (System Error), which is shown as a judge fault, not the user's.

## C2: complexity-explained TLE

Inputs: the problem's generator (Python; reads `n seed`, prints one valid input), expected complexity, size range, optional reference solution.

1. Sizes grow geometrically (x2) from `minN` to `maxN`, at most 9 points.
2. For each size, the generator and the submission run inside the same sandbox (`scale` command: the generator writes the input file, the runner times the submission on it). 3 repeats, median, corrected by the speed factor. A run that hits the cap stops the sweep (censored point). The reference solution is timed the same way (2 repeats).
3. Fit: for each model in {1, log n, n, n log n, n^2, n^3} fit the single constant factor in log space and compare squared error; pick the **simplest** model within 15% of the best error (conservative: the tool under-calls rather than falsely accusing).
4. Classify: fitted class worse than expected => *asymptotic*; same class but > 2.5x slower than the reference at the largest common size => *constant factor*; otherwise *unclear* (may depend on specific inputs).

## C3: test-suite strength

1. Mutate the reference solution (C++ or Python) with relational, arithmetic and logical operator swaps and +/-1 on integer constants. Operators are only mutated outside string literals and comments, and only when written with spaces (binary operators), which avoids template brackets and `<<`.
2. A mutant that compiles and fails any test is **killed**.
3. Survivors are run against random small inputs from the generator, compared with the reference. If any input differs, the mutant is a real bug the suite misses (**survived**), and that input (smallest found) with the reference's output is proposed as a new test. If none differs it is treated as **likely equivalent** and excluded from the score.
4. Score = killed / (killed + survived). Equivalent mutants cannot be fully eliminated automatically; the report says how many were excluded.

## Security model and honest limits

* API: bcrypt password hashing, short-lived access token, httpOnly refresh cookie (revocable per user via a token version), rate limits on login and submissions, Zod validation on all inputs, Helmet headers, request size caps. CSRF: the refresh endpoint is the only cookie-authenticated route and uses SameSite=Lax; everything else uses an Authorization header.
* Sandbox: see the flags above. **Containers share the kernel of the Docker VM (Docker Desktop's WSL2 VM, or the host on Linux).** A kernel exploit could escape them. For a public service, add gVisor/Kata or run the worker on a disposable VM. The worker holds the Docker socket, so it must run on a dedicated machine.
* Hidden test inputs and outputs are never sent to clients. Per-test verdicts and times are shown for every test (this reveals which test number failed, as most judges do).
* Timing on Windows (Docker Desktop in a Hyper-V VM) is noisier than on bare Linux. C1 reduces the effect on verdicts; it does not remove it. Record hardware and power settings when reporting experiment results.
* The scoreboard is computed from submissions on demand and cached for 2 seconds.

## Where this differs from the design document

* **Argon2id -> bcrypt (bcryptjs):** pure JavaScript, no native build step on Windows.
* **MinIO -> MongoDB:** test data and sources are stored in documents with size limits to keep the first version simple.
* **tree-sitter -> text-level mutation operators:** no native modules to compile on Windows; the scanner skips strings and comments.
* **Rotating refresh tokens -> revocable refresh cookie:** a new cookie is issued on each refresh and logout revokes all of a user's refresh tokens, but tokens are not single-use.
* **isolate/cgroups -> Docker flags + C runner:** required to run on Windows.

## Literature context (for the report)

Related work and gaps are summarised in the project document: Judge0 (Dosilovic and Mekterovic, MIPRO 2020); Edgar APAS (Mekterovic et al., Electronics 2023); EPFL grader (Bovel et al., SEFI 2024); timing noise study (Mares, 2011); Adaptive Code Judge (SBIE); test-suite weakness (Liu et al., ISSTA 2023); TLE study (arXiv:2510.14339); empirical complexity estimation (Czibula et al., ICSOFT 2019). Verify novelty claims against current literature before publishing.
