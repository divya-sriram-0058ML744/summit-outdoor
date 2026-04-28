/**
 * /store/reviews
 *
 * Multi-operation endpoint for reading, submitting, and moderating
 * customer gear reviews.
 *
 * Auth: none enforced at the server level for now — OAuth (reviews:read,
 *       reviews:write, reviews:admin scopes) will be added later.
 *
 * NOTE: Uses an in-memory store seeded from data/reviews.json at startup.
 *       Writes (POST / DELETE) mutate the in-memory array only — no disk
 *       writes — so data resets on every cold start / redeploy. This is
 *       intentional for Vercel's read-only /var/task filesystem.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ─── in-memory store ──────────────────────────────────────────────────────────

const REVIEWS_FILE  = path.join(__dirname, '../../data/reviews.json');
const PRODUCTS_FILE = path.join(__dirname, '../../data/products.json');

// Seed once at module load time. fs.readFileSync is fine here — /var/task is
// readable, only writes are blocked on Vercel.
let reviews = [];
try {
  reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
} catch {
  reviews = [];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ─── simulated inventory lookup ───────────────────────────────────────────────
// Mirrors the flaky warehouse behaviour from /products/{sku}/inventory.
// 20 % of the time we pretend the warehouse service timed out so the demo
// shows the structured 503 + Retry-After response described in the spec.

function fetchInventoryForSku(sku) {
  return new Promise((resolve, reject) => {
    const SIMULATE_TIMEOUT_RATE = 0.2;
    setTimeout(() => {
      if (Math.random() < SIMULATE_TIMEOUT_RATE) {
        const err = new Error('Warehouse service timed out');
        err.code = 'WAREHOUSE_TIMEOUT';
        return reject(err);
      }
      const products = loadProducts();
      const product = products.find((p) => p.sku === sku);
      resolve(product ? { sku, inStock: true } : null);
    }, 30);
  });
}

// ─── route ────────────────────────────────────────────────────────────────────

router.route('/reviews')

  // ── GET – search / fetch reviews ──────────────────────────────────────────
  .get(async (req, res) => {
    const { sku, userId, status = 'approved', page = 1, limit = 20 } = req.query;

    let filtered = reviews.filter((r) => r.status === status);

    if (sku)    filtered = filtered.filter((r) => r.sku === sku);
    if (userId) filtered = filtered.filter((r) => r.userId === userId);

    // try/throw – inventory lookup when a SKU filter is present.
    // If the SKU resolves in the catalog but the warehouse service times out,
    // throw a structured 503 + Retry-After rather than letting the raw
    // timeout bubble up to the client.
    if (sku) {
      try {
        const inventory = await fetchInventoryForSku(sku);
        if (!inventory) {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: `SKU '${sku}' does not exist`,
          });
        }
        const pageNum  = parseInt(page,  10);
        const pageSize = parseInt(limit, 10);
        const start    = (pageNum - 1) * pageSize;
        return res.status(200).json({
          total: filtered.length,
          page:  pageNum,
          limit: pageSize,
          sku,
          inventory,
          reviews: filtered.slice(start, start + pageSize),
        });
      } catch (err) {
        if (err.code === 'WAREHOUSE_TIMEOUT') {
          res.set('Retry-After', '30');
          return res.status(503).json({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Warehouse service is temporarily unavailable. Please retry.',
          });
        }
        throw err;
      }
    }

    const pageNum  = parseInt(page,  10);
    const pageSize = parseInt(limit, 10);
    const start    = (pageNum - 1) * pageSize;

    return res.status(200).json({
      total: filtered.length,
      page:  pageNum,
      limit: pageSize,
      reviews: filtered.slice(start, start + pageSize),
    });
  })

  // ── POST – submit a new review ────────────────────────────────────────────
  .post((req, res) => {
    const { sku, userId, rating, body } = req.body ?? {};

    const validationErrors = [];

    if (rating === undefined || rating === null) {
      validationErrors.push("'rating' is required");
    } else if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
      validationErrors.push("'rating' must be an integer between 1 and 5");
    }

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      validationErrors.push("'body' is required and must be a non-empty string");
    }

    if (!sku || typeof sku !== 'string') {
      validationErrors.push("'sku' is required");
    } else {
      const products = loadProducts();
      const skuExists =
        products.length === 0 ||
        products.some((p) => p.sku === sku);
      if (!skuExists) {
        validationErrors.push(`SKU '${sku}' does not exist in the product catalog`);
      }
    }

    if (!userId || typeof userId !== 'string') {
      validationErrors.push("'userId' is required");
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Review validation failed',
        details: validationErrors,
      });
    }

    const newReview = {
      reviewId:  `REV-${String(reviews.length + 1).padStart(4, '0')}`,
      sku,
      userId,
      rating:    Number(rating),
      body:      body.trim(),
      status:    'approved',
      createdAt: new Date().toISOString(),
    };

    // ── in-memory write (replaces fs.writeFileSync) ──────────────────────────
    reviews.push(newReview);

    return res.status(201).json(newReview);
  })

  // ── DELETE – moderation removal ───────────────────────────────────────────
  .delete((req, res) => {
    const { reviewId } = req.query;

    if (!reviewId) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: "Query parameter 'reviewId' is required",
      });
    }

    const idx = reviews.findIndex((r) => r.reviewId === reviewId);

    if (idx === -1) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Review '${reviewId}' does not exist`,
      });
    }

    // ── in-memory write (replaces fs.writeFileSync) ──────────────────────────
    reviews[idx] = { ...reviews[idx], status: 'removed' };

    return res.status(200).json({
      reviewId,
      status:  'removed',
      message: 'Review has been removed by a moderator',
    });
  });

module.exports = router;
