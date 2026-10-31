// Classic bug: starts the best at 0, so all-negative arrays give 0 instead of the largest element. Wrong Answer.
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; scanf("%d", &n);
    vector<long long> a(n);
    for (auto &x : a) scanf("%lld", &x);
    long long best = 0, cur = 0;
    for (int i = 0; i < n; i++) {
        cur = max(0LL, cur + a[i]);
        best = max(best, cur);
    }
    printf("%lld\n", best);
}
