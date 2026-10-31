# Experiments

Record the hardware (CPU model, cores, RAM), Docker Desktop resource settings, power plan, and how many runs you did. Report variance, and report results that do not favour your method too.

## E1: burst load (platform)

1. Start everything (`npm run dev`, or the compose stack) and make sure the worker count/concurrency is what you want to measure.
2. `npm run loadtest -- --users 6 --submissions 60 --problem sort-numbers --file docs/samples/sort-correct.cpp`
3. It prints p50/p95/max latency from submit to final verdict, throughput per minute and the verdict distribution. Repeat with `WORKER_CONCURRENCY` 1, 2, 4 (or more workers) for the scaling curve.

## E7: C1 verdict stability

Question: when a solution's time is right at the limit, how stable are the verdicts under each timing policy?

```powershell
npm run experiment:c1 -- --file docs/samples/sort-correct.cpp --lang cpp --problem sort-numbers --test 6 --trials 100
npm run experiment:c1 -- --file docs/samples/sort-correct.cpp --lang cpp --problem sort-numbers --test 6 --trials 100 --load 2
```

The script measures the solution's median CPU time, sets the limit to exactly that, then judges the same test `trials` times under three policies: `single` (one run), `fixed3` (median of three) and `adaptive` (C1). It reports the AC/TLE split, **flip rate** (fraction of consecutive judgements with a different verdict), average runs per judgement and the share of borderline cases. `--load N` starts N busy processes on the host to simulate noisy neighbours. Results are saved in `benchmarks/results/`.

What to expect and to discuss: adaptive should have a lower flip rate than single, at a cost of a few extra runs only in borderline cases. Be honest if the difference is small on a quiet machine; the effect should grow with `--load`.

## E8: C2 classification accuracy

1. Create a labelled corpus: for 10 to 20 problems, write solutions of known complexity (for example O(n), O(n log n), O(n^2)) and some correct-class-but-slow variants. Samples to start from are in `docs/samples/`.
2. Make each problem's generator, expected complexity and size range correct in *Manage*.
3. Submit each solution (it must TLE to trigger the analysis; lower the time limit or use large sizes if needed) and record `classification` and the fitted model from the card or `GET /api/submissions/:id/analysis`.
4. Build a confusion matrix (true class vs fitted class). Repeat a few solutions under load to measure robustness.

## E9: C3 strength before and after hardening

1. In *Manage > problem > Test-suite strength*, click **Analyse**. Note score, caught/missed/equivalent counts.
2. Select surviving mutants, **Add selected survivors as tests**, analyse again. Note the new score and the number of tests added.
3. Write wrong solutions that the original suite accepts (for example by changing a boundary condition), judge them before and after hardening, and report how many are newly rejected.
4. Report the equivalent-mutant count and discuss it as a limitation.

## E10: a real contest

Create a contest in *Admin*, have classmates join, and keep the Admin page open (queue depth, worker speed factor). Record participants, submissions, verdict distribution, p95 verdict latency and any incidents.
