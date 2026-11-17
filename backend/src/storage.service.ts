import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { R2Service } from './r2.service';

export interface PricingConfig {
  pricePerPhoto: number; // default: 4000
  promoPackQty: number; // default: 3
  promoPackPrice: number; // default: 10000 (each block of 3 costs 10000, extras cost 4000 each)
}

export function calculateCartPricing(qty: number, pricing: PricingConfig) {
  const unit = Number(pricing.pricePerPhoto) || 4000;
  const packQty = Number(pricing.promoPackQty) || 0;
  const packPrice = Number(pricing.promoPackPrice) || 0;

  const subtotal = qty * unit;
  let total = subtotal;

  if (packQty >= 2 && packPrice > 0 && qty >= packQty) {
    const packs = Math.floor(qty / packQty);
    const remainder = qty % packQty;
    total = packs * packPrice + remainder * unit;
  }

  const discount = Math.max(0, subtotal - total);
  return {
    qty,
    subtotal,
    discount,
    total: Math.max(0, total),
  };
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
  pricing?: PricingConfig;
}

export interface PhotoItem {
  id: string;
  code: string;
  eventId: string;
  category: string;
  originalFilename: string;
  hdFile: string; // private/hd/<eventId>/orig-<uuid>.jpg in R2
  thumbFile: string; // public/thumbs/<eventId>/thumb-<uuid>.webp in R2
  thumbUrl: string; // Direct R2_PUBLIC_URL/public/thumbs/...
  storageProvider: 'r2';
  width: number;
  height: number;
  faceDescriptors?: number[][];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  eventId: string;
  photoIds: string[];
  qty: number;
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'approved' | 'rejected';
  mpPreferenceId?: string;
  mpPaymentId?: string;
  downloadToken: string;
  buyerEmail?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface DatabaseSchema {
  pricing: PricingConfig;
  events: EventItem[];
  photos: PhotoItem[];
  orders: OrderItem[];
}

@Injectable()
export class StorageService implements OnModuleInit {
  public readonly dataDir = process.env.DATA_PATH || path.join(process.cwd(), 'data');
  public readonly dbFile = path.join(this.dataDir, 'db.json');
  private readonly r2DbKey = 'system/alentar-db.json';

  private db: DatabaseSchema;

  constructor(private readonly r2: R2Service) {}

  async onModuleInit() {
    fs.mkdirSync(this.dataDir, { recursive: true });

    if (fs.existsSync(this.dbFile)) {
      try {
        this.db = this.normalizeDb(JSON.parse(fs.readFileSync(this.dbFile, 'utf-8')));
        return;
      } catch {}
    }

    if (this.r2.isEnabled()) {
      const r2DbBuffer = await this.r2.getObjectBuffer(this.r2DbKey);
      if (r2DbBuffer) {
        try {
          this.db = this.normalizeDb(JSON.parse(r2DbBuffer.toString('utf-8')));
          fs.writeFileSync(this.dbFile, JSON.stringify(this.db, null, 2), 'utf-8');
          console.log('✅ Base de datos restaurada automáticamente desde Cloudflare R2');
          return;
        } catch {}
      }
    }

    this.db = this.getInitialSeed();
    this.save();
  }

  private normalizeDb(raw: any): DatabaseSchema {
    const seed = this.getInitialSeed();
    const pricing: PricingConfig = {
      pricePerPhoto: Number(raw?.pricing?.pricePerPhoto) || seed.pricing.pricePerPhoto,
      promoPackQty:
        raw?.pricing?.promoPackQty !== undefined
          ? Number(raw.pricing.promoPackQty)
          : seed.pricing.promoPackQty,
      promoPackPrice:
        raw?.pricing?.promoPackPrice !== undefined
          ? Number(raw.pricing.promoPackPrice)
          : seed.pricing.promoPackPrice,
    };

    return {
      pricing,
      events: Array.isArray(raw?.events) && raw.events.length > 0 ? raw.events : seed.events,
      photos: Array.isArray(raw?.photos) ? raw.photos : [],
      orders: Array.isArray(raw?.orders) ? raw.orders : [],
    };
  }

  private getInitialSeed(): DatabaseSchema {
    return {
      pricing: {
        pricePerPhoto: Number(process.env.DEFAULT_PRICE_ARS || 4000),
        promoPackQty: Number(process.env.DEFAULT_PROMO_QTY || 3),
        promoPackPrice: Number(process.env.DEFAULT_PROMO_PRICE_ARS || 10000),
      },
      events: [
        {
          id: 'ascenso-godoy-cruz',
          club: 'godoy-cruz',
          title: 'Especial Ascenso de Godoy Cruz',
          date: 'Noviembre 2026',
          stadium: 'Estadio Feliciano Gambarte / Malvinas Argentinas',
          division: 'Especial Ascenso • Primera',
          img: '/canchas/godoy-cruz.jpg',
          logoPath: '/logos/godoy-cruz.png',
          featured: true,
          categories: ['Festejos', 'Popular', 'Platea', 'Campo de Juego', 'Caravana'],
        },
        {
          id: 'godoy-cruz-vs-santelmo',
          club: 'godoy-cruz',
          title: 'Godoy Cruz vs San Telmo',
          date: '30/08/2026',
          stadium: 'Estadio Feliciano Gambarte',
          division: 'Primera Nacional',
          img: '/canchas/godoy-cruz.jpg',
          logoPath: '/logos/godoy-cruz.png',
          featured: false,
          categories: ['Popular', 'Platea', 'Campo de Juego'],
        },
        {
          id: 'indep-riv-vs-racing',
          club: 'independiente-rivadavia',
          title: 'Indep. Rivadavia vs Racing',
          date: '29/08/2026',
          stadium: 'Estadio Bautista Gargantini',
          division: 'Liga Profesional',
          img: '/canchas/independiente.jpg',
          logoPath: '/logos/independiente-rivadavia.png',
          featured: false,
          categories: ['Popular', 'Platea', 'Campo de Juego'],
        },
        {
          id: 'gimnasia-mza-vs-talleres',
          club: 'gimnasia-mendoza',
          title: 'Gimnasia (Mza) vs Talleres',
          date: '17/08/2026',
          stadium: 'Estadio Víctor Legrotaglie',
          division: 'Liga Profesional',
          img: '/canchas/gimnasia.jpg',
          logoPath: '/logos/gimnasia-mendoza.png',
          featured: false,
          categories: ['Popular', 'Platea'],
        },
      ],
      photos: [],
      orders: [],
    };
  }

  public save() {
    const jsonStr = JSON.stringify(this.db, null, 2);
    const tmpFile = `${this.dbFile}.tmp`;
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
    fs.renameSync(tmpFile, this.dbFile);

    if (this.r2.isEnabled()) {
      this.r2
        .uploadBuffer(
          this.r2DbKey,
          Buffer.from(jsonStr, 'utf-8'),
          'application/json',
          'no-cache',
        )
        .catch((err) => console.error('Error sincronizando DB en R2:', err));
    }
  }

  public getData(): DatabaseSchema {
    return this.db;
  }

  public getPricing(eventId?: string): PricingConfig {
    if (eventId) {
      const ev = this.db.events.find((e) => e.id === eventId);
      if (ev?.pricing) return ev.pricing;
    }
    return this.db.pricing;
  }

  public updatePricing(pricing: Partial<PricingConfig>, eventId?: string): PricingConfig {
    const clean: PricingConfig = {
      pricePerPhoto: Number(pricing.pricePerPhoto) || 4000,
      promoPackQty: pricing.promoPackQty !== undefined ? Number(pricing.promoPackQty) : 3,
      promoPackPrice: pricing.promoPackPrice !== undefined ? Number(pricing.promoPackPrice) : 10000,
    };

    if (eventId) {
      const ev = this.db.events.find((e) => e.id === eventId);
      if (ev) {
        ev.pricing = clean;
        this.save();
        return ev.pricing;
      }
    }
    this.db.pricing = clean;
    this.save();
    return this.db.pricing;
  }
}
