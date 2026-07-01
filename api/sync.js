import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const CODE_RE = /^[A-Z0-9_-]{2,24}$/;
const MAX_BYTES = 1.5 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const code = String(req.query.code || '').toUpperCase();
    if (!CODE_RE.test(code)) return res.status(400).json({ error: 'invalid code' });

    const entries = await redis.hgetall(`sync:${code}`);
    if (!entries || Object.keys(entries).length === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    return res.status(200).json({ entries });
  }

  if (req.method === 'POST') {
    const { code, entries, claimId, deleteBucket, removeField } = req.body || {};
    const upperCode = String(code || '').toUpperCase();
    if (!CODE_RE.test(upperCode)) return res.status(400).json({ error: 'invalid code' });

    // Delete a whole profile bucket (its progress/history/identity).
    if (deleteBucket) {
      await redis.del(`sync:${upperCode}`);
      return res.status(200).json({ ok: true });
    }

    // Remove a single field from a bucket (used to drop a name from the directory).
    if (removeField) {
      await redis.hdel(`sync:${upperCode}`, String(removeField));
      return res.status(200).json({ ok: true });
    }

    // Atomic "claim this name" — only succeeds if nobody owns it yet, so two
    // devices registering the same profile name at once can never silently
    // steal ownership from each other. Loser gets told the winning id back.
    if (claimId) {
      const key = `sync:${upperCode}`;
      const claimed = await redis.hsetnx(key, '__profile_id__', claimId);
      if (claimed && entries) await redis.hset(key, entries);
      const ownerId = claimed ? claimId : await redis.hget(key, '__profile_id__');
      return res.status(200).json({ claimed, ownerId });
    }

    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      return res.status(400).json({ error: 'missing entries' });
    }
    if (Buffer.byteLength(JSON.stringify(entries), 'utf8') > MAX_BYTES) {
      return res.status(413).json({ error: 'payload too large' });
    }
    if (Object.keys(entries).length === 0) return res.status(200).json({ ok: true });

    await redis.hset(`sync:${upperCode}`, entries);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
