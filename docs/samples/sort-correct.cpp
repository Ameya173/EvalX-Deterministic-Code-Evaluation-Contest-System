#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; scanf("%d", &n);
    vector<long long> a(n);
    for (auto &x : a) scanf("%lld", &x);
    sort(a.begin(), a.end());
    for (int i = 0; i < n; i++) printf("%lld%c", a[i], i + 1 < n ? ' ' : '\n');
}
