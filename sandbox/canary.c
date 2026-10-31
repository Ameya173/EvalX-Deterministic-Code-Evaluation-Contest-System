/* Fixed CPU-bound workload used to measure the current speed of the machine (C1). */
#include <stdio.h>

int main(void) {
    volatile unsigned long long x = 88172645463325252ULL;
    unsigned long long s = 0;
    for (long i = 0; i < 60000000L; i++) {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        s += x;
    }
    printf("%llu\n", s);
    return 0;
}
