/*
 * runner: run one program with resource limits and report what it used.
 *
 * usage: runner CPU_MS WALL_MS AS_KB FSIZE_KB STDIN_FILE STDOUT_FILE STDERR_FILE -- cmd [args...]
 *
 * Prints one JSON line:
 *   {"cpu_ms":..,"wall_ms":..,"mem_kb":..,"exit":..,"signal":..,"wall_killed":0|1}
 *
 * CPU time and peak memory come from wait4() rusage (user + system CPU time,
 * peak resident set), not from wall-clock time.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000.0 + ts.tv_nsec / 1e6;
}

static void set_limit(int res, rlim_t soft, rlim_t hard) {
    struct rlimit rl;
    rl.rlim_cur = soft;
    rl.rlim_max = hard;
    setrlimit(res, &rl);
}

int main(int argc, char **argv) {
    if (argc < 9) {
        fprintf(stderr, "usage: runner CPU_MS WALL_MS AS_KB FSIZE_KB IN OUT ERR -- cmd...\n");
        return 2;
    }
    long cpu_ms = atol(argv[1]);
    long wall_ms = atol(argv[2]);
    long as_kb = atol(argv[3]);
    long fsize_kb = atol(argv[4]);
    const char *fin = argv[5], *fout = argv[6], *ferr = argv[7];
    int idx = 8;
    if (idx < argc && strcmp(argv[idx], "--") == 0) idx++;
    if (idx >= argc) {
        fprintf(stderr, "runner: missing command\n");
        return 2;
    }

    double t0 = now_ms();
    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return 3;
    }
    if (pid == 0) {
        setpgid(0, 0);
        int fd = open(fin, O_RDONLY);
        if (fd < 0) _exit(126);
        dup2(fd, 0);
        close(fd);
        fd = open(fout, O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (fd < 0) _exit(126);
        dup2(fd, 1);
        close(fd);
        fd = open(ferr, O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (fd < 0) _exit(126);
        dup2(fd, 2);
        close(fd);

        long cpu_s = (cpu_ms + 999) / 1000 + 1; /* hard backstop, wall limit is the main guard */
        set_limit(RLIMIT_CPU, (rlim_t)cpu_s, (rlim_t)cpu_s + 1);
        if (as_kb > 0) set_limit(RLIMIT_AS, (rlim_t)as_kb * 1024, (rlim_t)as_kb * 1024);
        if (fsize_kb > 0) set_limit(RLIMIT_FSIZE, (rlim_t)fsize_kb * 1024, (rlim_t)fsize_kb * 1024);
        set_limit(RLIMIT_CORE, 0, 0);
        set_limit(RLIMIT_STACK, RLIM_INFINITY, RLIM_INFINITY);
        execvp(argv[idx], &argv[idx]);
        _exit(127);
    }
    setpgid(pid, pid);

    int status = 0;
    struct rusage ru;
    memset(&ru, 0, sizeof ru);
    int wall_killed = 0;
    for (;;) {
        pid_t r = wait4(pid, &status, WNOHANG, &ru);
        if (r == pid) break;
        if (r < 0) {
            if (errno == EINTR) continue;
            break;
        }
        if (now_ms() - t0 > (double)wall_ms) {
            kill(-pid, SIGKILL);
            kill(pid, SIGKILL);
            wall_killed = 1;
            wait4(pid, &status, 0, &ru);
            break;
        }
        usleep(500);
    }
    double wall = now_ms() - t0;
    double cpu = ru.ru_utime.tv_sec * 1000.0 + ru.ru_utime.tv_usec / 1000.0 +
                 ru.ru_stime.tv_sec * 1000.0 + ru.ru_stime.tv_usec / 1000.0;
    int code = WIFEXITED(status) ? WEXITSTATUS(status) : 0;
    int sig = WIFSIGNALED(status) ? WTERMSIG(status) : 0;
    printf("{\"cpu_ms\":%.3f,\"wall_ms\":%.3f,\"mem_kb\":%ld,\"exit\":%d,\"signal\":%d,\"wall_killed\":%d}\n",
           cpu, wall, (long)ru.ru_maxrss, code, sig, wall_killed);
    return 0;
}
