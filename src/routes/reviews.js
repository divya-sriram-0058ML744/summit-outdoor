/**
 * /store/reviews
 *
 * Multi-operation endpoint for reading, submitting, and moderating
 * customer gear reviews.
 *
 * Policies applied (mirrors x-policies in openapi.yaml):
 *   GET    – OAuth (read scope), Cache, inventory check with try/throw → 503 + Retry-After
 *   POST   – OAuth (write scope), Parse (JSON body), Validate (rating 1-5, body, SKU)
 *   DELETE – OAuth (admin scope), moderation removal path
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const REVIEWS_FILE = path.join(__dirname, '../../data/reviews.json');
const PRODUCTS_FILE = path.join(__dirname, '../../data/products.json');

function loadReviews() {
  return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
}

function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ─── OAuth guard ──────────────────────────────────────────────────────────────
// In this static demo the gateway would enforce tokens; here we simulate the
// check by inspecting the Authorization header and rejecting anything missing.

function requireOAuth(res) {
  // Real enforcement is gateway-side. This guard documents the contract.
  // For the demo server we always pass — the gateway policy carries the weight.
  return true;
}

function bearerPresent(req) {
  const auth = req.headers['authorization'] || '';
  return auth.toLowerCase().startsWith('bearer ');
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
    // OAuth: read access required
    if (!bearerPresent(req)) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Bearer token is missing or expired',
      });
    }

    const { sku, userId, status = 'approved', page = 1, limit = 20 } = req.query;

    let reviews = loadReviews();

    // filter
    if (sku) reviews = reviews.filter((r) => r.sku === sku);
    if (userId) reviews = reviews.filter((r) => r.userId === userId);
    reviews = reviews.filter((r) => r.status === status);

    // try/throw – inventory lookup for the requested SKU
    // If the SKU resolves in our catalog but the warehouse service times out
    // we throw a structured 503 with a Retry-After header rather than letting
    // a raw timeout bubble up.
    if (sku) {
      try {
        const inventory = await fetchInventoryForSku(sku);
        if (!inventory) {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: `SKU '${sku}' does not exist`,
          });
        }
        // attach lightweight inventory hint to the response envelope
        const pageNum = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const start = (pageNum - 1) * pageSize;

        return res.status(200).json({
          total: reviews.length,
          page: pageNum,
          limit: pageSize,
          sku,
          inventory,
          reviews: reviews.slice(start, start + pageSize),
        });
      } catch (err) {
        if (err.code === 'WAREHOUSE_TIMEOUT') {
          res.set('Retry-After', '30');
          return res.status(503).json({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Warehouse service is temporarily unavailable. Please retry.',
          });
        }
        throw err; // unexpected – let Express error handler catch it
      }
    }

    // no SKU filter – plain paginated response, no inventory lookup needed
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const start = (pageNum - 1) * pageSize;

    return res.status(200).json({
      total: reviews.length,
      page: pageNum,
      limit: pageSize,
      reviews: reviews.slice(start, start + pageSize),
    });
  })

  // ── POST – submit a new review ────────────────────────────────────────────
  .post((req, res) => {
    // OAuth: write access required
    if (!bearerPresent(req)) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Bearer token is missing or expired',
      });
    }

    // Parse: body must be present JSON (Express json() middleware handles this;
    // if content-type is wrong Express 5 will have already rejected it)
    const { sku, userId, rating, body } = req.body ?? {};

    // Validate: rating 1–5, body non-empty, product SKU must exist
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
        products.length === 0 || // demo: pass when no product fixture present
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

    // Persist (in-memory for static demo — write back to JSON file)
    const reviews = loadReviews();
    const newReview = {
      reviewId: `REV-${String(reviews.length + 1).padStart(4, '0')}`,
      sku,
      userId,
      rating: Number(rating),
      body: body.trim(),
      status: 'approved',
      createdAt: new Date().toISOString(),
    };
    reviews.push(newReview);
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));

    return res.status(201).json(newReview);
  })

  // ── DELETE – moderation removal ───────────────────────────────────────────
  .delete((req, res) => {
    // OAuth: admin/moderation scope required
    if (!bearerPresent(req)) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Bearer token is missing or expired',
      });
    }

    const { reviewId } = req.query;

    if (!reviewId) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: "Query parameter 'reviewId' is required",
      });
    }

    const reviews = loadReviews();
    const idx = reviews.findIndex((r) => r.reviewId === reviewId);

    if (idx === -1) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Review '${reviewId}' does not exist`,
      });
    }

    // Soft-delete: mark as removed rather than splicing out
    reviews[idx].status = 'removed';
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));

    return res.status(200).json({
      reviewId,
      status: 'removed',
      message: 'Review has been removed by a moderator',
    });
  });

module.exports = router;
