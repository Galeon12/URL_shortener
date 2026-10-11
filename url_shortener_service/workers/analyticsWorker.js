/**
 * Analytics Worker (Phase 3)
 *
 * In-process async queue for click analytics. The redirect path records a
 * click event and returns immediately. A setImmediate-based drain loop
 * processes events without blocking the event loop.
 *
 * In a multi-instance deployment the queue would be replaced with Redis
 * Streams or a proper message broker. For a single/small-scale deployment
 * this gives zero-overhead async analytics without extra infrastructure.
 *
 * Tracked fields (non-sensitive):
 *   - timestamp
 *   - urlCode
 *   - userAgent
 *   - referrer
 *   - deviceType (desktop / mobile / bot / unknown)
 */
import Url from '../models/Url.js';

const queue = [];
let draining = false;

/** Classify device from User-Agent string */
function classifyDevice(ua) {
  if (!ua) return 'unknown';
  const lower = ua.toLowerCase();
  if (/bot|crawl|spider|slurp|mediapartners/i.test(ua)) return 'bot';
  if (/mobile|android|iphone|ipod|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Enqueue an analytics event to be processed asynchronously.
 * Safe to call fire-and-forget from a route handler.
 */
export function enqueueClickEvent(req, urlCode) {
  const event = {
    urlCode,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || null,
    referrer: req.headers['referer'] || req.headers['referrer'] || null,
    deviceType: classifyDevice(req.headers['user-agent']),
  };
  queue.push(event);
  scheduleDrain();
}

function scheduleDrain() {
  if (draining) return;
  draining = true;
  setImmediate(drainQueue);
}

async function drainQueue() {
  while (queue.length > 0) {
    const batch = queue.splice(0, 50); // process up to 50 events per tick
    for (const event of batch) {
      try {
        await Url.updateOne(
          { urlCode: event.urlCode },
          {
            $inc: { clicks: 1 },
            $push: {
              // Store last 100 click events per URL to keep data bounded
              clickLog: {
                $each: [
                  {
                    timestamp: event.timestamp,
                    deviceType: event.deviceType,
                    referrer: event.referrer,
                  },
                ],
                $slice: -100,
              },
            },
          }
        );
      } catch (err) {
        // Non-fatal — analytics failure must never impact redirects
        console.warn('[Analytics] Failed to record click:', err.message);
      }
    }
  }
  draining = false;
}
