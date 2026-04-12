// src/routes/search.js
const express = require('express');
const router = express.Router();
const { products } = require('../../data/store');

/**
 * GET /products/search
 * x-policies: OAuth, Cache, LoadBalance
 */
router.get('/', (req, res) => {
  const { q, category, page = '1', limit = '20' } = req.query;

  // ── Validation ─────────────────────────────────────────────────────────
  if (!q || q.trim() === '') {
    return res.status(400).json({
      code: 'BAD_REQUEST',
      message: "Query parameter 'q' is required",
      details: ["'q' must be a non-empty string"],
    });
  }

  const pageNum  = parseInt(page,  10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum)  || pageNum  < 1)         return res.status(400).json({ code: 'BAD_REQUEST', message: "'page' must be a positive integer" });
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) return res.status(400).json({ code: 'BAD_REQUEST', message: "'limit' must be between 1 and 100" });

  // ── Filter ─────────────────────────────────────────────────────────────
  const keyword = q.toLowerCase();
  let results = products.filter(p =>
    p.name.toLowerCase().includes(keyword) ||
    p.category.toLowerCase().includes(keyword) ||
    p.sku.toLowerCase().includes(keyword)
  );

  if (category) {
    results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  // ── Paginate ───────────────────────────────────────────────────────────
  const total      = results.length;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated  = results.slice(startIndex, startIndex + limitNum);

  return res.status(200).json({
    total,
    page:     pageNum,
    limit:    limitNum,
    products: paginated,
  });
});

module.exports = router;
