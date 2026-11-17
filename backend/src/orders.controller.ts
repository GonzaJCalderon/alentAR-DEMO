import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { R2Service } from './r2.service';
import {
  calculateCartPricing,
  OrderItem,
  StorageService,
} from './storage.service';

@Controller('api/orders')
export class OrdersController {
  constructor(
    private readonly storage: StorageService,
    private readonly r2: R2Service,
  ) {}

  private getMpClient(): MercadoPagoConfig | null {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token || token.trim() === '') return null;
    return new MercadoPagoConfig({ accessToken: token.trim() });
  }

  @Post('checkout')
  async createCheckout(
    @Body()
    body: {
      eventId: string;
      photoIds: string[];
      buyerEmail?: string;
    },
  ) {
    const { eventId, photoIds, buyerEmail } = body;
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      throw new BadRequestException('Debés seleccionar al menos una foto');
    }

    const db = this.storage.getData();
    const validPhotos = db.photos.filter((p) => photoIds.includes(p.id));
    if (validPhotos.length === 0) {
      throw new BadRequestException('Las fotos seleccionadas no existen');
    }

    const pricing = this.storage.getPricing(eventId);
    const { qty, subtotal, discount, total } = calculateCartPricing(
      validPhotos.length,
      pricing,
    );

    const orderId = uuidv4();
    const downloadToken = uuidv4();

    const order: OrderItem = {
      id: orderId,
      eventId: eventId || validPhotos[0].eventId,
      photoIds: validPhotos.map((p) => p.id),
      qty,
      subtotal,
      discount,
      total: Math.max(1, total),
      status: 'pending',
      downloadToken,
      buyerEmail,
      createdAt: new Date().toISOString(),
    };

    const frontendUrl = (process.env.FRONTEND_URL || 'https://alentar.com.ar').replace(
      /\/$/,
      '',
    );
    const backendPublicUrl = (
      process.env.BACKEND_PUBLIC_URL || 'https://alentar.com.ar'
    ).replace(/\/$/, '');

    const mpClient = this.getMpClient();

    if (mpClient) {
      const preference = new Preference(mpClient);
      const photoCodes = validPhotos.map((p) => `#${p.code}`).join(', ');

      const prefResult = await preference.create({
        body: {
          items: [
            {
              id: order.id,
              title: `AlentAR - ${qty} ${qty === 1 ? 'Foto HD' : 'Fotos HD'} (${photoCodes})`,
              quantity: 1,
              unit_price: order.total,
              currency_id: 'ARS',
            },
          ],
          payer: buyerEmail ? { email: buyerEmail } : undefined,
          external_reference: order.id,
          back_urls: {
            success: `${frontendUrl}/orden/${order.id}`,
            failure: `${frontendUrl}/orden/${order.id}`,
            pending: `${frontendUrl}/orden/${order.id}`,
          },
          auto_return: 'approved',
          notification_url: backendPublicUrl.includes('localhost')
            ? undefined
            : `${backendPublicUrl}/api/orders/webhook`,
        },
      });

      order.mpPreferenceId = prefResult.id;
      db.orders.push(order);
      this.storage.save();

      return {
        orderId: order.id,
        total: order.total,
        initPoint: prefResult.init_point,
        mode: 'mercadopago',
      };
    }

    db.orders.push(order);
    this.storage.save();

    return {
      orderId: order.id,
      total: order.total,
      initPoint: `/orden/${order.id}?demo=1`,
      mode: 'demo',
    };
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any, @Query() query: any) {
    try {
      const paymentId =
        body?.data?.id || query?.['data.id'] || (query?.topic === 'payment' ? query?.id : null);

      if (paymentId) {
        await this.verifyPaymentWithMercadoPago(String(paymentId));
      }
    } catch (e) {
      console.error('Webhook error:', e);
    }
    return { received: true };
  }

  private async verifyPaymentWithMercadoPago(paymentId: string): Promise<OrderItem | null> {
    const mpClient = this.getMpClient();
    if (!mpClient) return null;

    try {
      const paymentApi = new Payment(mpClient);
      const paymentInfo = await paymentApi.get({ id: paymentId });

      if (paymentInfo && paymentInfo.external_reference) {
        const db = this.storage.getData();
        const order = db.orders.find((o) => o.id === paymentInfo.external_reference);
        if (order) {
          order.mpPaymentId = String(paymentId);
          if (paymentInfo.status === 'approved') {
            order.status = 'approved';
            order.approvedAt = order.approvedAt || new Date().toISOString();
          } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
            order.status = 'rejected';
          }
          this.storage.save();
          return order;
        }
      }
    } catch (err) {
      console.error('Error verifying payment with MP:', err);
    }
    return null;
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @Query('payment_id') paymentId?: string,
    @Query('status') mpRedirectStatus?: string,
    @Query('demo_approve') demoApprove?: string,
  ) {
    const db = this.storage.getData();
    const order = db.orders.find((o) => o.id === id);
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.status !== 'approved' && paymentId && paymentId !== 'null') {
      await this.verifyPaymentWithMercadoPago(paymentId);
    }

    if (
      order.status !== 'approved' &&
      demoApprove === '1' &&
      !process.env.MP_ACCESS_TOKEN
    ) {
      order.status = 'approved';
      order.approvedAt = new Date().toISOString();
      this.storage.save();
    }

    const photos = db.photos
      .filter((p) => order.photoIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        code: p.code,
        category: p.category,
        thumbUrl: p.thumbUrl,
        downloadUrl:
          order.status === 'approved'
            ? `/api/orders/${order.id}/download/${p.id}?token=${order.downloadToken}`
            : null,
      }));

    return {
      id: order.id,
      eventId: order.eventId,
      qty: order.qty,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt,
      mpConfigured: Boolean(process.env.MP_ACCESS_TOKEN),
      photos,
    };
  }

  @Get(':id/download/:photoId')
  async downloadHdPhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Query('token') token: string,
    @Query('json') asJson: string,
    @Res() res: Response,
  ) {
    const db = this.storage.getData();
    const order = db.orders.find((o) => o.id === id);
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.status !== 'approved' || order.downloadToken !== token) {
      throw new ForbiddenException('El pago de esta orden aún no fue acreditado.');
    }
    if (!order.photoIds.includes(photoId)) {
      throw new ForbiddenException('Esta foto no pertenece a la orden.');
    }

    const photo = db.photos.find((p) => p.id === photoId);
    if (!photo) {
      throw new NotFoundException('Foto no encontrada');
    }

    const downloadFilename = `AlentAR_Foto_${photo.code}.jpg`;

    const signedUrl = await this.r2.getSignedDownloadUrl(
      photo.hdFile,
      downloadFilename,
      900,
    );

    if (asJson === '1') {
      return res.json({ signedUrl, expiresIn: 900 });
    }

    return res.redirect(302, signedUrl);
  }
}
