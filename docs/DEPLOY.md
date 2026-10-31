# Deploying JudgeBox

## What you need to know first

JudgeBox starts one Docker container per submission, so the worker needs access to a Docker engine. That rules out static hosts and most platform-as-a-service products (Vercel, Netlify, Render, Railway, Heroku) for the worker. Use:

* a small **VPS** (Ubuntu 22.04/24.04, 2 vCPU and 4 GB RAM minimum; more CPUs let you run more submissions in parallel), or
* a **Windows or Linux PC** you control, with Docker installed.

Nothing on the server needs to be installed except Docker (with the Compose plugin) and Git or a way to copy the project there. You do **not** need Node.js on the server; everything is built inside Docker.

> The worker container mounts `/var/run/docker.sock`. Whoever controls the worker controls the Docker engine on that machine. Use a machine dedicated to JudgeBox with nothing else valuable on it.

## Option A: a Linux VPS with automatic HTTPS (recommended)

1. **Create a server** and point a domain at it (an `A` record, for example `judge.example.com`).
2. **Install Docker** (https://docs.docker.com/engine/install/ubuntu/) and verify `docker compose version`.
3. **Copy the project** to the server (`git clone`, or `scp`/`rsync` the unzipped folder).
4. **Create `.env`:**
   ```bash
   cp .env.example .env
   # generate two secrets and paste them into JWT_SECRET and JWT_REFRESH_SECRET
   openssl rand -hex 48
   openssl rand -hex 48
   ```
   Set these values in `.env`:
   ```
   COOKIE_SECURE=true
   ADMIN_PASSWORD=<a long unique password>
   PUBLIC_URL=https://judge.example.com
   DOMAIN=judge.example.com
   WEB_PORT=8080
   ```
5. **Start everything** (builds all images, including the sandbox image):
   ```bash
   docker compose --profile https up -d --build
   ```
   Caddy obtains and renews a TLS certificate automatically (ports 80 and 443 must be reachable).
6. **Create the admin user and the sample problems (once):**
   ```bash
   docker compose run --rm api node scripts/seed.js
   ```
   This reads `ADMIN_HANDLE`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`, creates the admin, the three sample problems and a demo contest. Safe to repeat.
7. **Open** `https://judge.example.com`, log in, and check the Admin page: you should see one worker online.

Without a domain (testing on an IP address): leave out `--profile https`, keep `WEB_PORT=80`, set `PUBLIC_URL=http://<server-ip>`, and keep `COOKIE_SECURE=false`.

## Option B: your own Windows PC with Docker Desktop

```powershell
npm run setup                  # creates .env
docker compose up -d --build   # builds and starts everything
```
Open http://localhost. To reach it from other machines on your network, allow port 80 in Windows Firewall and use your PC's IP address (set `PUBLIC_URL` to match). To expose it to the internet without opening ports, use a tunnel such as Cloudflare Tunnel pointing at `http://localhost:80`, and set `PUBLIC_URL` and `COOKIE_SECURE=true` for the HTTPS address you get.

## Operating it

| Task | Command |
|---|---|
| See logs | `docker compose logs -f worker` (or `api`, `web`) |
| Update after changing code | `git pull` then `docker compose up -d --build` |
| Stop / start | `docker compose stop` / `docker compose start` |
| Back up the database | `docker compose exec -T mongo mongodump --archive --gzip > backup.gz` |
| Restore | `docker compose exec -T mongo mongorestore --archive --gzip --drop < backup.gz` |
| Scale judging | Raise `WORKER_CONCURRENCY` in `.env` (each submission uses 1 CPU), or run more workers: `docker compose up -d --scale worker=3` |
| Clean up stale sandbox containers | They are removed automatically at worker start; manually: `docker ps -a --filter label=judgebox=sandbox -q \| xargs -r docker rm -f` |

## Production checklist

- [ ] Strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET`; the API refuses to start in production with the defaults.
- [ ] `COOKIE_SECURE=true` and HTTPS in front (Caddy profile above, or your own reverse proxy).
- [ ] Changed the admin password; promote other admins or setters from the Admin page.
- [ ] MongoDB and Redis are **not** published on any port (the compose file keeps them internal). Keep it that way.
- [ ] Firewall: allow only 80/443 (and SSH from your IP).
- [ ] Regular `mongodump` backups.
- [ ] A dedicated machine for the worker, kept updated (`apt upgrade`, Docker updates).
- [ ] Optional: put the worker on a separate server from the API and database. The worker only needs `MONGO_URL`, `REDIS_URL` (exposed through a private network or VPN, with passwords) and its local Docker.
- [ ] Understand the isolation limits in `docs/ARCHITECTURE.md` before letting strangers submit code. For a public site, add a stronger sandbox runtime (for example gVisor's `runsc`, set as the Docker default runtime) on a Linux host.

## Known limits of this deployment

* One MongoDB and one Redis instance, no replication. Fine for a college contest or portfolio deployment; add managed databases for anything larger.
* Test data and submitted sources live in MongoDB documents (limits are enforced by the API).
* Rate limiting is per API instance (in memory). Run one API instance, or move the limiter to Redis before scaling horizontally.
