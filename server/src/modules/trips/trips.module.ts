import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TripsController } from './trips.controller';
import { TripsPromotionScheduler } from './trips-promotion.scheduler';
import { TripsService } from './trips.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TripsController],
  providers: [TripsService, TripsPromotionScheduler],
  exports: [TripsService],
})
export class TripsModule {}
