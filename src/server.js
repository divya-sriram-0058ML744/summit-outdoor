// src/server.js
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const searchRouter    = require('./routes/search');
const inventoryRouter = require('./routes/inventory');
const recommendRouter = require('./routes/recommend');
const reviewsRouter = require('./routes/reviews');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ── Serve OpenAPI spec ────────────────────────────────────────────────────
app.get('/openapi.yaml', (_req, res) => {
  const specPath = path.join(__dirname, '..', 'openapi.yaml');
  res.setHeader('Content-Type', 'text/yaml');
  res.send(fs.readFileSync(specPath, 'utf8'));
});

// ── Routes ────────────────────────────────────────────────────────────────

// NOTE: /products/recommend and /products/search must be registered BEFORE
// /products/:sku/inventory so Express doesn't treat 'search' or 'recommend'
// as a :sku path parameter.
app.use('/products/search',    searchRouter);
app.use('/products/recommend', recommendRouter);
app.use('/products',           inventoryRouter);  // handles /:sku/inventory
app.use('/store',              reviewsRouter);

// ── 404 fallback ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    code:    'NOT_FOUND',
    message: 'The requested endpoint does not exist',
  });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // Enhanced logging: message, stack trace, and error object
  console.error('[ERROR DETAILS]');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('Full error:', err);
  console.error('[END ERROR]');

  res.status(500).json({
    code:    'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────
// app.listen(PORT, () => {
//   console.log(`\n Products API running on http://localhost:${PORT}`);
//   console.log(`\n Endpoints:`);
//   console.log(`   GET  http://localhost:${PORT}/products/search?q=hiking`);
//   console.log(`   GET  http://localhost:${PORT}/products/SKU-1001/inventory`);
//   console.log(`   GET  http://localhost:${PORT}/products/recommend?userId=USR-9921`);
//   console.log(`   GET  http://localhost:${PORT}/openapi.yaml`);
//   console.log(``);
// });

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Products API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
