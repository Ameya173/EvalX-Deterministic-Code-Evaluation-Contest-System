# Correct O(n log n) but slow constant factor in Python (needs the 3x Python time multiplier to pass).
import sys
data = sys.stdin.read().split()
n = int(data[0])
a = sorted(map(int, data[1:1 + n]))
print(*a)
