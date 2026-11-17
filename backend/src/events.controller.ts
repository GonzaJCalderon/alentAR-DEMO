import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { R2Service } from './r2.service';
import { EventItem, PricingConfig, StorageService } from './storage.service';

const CLUB_ASSETS: Record<string, { img: string; logoPath: string }> = {
  'godoy-cruz': {
    img: '/canchas/godoy-cruz.jpg',
    logoPath: '/logos/godoy-cruz.png',
  },
  'independiente-rivadavia': {
    img: '/canchas/independiente.jpg',
    logoPath: '/logos/independiente-rivadavia.png',
  },
  'gimnasia-mendoza': {
    img: '/canchas/gimnasia.jpg',
    logoPath: '/logos/gimnasia-mendoza.png',
  },
  'huracan-las-heras': {
    img: '/canchas/huracan.jpg',
    logoPath: '/logos/huracan-las-heras.png',
  },
};

@Controller('api/events')
export class EventsController {
  constructor(
    private readonly storage: StorageService,
    private readonly r2: R2Service,
  ) {}

  private checkAdminKey(key?: string) {
    const expected = process.env.ADMIN_PASSWORD || 'alentar2026';
    if (key && key !== expected) {
      throw new UnauthorizedException('Clave de administrador inválida');
    }
  }

  @Get()
  getAllEvents() {
    const data = this.storage.getData();
    const eventsWithCount = data.events.map((ev) => ({
      ...ev,
      photoCount: data.photos.filter((p) => p.eventId === ev.id).length,
      pricing: this.storage.getPricing(ev.id),
    }));
    return {
      pricing: data.pricing,
      events: eventsWithCount,
    };
  }

  @Get('stats')
  getStats() {
    const data = this.storage.getData();
    const approvedOrders = data.orders.filter((o) => o.status === 'approved');
    const totalRevenue = approvedOrders.reduce((acc, o) => acc + o.total, 0);
    const totalPhotosSold = approvedOrders.reduce((acc, o) => acc + o.qty, 0);

    return {
      totalPhotos: data.photos.length,
      totalOrders: data.orders.length,
      approvedOrdersCount: approvedOrders.length,
      totalPhotosSold,
      totalRevenue,
      pricing: data.pricing,
      mpConfigured: Boolean(process.env.MP_ACCESS_TOKEN),
      r2Configured: this.r2.isEnabled(),
      r2Bucket: this.r2.bucketName,
      recentOrders: data.orders.slice(-20).reverse(),
    };
  }

  @Get(':id')
  getEvent(@Param('id') id: string) {
    const data = this.storage.getData();
    const ev = data.events.find((e) => e.id === id);
    if (!ev) return null;
    return {
      ...ev,
      photoCount: data.photos.filter((p) => p.eventId === ev.id).length,
      pricing: this.storage.getPricing(ev.id),
    };
  }

  @Put('pricing')
  updateGlobalPricing(
    @Body() body: Partial<PricingConfig> & { eventId?: string },
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.checkAdminKey(adminKey);
    const { eventId, ...pricing } = body;
    return this.storage.updatePricing(
      {
        pricePerPhoto: Number(pricing.pricePerPhoto),
        promoPackQty: Number(pricing.promoPackQty),
        promoPackPrice: Number(pricing.promoPackPrice),
      },
      eventId,
    );
  }

  @Post()
  createEvent(
    @Body()
    body: {
      title: string;
      club: string;
      date: string;
      stadium?: string;
      division?: string;
      featured?: boolean;
      img?: string;
      logoPath?: string;
      categories?: string[];
    },
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.checkAdminKey(adminKey);
    const slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const clubKey = body.club || 'godoy-cruz';
    const assets = CLUB_ASSETS[clubKey] || {
      img: '/canchas/godoy-cruz.jpg',
      logoPath: '/logo_alentar_circle.png',
    };

    const data = this.storage.getData();
    if (body.featured) {
      data.events.forEach((ev) => {
        ev.featured = false;
      });
    }

    const newEvent: EventItem = {
      id: `${slug}-${Date.now().toString().slice(-4)}`,
      club: clubKey,
      title: body.title,
      date: body.date,
      stadium: body.stadium || '',
      division: body.division || 'Torneo Oficial',
      img: body.img || assets.img,
      logoPath: body.logoPath || assets.logoPath,
      featured: Boolean(body.featured),
      categories: body.categories?.length
        ? body.categories
        : ['Festejos', 'Popular', 'Platea', 'Campo de Juego', 'Caravana'],
    };

    data.events.unshift(newEvent);
    this.storage.save();
    return newEvent;
  }

  @Put(':id/feature')
  setFeaturedEvent(
    @Param('id') id: string,
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.checkAdminKey(adminKey);
    const data = this.storage.getData();
    const target = data.events.find((e) => e.id === id);
    if (!target) {
      throw new NotFoundException('Partido no encontrado');
    }
    data.events.forEach((ev) => {
      ev.featured = ev.id === id;
    });
    this.storage.save();
    return { featuredId: id };
  }

  @Delete(':id')
  deleteEvent(
    @Param('id') id: string,
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.checkAdminKey(adminKey);
    const data = this.storage.getData();
    const idx = data.events.findIndex((e) => e.id === id);
    if (idx === -1) {
      throw new NotFoundException('Partido no encontrado');
    }
    data.events.splice(idx, 1);
    if (data.events.length > 0 && !data.events.some((e) => e.featured)) {
      data.events[0].featured = true;
    }
    this.storage.save();
    return { deleted: true, id };
  }
}
