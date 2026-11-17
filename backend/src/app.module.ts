import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { OrdersController } from './orders.controller';
import { PhotosController } from './photos.controller';
import { R2Service } from './r2.service';
import { StorageService } from './storage.service';
import { WatermarkService } from './watermark.service';

@Module({
  imports: [],
  controllers: [EventsController, PhotosController, OrdersController],
  providers: [R2Service, StorageService, WatermarkService],
})
export class AppModule {}
