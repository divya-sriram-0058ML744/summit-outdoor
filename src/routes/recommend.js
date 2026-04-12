// src/routes/recommend.js
const express = require('express');
const router  = express.Router();
const { products, similarItems, userProfiles } = require('../../data/store');

/**
 * GET /products/recommend
 * x-policies: OAuth, RateLimit, Cache
 */
router.get('/', (req, res) => {
  const { userId, sku, category, limit = '10', strategy = 'hybrid' } = req.query;

  // ── Validation ─────────────────────────────────────────────────────────
  if (!userId || userId.trim() === '') {
    return res.status(400).json({
      code:    'BAD_REQUEST',
      message: "Query parameter 'userId' is required",
      details: ["'userId' must be a non-empty string"],
    });
  }

  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    return res.status(400).json({
      code:    'BAD_REQUEST',
      message: "'limit' must be between 1 and 50",
    });
  }

  const validStrategies = ['collaborative', 'content', 'hybrid'];
  if (!validStrategies.includes(strategy)) {
    return res.status(400).json({
      code:    'BAD_REQUEST',
      message: `'strategy' must be one of: ${validStrategies.join(', ')}`,
    });
  }

  // ── Build candidate pool ───────────────────────────────────────────────
  let candidates = []; // [{ sku, score, reason }]

  // Strategy: content / hybrid — item-to-item similarity from reference SKU
  if ((strategy === 'content' || strategy === 'hybrid') && sku) {
    const similar = similarItems[sku.toUpperCase()] || [];
    candidates.push(...similar);
  }

  // Strategy: collaborative / hybrid — based on user profile preferences
  if (strategy === 'collaborative' || strategy === 'hybrid') {
    const profile = userProfiles[userId];
    const preferredCategories = profile
      ? profile.preferredCategories
      : ['footwear']; // fallback default

    const collab = products
      .filter(p => {
        // exclude items already in candidates or recently viewed
        const alreadyIn    = candidates.some(c => c.sku === p.sku);
        const recentlyViewed = profile?.recentSkus?.includes(p.sku);
        const inCategory   = preferredCategories.includes(p.category);
        return inCategory && !alreadyIn && !recentlyViewed;
      })
      .map(p => ({
        sku:    p.sku,
        score:  parseFloat((0.5 + Math.random() * 0.45).toFixed(2)), // simulated score
        reason: `Popular in ${p.category}`,
      }));

    candidates.push(...collab);
  }

  // ── Category filter (applied post-candidate-generation) ────────────────
  let filteredCandidates = candidates;
  if (category) {
    const prodMap = Object.fromEntries(products.map(p => [p.sku, p]));
    filteredCandidates = candidates.filter(c => {
      const prod = prodMap[c.sku];
      return prod && prod.category.toLowerCase() === category.toLowerCase();
    });
  }

  // ── Sort by score desc, deduplicate, apply limit ───────────────────────
  const seen    = new Set();
  const deduped = filteredCandidates
    .filter(c => {
      if (seen.has(c.sku)) return false;
      seen.add(c.sku);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limitNum);

  // ── Enrich with product details ────────────────────────────────────────
  const prodMap = Object.fromEntries(products.map(p => [p.sku, p]));
  const recommendations = deduped
    .map(c => {
      const prod = prodMap[c.sku];
      if (!prod) return null;
      return { ...prod, score: c.score, reason: c.reason };
    })
    .filter(Boolean);

  // ── No results — user not found but request is valid ───────────────────
  if (recommendations.length === 0 && !userProfiles[userId]) {
    return res.status(404).json({
      code:    'NOT_FOUND',
      message: `No profile found for user '${userId}'. Cannot generate recommendations.`,
    });
  }

  return res.status(200).json({
    userId,
    strategy,
    total:           recommendations.length,
    recommendations,
  });
});

module.exports = router;
