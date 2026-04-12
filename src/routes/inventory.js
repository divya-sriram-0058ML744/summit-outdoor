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

  // ── Lookup ─────────────────────────────────────────────────────────────
  const record = inventory[sku.toUpperCase()];
  if (!record) {
    return res.status(404).json({
      code:    'NOT_FOUND',
      message: `SKU '${sku}' does not exist`,
    });
  }

  // ── Optional warehouse filter ──────────────────────────────────────────
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
    // Return inventory scoped to the requested warehouse only
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
