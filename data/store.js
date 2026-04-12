// data/store.js — mock data for all three endpoints

const products = [
  { sku: 'SKU-1001', name: 'Summit Trek Boot',     category: 'footwear',   price: 149.99, currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-1001.jpg' },
  { sku: 'SKU-1002', name: 'Trail Runner X2',      category: 'footwear',   price: 119.99, currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-1002.jpg' },
  { sku: 'SKU-2045', name: 'Alpine Hiking Sock',   category: 'footwear',   price: 18.99,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-2045.jpg' },
  { sku: 'SKU-3310', name: 'Trail Gaiters Pro',    category: 'footwear',   price: 45.00,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-3310.jpg' },
  { sku: 'SKU-4201', name: 'Waterproof Backpack',  category: 'bags',       price: 89.99,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-4201.jpg' },
  { sku: 'SKU-4202', name: 'Hydration Vest 10L',   category: 'bags',       price: 74.99,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-4202.jpg' },
  { sku: 'SKU-5500', name: 'Merino Base Layer',    category: 'clothing',   price: 65.00,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-5500.jpg' },
  { sku: 'SKU-5501', name: 'Softshell Jacket',     category: 'clothing',   price: 210.00, currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-5501.jpg' },
  { sku: 'SKU-6001', name: 'Trekking Poles Set',   category: 'equipment',  price: 55.00,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-6001.jpg' },
  { sku: 'SKU-6002', name: 'Headlamp 350 Lumen',   category: 'equipment',  price: 39.99,  currency: 'USD', thumbnailUrl: 'https://cdn.example.com/products/sku-6002.jpg' },
];

const inventory = {
  'SKU-1001': {
    sku: 'SKU-1001',
    productName: 'Summit Trek Boot',
    totalStock: 320,
    availableStock: 285,
    reservedStock: 35,
    warehouses: [
      { warehouseId: 'WH-EAST-01', location: 'Newark, NJ',  stock: 180 },
      { warehouseId: 'WH-WEST-01', location: 'Reno, NV',    stock: 105 },
    ],
    lastUpdated: '2026-04-06T08:30:00Z',
  },
  'SKU-1002': {
    sku: 'SKU-1002',
    productName: 'Trail Runner X2',
    totalStock: 140,
    availableStock: 120,
    reservedStock: 20,
    warehouses: [
      { warehouseId: 'WH-EAST-01', location: 'Newark, NJ',  stock: 80  },
      { warehouseId: 'WH-CENTRAL', location: 'Chicago, IL', stock: 60  },
    ],
    lastUpdated: '2026-04-06T09:00:00Z',
  },
  'SKU-2045': {
    sku: 'SKU-2045',
    productName: 'Alpine Hiking Sock',
    totalStock: 950,
    availableStock: 910,
    reservedStock: 40,
    warehouses: [
      { warehouseId: 'WH-EAST-01', location: 'Newark, NJ',  stock: 500 },
      { warehouseId: 'WH-WEST-01', location: 'Reno, NV',    stock: 450 },
    ],
    lastUpdated: '2026-04-06T07:15:00Z',
  },
};

// item-to-item similarity map: sku → recommended skus with reasons
const similarItems = {
  'SKU-1001': [
    { sku: 'SKU-2045', score: 0.97, reason: 'Frequently bought with Summit Trek Boot' },
    { sku: 'SKU-3310', score: 0.91, reason: 'Popular in your category' },
    { sku: 'SKU-1002', score: 0.85, reason: 'Similar style and use case' },
    { sku: 'SKU-6001', score: 0.78, reason: 'Commonly paired with hiking boots' },
  ],
  'SKU-4201': [
    { sku: 'SKU-4202', score: 0.95, reason: 'Frequently bought together' },
    { sku: 'SKU-6002', score: 0.88, reason: 'Essential for the same activity' },
    { sku: 'SKU-5500', score: 0.80, reason: 'Customers who bought this also viewed' },
  ],
};

// user behaviour map: userId → preferred categories + recently viewed skus
const userProfiles = {
  'USR-9921': { preferredCategories: ['footwear', 'equipment'], recentSkus: ['SKU-1001', 'SKU-6002'] },
  'USR-1234': { preferredCategories: ['clothing', 'bags'],      recentSkus: ['SKU-5500', 'SKU-4201'] },
};

module.exports = { products, inventory, similarItems, userProfiles };
