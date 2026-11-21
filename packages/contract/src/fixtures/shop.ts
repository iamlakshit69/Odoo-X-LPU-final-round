import type {
  PublicProduct,
  ProductWithVariants,
  StockLevel,
  StockMovement,
  Order,
} from '../shop.js';

export const fixturePublicProducts: PublicProduct[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Pro Wilson Tennis Racket',
    category: 'racket',
    description: 'Graphite competition tennis racket, 300g.',
    imageUrl: 'https://images.unsplash.com/photo-1617083934555-563d30925c34',
    basePricePaise: 1299900, // ₹12,999.00
    taxCategory: 'sports_goods_12',
    inStock: true,
    variants: [
      {
        id: '11000000-0000-0000-0000-000000000001',
        sku: 'RACK-WIL-PRO-G3',
        optionLabel: 'Grip 3 (4 3/8")',
        pricePaise: 1299900,
        inStock: true,
      },
      {
        id: '11000000-0000-0000-0000-000000000002',
        sku: 'RACK-WIL-PRO-G4',
        optionLabel: 'Grip 4 (4 1/2")',
        pricePaise: 1299900,
        inStock: false,
      },
    ],
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    name: 'Dunlop Fort All Court Tennis Balls (Can of 4)',
    category: 'ball',
    description: 'ITF approved premium tournament tennis balls.',
    imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    basePricePaise: 65000, // ₹650.00
    taxCategory: 'sports_goods_12',
    inStock: true,
    variants: [
      {
        id: '11000000-0000-0000-0000-000000000003',
        sku: 'BALL-DUN-FORT-4',
        optionLabel: 'Standard 4-Ball Can',
        pricePaise: 65000,
        inStock: true,
      },
    ],
  },
];

export const fixtureProducts: ProductWithVariants[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Pro Wilson Tennis Racket',
    category: 'racket',
    description: 'Graphite competition tennis racket, 300g.',
    imageUrl: 'https://images.unsplash.com/photo-1617083934555-563d30925c34',
    basePricePaise: 1299900,
    taxCategory: 'sports_goods_12',
    active: true,
    variants: [
      {
        id: '11000000-0000-0000-0000-000000000001',
        productId: '10000000-0000-0000-0000-000000000001',
        sku: 'RACK-WIL-PRO-G3',
        optionLabel: 'Grip 3 (4 3/8")',
        pricePaise: 1299900,
        lowStockThreshold: 3,
        active: true,
      },
      {
        id: '11000000-0000-0000-0000-000000000002',
        productId: '10000000-0000-0000-0000-000000000001',
        sku: 'RACK-WIL-PRO-G4',
        optionLabel: 'Grip 4 (4 1/2")',
        pricePaise: 1299900,
        lowStockThreshold: 3,
        active: true,
      },
    ],
  },
];

export const fixtureStockLevels: StockLevel[] = [
  {
    variantId: '11000000-0000-0000-0000-000000000001',
    sku: 'RACK-WIL-PRO-G3',
    optionLabel: 'Grip 3 (4 3/8")',
    productId: '10000000-0000-0000-0000-000000000001',
    productName: 'Pro Wilson Tennis Racket',
    category: 'racket',
    onHand: 10,
    reserved: 2,
    saleable: 8,
    lowStockThreshold: 3,
    isLow: false,
  },
  {
    variantId: '11000000-0000-0000-0000-000000000002',
    sku: 'RACK-WIL-PRO-G4',
    optionLabel: 'Grip 4 (4 1/2")',
    productId: '10000000-0000-0000-0000-000000000001',
    productName: 'Pro Wilson Tennis Racket',
    category: 'racket',
    onHand: 2,
    reserved: 0,
    saleable: 2,
    lowStockThreshold: 3,
    isLow: true,
  },
];

export const fixtureStockMovement: StockMovement = {
  id: '12000000-0000-0000-0000-000000000001',
  variantId: '11000000-0000-0000-0000-000000000001',
  delta: 10,
  reason: 'purchase',
  refType: 'purchase_order',
  refId: 'PO-2026-001',
  note: 'Initial batch receiving',
  byUserId: '00000000-0000-0000-0000-000000000001',
  createdAt: '2026-11-20T10:00:00Z',
};

export const fixtureOrder: Order = {
  id: '13000000-0000-0000-0000-000000000001',
  memberId: '20000000-0000-0000-0000-000000000001',
  guestName: null,
  guestPhone: null,
  channel: 'online',
  status: 'ready',
  fulfilment: 'pickup',
  deliveryAddress: null,
  invoiceId: '30000000-0000-0000-0000-000000000001',
  createdBy: '20000000-0000-0000-0000-000000000001',
  items: [
    {
      id: '14000000-0000-0000-0000-000000000001',
      orderId: '13000000-0000-0000-0000-000000000001',
      variantId: '11000000-0000-0000-0000-000000000001',
      qty: 1,
      unitPricePaise: 1104915, // 15% Gold member discount applied
      productName: 'Pro Wilson Tennis Racket',
      optionLabel: 'Grip 3 (4 3/8")',
      sku: 'RACK-WIL-PRO-G3',
    },
  ],
  createdAt: '2026-11-21T08:30:00Z',
  updatedAt: '2026-11-21T09:00:00Z',
};
