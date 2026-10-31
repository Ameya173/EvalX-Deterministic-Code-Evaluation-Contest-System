export const LANGUAGES = {
  cpp: { label: 'C++17', timeMultiplier: 1, ext: 'cpp', template: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    return 0;\n}\n' },
  python: { label: 'Python 3', timeMultiplier: 3, ext: 'py', template: 'import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    \n\nmain()\n' },
  java: { label: 'Java 17', timeMultiplier: 2, ext: 'java', template: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        \n    }\n}\n' },
  javascript: { label: 'JavaScript (Node 20)', timeMultiplier: 2, ext: 'js', template: "const data = require('fs').readFileSync(0, 'utf8').split(/\\s+/).filter(Boolean);\n\n" },
};

export const QUEUES = { judge: 'judge', analysis: 'analysis' };

export const VERDICT_LABELS = {
  AC: 'Accepted',
  WA: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
  MLE: 'Memory Limit Exceeded',
  RE: 'Runtime Error',
  OLE: 'Output Limit Exceeded',
  CE: 'Compilation Error',
  SE: 'System Error',
};

export const ROLES = ['user', 'setter', 'admin'];
