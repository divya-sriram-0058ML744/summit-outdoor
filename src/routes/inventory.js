// src/routes/inventory.js
const express = require('express');
const router = express.Router();
const { inventory } = require('../../data/store');

/**
 * GET /products/:sku/inventory
 * x-policies: OAuth, Retry, CircuitBreaker
 */
router.get('/:sku/inventory', (req, res) => {
  const { sku }         = req.params;
  const { warehouseId } = req.query;

  // ── Normalize SKU ───────────────────────────────────────────────────────
  // Strip any SKU prefix so all these resolve to '1001':
  //   /products/1001/inventory      → '1001'
  //   /products/SKU1001/inventory   → '1001'
  //   /products/SKU-1001/inventory  → '1001'
  const normalizedSku = sku.toUpperCase().replace(/^SKU-?/, '');

  // ── Lookup ──────────────────────────────────────────────────────────────
  const record = inventory[normalizedSku];
  if (!record) {
    return res.status(404).json({
      code:    'NOT_FOUND',
      message: `SKU '${sku}' does not exist`,
    });
  }

  // ── Optional warehouse filter ───────────────────────────────────────────
  if (warehouseId) {
    const wh = record.warehouses.find(
      w => w.warehouseId.toLowerCase() === warehouseId.toLowerCase()
    );
    if (!wh) {
      return res.status(404).json({
        code:    'NOT_FOUND',
        message: `Warehouse '${warehouseId}' not found for SKU '${sku}'`,
      });
    }
    return res.status(200).json({
      ...record,
      totalStock:     wh.stock,
      availableStock: wh.stock,
      reservedStock:  0,
      warehouses:     [wh],
    });
  }

  return res.status(200).json(record);
});

module.exports = router;
