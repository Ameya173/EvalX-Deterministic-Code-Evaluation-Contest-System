import IORedis from 'ioredis';

export const EVENTS_CHANNEL = 'jb:events';

export function createRedis(url, extra = {}) {
  return new IORedis(url, { maxRetriesPerRequest: null, ...extra });
}

export async function publishEvent(redis, evt) {
  await redis.publish(EVENTS_CHANNEL, JSON.stringify(evt));
}

export function subscribeEvents(url, handler) {
  const sub = createRedis(url);
  sub.subscribe(EVENTS_CHANNEL);
  sub.on('message', (_ch, msg) => {
    try {
      handler(JSON.parse(msg));
    } catch {
      /* ignore malformed */
    }
  });
  return sub;
}
