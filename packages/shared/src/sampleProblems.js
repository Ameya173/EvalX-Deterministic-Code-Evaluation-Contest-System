import { mulberry32 } from './stats.js';

const GEN_LIST = `import sys, random
n, seed = map(int, sys.stdin.read().split())
random.seed(seed)
print(n)
print(*[random.randint(-1000, 1000) for _ in range(n)])
`;

const GEN_BIG = `import sys, random
n, seed = map(int, sys.stdin.read().split())
random.seed(seed)
print(n)
print(*[random.randint(-10**9, 10**9) for _ in range(n)])
`;

const GEN_PAIR = `import sys, random
n, seed = map(int, sys.stdin.read().split())
random.seed(seed)
m = 10 ** min(max(n, 1), 9)
print(random.randint(-m, m), random.randint(-m, m))
`;

const REF_APLUSB = `#include <bits/stdc++.h>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}
`;

const REF_SORT = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<long long> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    sort(a.begin(), a.end());
    for (int i = 0; i < n; i++) {
        if (i > 0) cout << ' ';
        cout << a[i];
    }
    cout << "\\n";
    return 0;
}
`;

const REF_KADANE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<long long> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    long long best = a[0], cur = a[0];
    for (int i = 1; i < n; i++) {
        cur = max(a[i], cur + a[i]);
        best = max(best, cur);
    }
    cout << best << "\\n";
    return 0;
}
`;

const listInput = (arr) => `${arr.length}\n${arr.join(' ')}\n`;
const randList = (n, lo, hi, seed) => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rng() * (hi - lo + 1)));
};
const kadane = (a) => {
  let best = a[0];
  let cur = a[0];
  for (let i = 1; i < a.length; i++) {
    cur = Math.max(a[i], cur + a[i]);
    best = Math.max(best, cur);
  }
  return best;
};
const sortedOut = (a) => [...a].sort((x, y) => x - y).join(' ') + '\n';

export function sampleProblems() {
  const sortSmall = [[3, 1, 2], [5], [2, 2, 1, 1], [-5, 10, 0, -5, 7, 3], [1000000000, -1000000000, 0]];
  const sortBig = randList(200000, -1000000000, 1000000000, 11);
  const kadSmall = [[1, -2, 3, 4, -1], [5], [-3, -1, -2], [2, 2, 2, 2]];
  const kadBig = randList(100000, -1000, 1000, 5);

  return [
    {
      slug: 'a-plus-b',
      title: 'A + B',
      difficulty: 800,
      tags: ['warm-up'],
      statementMd:
        '## A + B\n\nRead two integers `a` and `b` and print their sum.\n\n**Input:** one line with two integers, `-10^9 <= a, b <= 10^9`.\n\n**Output:** one integer, `a + b`.\n\n**Example**\n\nInput:\n```\n2 3\n```\nOutput:\n```\n5\n```\n',
      timeLimitMs: 1000,
      memoryKb: 262144,
      checkerType: 'token',
      declaredComplexity: '1',
      reference: { lang: 'cpp', source: REF_APLUSB },
      generator: { lang: 'python', source: GEN_PAIR },
      scaling: { minN: 1000, maxN: 256000 },
      tests: [
        { input: '2 3\n', output: '5\n', isSample: true },
        { input: '0 0\n', output: '0\n' },
        { input: '-5 3\n', output: '-2\n' },
        { input: '1000000000 1000000000\n', output: '2000000000\n' },
      ],
    },
    {
      slug: 'sort-numbers',
      title: 'Sort Numbers',
      difficulty: 1200,
      tags: ['sorting'],
      statementMd:
        '## Sort Numbers\n\nYou are given `n` integers. Print them in non-decreasing order, separated by spaces.\n\n**Input:** the first line contains `n` (`1 <= n <= 200000`). The second line contains `n` integers, each between `-10^9` and `10^9`.\n\n**Output:** the sorted integers on one line.\n\n**Example**\n\nInput:\n```\n3\n3 1 2\n```\nOutput:\n```\n1 2 3\n```\n\n*Hint: the intended solution runs in O(n log n). A quadratic sort will exceed the time limit on large tests.*\n',
      timeLimitMs: 1000,
      memoryKb: 262144,
      checkerType: 'token',
      declaredComplexity: 'n log n',
      reference: { lang: 'cpp', source: REF_SORT },
      generator: { lang: 'python', source: GEN_BIG },
      scaling: { minN: 1000, maxN: 256000 },
      tests: [
        { input: listInput(sortSmall[0]), output: sortedOut(sortSmall[0]), isSample: true },
        ...sortSmall.slice(1).map((a) => ({ input: listInput(a), output: sortedOut(a) })),
        { input: listInput(sortBig), output: sortedOut(sortBig) },
      ],
    },
    {
      slug: 'max-subarray',
      title: 'Maximum Subarray Sum',
      difficulty: 1400,
      tags: ['dp', 'arrays'],
      statementMd:
        '## Maximum Subarray Sum\n\nGiven an array of `n` integers, find the largest sum of a non-empty contiguous subarray.\n\n**Input:** the first line contains `n` (`1 <= n <= 100000`). The second line contains `n` integers with absolute value at most 1000.\n\n**Output:** one integer, the maximum subarray sum.\n\n**Example**\n\nInput:\n```\n5\n1 -2 3 4 -1\n```\nOutput:\n```\n7\n```\n\n*Hint: the intended solution is O(n).*\n',
      timeLimitMs: 1000,
      memoryKb: 262144,
      checkerType: 'token',
      declaredComplexity: 'n',
      reference: { lang: 'cpp', source: REF_KADANE },
      generator: { lang: 'python', source: GEN_LIST },
      scaling: { minN: 1000, maxN: 256000 },
      tests: [
        { input: listInput(kadSmall[0]), output: `${kadane(kadSmall[0])}\n`, isSample: true },
        ...kadSmall.slice(1).map((a) => ({ input: listInput(a), output: `${kadane(a)}\n` })),
        { input: listInput(kadBig), output: `${kadane(kadBig)}\n` },
      ],
    },
  ];
}
