// O(n^2) maximum subarray: TLE on the 100000-element test.
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; scanf("%d", &n);
    vector<long long> a(n);
    for (auto &x : a) scanf("%lld", &x);
    long long best = LLONG_MIN;
    for (int i = 0; i < n; i++) {
        long long s = 0;
        for (int j = i; j < n; j++) { s += a[j]; best = max(best, s); }
    }
    printf("%lld\n", best);
}
