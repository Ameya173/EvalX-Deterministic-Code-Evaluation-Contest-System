// Correct but O(n^2): gets Time Limit Exceeded on the large test, then C2 explains why.
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; scanf("%d", &n);
    vector<long long> a(n);
    for (auto &x : a) scanf("%lld", &x);
    for (int i = 0; i < n; i++)
        for (int j = 0; j + 1 < n - i; j++)
            if (a[j] > a[j + 1]) swap(a[j], a[j + 1]);
    for (int i = 0; i < n; i++) printf("%lld%c", a[i], i + 1 < n ? ' ' : '\n');
}
