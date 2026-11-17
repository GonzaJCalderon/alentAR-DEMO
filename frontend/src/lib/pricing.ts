export interface PricingConfig {
  pricePerPhoto: number;
  promoPackQty: number;
  promoPackPrice: number;
}

export interface EventItem {
  id: string;
  club: string;
  title: string;
  date: string;
  stadium?: string;
  division: string;
  img: string;
  logoPath: string;
  featured?: boolean;
  categories: string[];
  photoCount?: number;
  pricing?: PricingConfig;
}

export interface PhotoItem {
  id: string;
  code: string;
  eventId: string;
  category: string;
  width: number;
  height: number;
  thumbUrl: string;
  faceDescriptors?: number[][];
}

export function calculateCartPricingClient(qty: number, pricing: PricingConfig) {
  const unit = Number(pricing.pricePerPhoto) || 4000;
  const packQty = Number(pricing.promoPackQty) || 0;
  const packPrice = Number(pricing.promoPackPrice) || 0;

  const subtotal = qty * unit;
  let total = subtotal;
  let packs = 0;
  let remainder = qty;

  if (packQty >= 2 && packPrice > 0 && qty >= packQty) {
    packs = Math.floor(qty / packQty);
    remainder = qty % packQty;
    total = packs * packPrice + remainder * unit;
  }

  const discount = Math.max(0, subtotal - total);
  return { qty, subtotal, discount, total: Math.max(0, total), packs, remainder };
}

