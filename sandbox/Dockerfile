# Sandbox image: toolchains + the C runner + the in-container agent.
# Built once with:  npm run sandbox:build
FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc g++ python3 openjdk-17-jdk-headless \
 && rm -rf /var/lib/apt/lists/*

COPY runner.c canary.c /opt/src/
RUN gcc -O2 -o /usr/local/bin/runner /opt/src/runner.c \
 && gcc -O1 -o /opt/canary /opt/src/canary.c \
 && chmod 755 /usr/local/bin/runner /opt/canary

COPY agent.cjs /opt/agent/agent.cjs

# Submissions never run as root.
USER 65534:65534
WORKDIR /work
ENV HOME=/tmp
CMD ["node", "/opt/agent/agent.cjs"]
