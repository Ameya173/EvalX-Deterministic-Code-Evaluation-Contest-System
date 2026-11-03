# EvalX Operating Guide & Runbook

This guide contains the exact steps and commands to run EvalX both **locally** for development and to keep your **live deployed Vercel site active**.

---

## 1. Daily Local Development (Laptop Only)

When you just want to develop, test UI, or work on problems locally on `http://localhost:5173`:

1. **Make sure Docker Desktop is open and running.**
2. In your terminal in the project root:
   ```powershell
   npm run dev
   ```
   *(This starts the API, the Judge Worker, and the React Web app concurrently in a single window).*
3. Open **`http://localhost:5173`** in your browser.
4. Stop everything anytime with `Ctrl + C`.

---

## 2. Keeping the Deployed Vercel Site Live (For Demos & Evaluation)

Since your frontend is hosted globally on **Vercel** (`https://eval-x-deterministic-code-evaluatio.vercel.app`) while your database and queue are in the cloud (MongoDB Atlas & Upstash Redis), your laptop acts as the **Compute Engine** for the API and the Docker sandbox.

Whenever you want the Vercel site to be **`Online`** and able to execute user submissions:

### Step 1: Ensure Docker Desktop is Running
Open Docker Desktop on Windows and wait until it says **"Engine running"**.

### Step 2: Start the Backend API (Terminal 1)
```powershell
npm run dev:api
```
*Expected output:* `[api] listening on http://localhost:4000`

### Step 3: Start the Judge Worker (Terminal 2)
```powershell
npm run dev:worker
```
*Expected output:* `[worker] ready, waiting for jobs`

### Step 4: Start the Cloudflare Tunnel (Terminal 3)
```powershell
npx cloudflared tunnel --url http://localhost:4000
```
*Expected output:* A box showing:
```text
https://<random-name>.trycloudflare.com
```

### Step 5: (Only if the Tunnel URL changed) Update Vercel
Because free Cloudflare tunnels generate a new URL each time they start:
1. Copy the `https://<random-name>.trycloudflare.com` URL from Terminal 3.
2. Go to **[Vercel Dashboard](https://vercel.com)** $\rightarrow$ **`eval-x-deterministic-code-evaluatio`** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
3. Edit **`VITE_API_URL`** with the new tunnel URL and save.
4. Go to **Deployments** $\rightarrow$ click the **`...`** on the latest deployment $\rightarrow$ click **Redeploy**.

Now your site at `https://eval-x-deterministic-code-evaluatio.vercel.app` is **Online**, and anyone across the globe can register, solve problems, and get live Docker-judged verdicts!

---

## 3. Database & Seeding Quick Reference

* **Seed 500 Curated Problems (Blind 75, NeetCode 150, Striver SDE, Company Tags):**
  ```powershell
  node scripts/seed-500-dsa.js
  ```
* **Seed default starter problems & demo contest:**
  ```powershell
  npm run seed
  ```
* **Rebuild Sandbox Image (if modifying `sandbox/Dockerfile`):**
  ```powershell
  npm run sandbox:build
  ```

---

## 4. Default Admin Login Credentials

* **URL:** `https://eval-x-deterministic-code-evaluatio.vercel.app/login`
* **Handle / Email:** `admin` or `admin@judgebox.local`
* **Password:** `Admin@12345`

