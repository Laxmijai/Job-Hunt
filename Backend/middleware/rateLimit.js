const buckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60 * 1000).unref?.();

export const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 10, keyPrefix = "api" } = {}) => (req, res, next) => {
  const key = `${keyPrefix}:${req.ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
  if (bucket.count > max) return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  next();
};
