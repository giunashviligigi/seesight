import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TripsService } from './trips.service';

const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class TripsPromotionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TripsPromotionScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly tripsService: TripsService) {}

  onModuleInit(): void {
    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, ONE_HOUR_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runOnce(): Promise<void> {
    try {
      const count = await this.tripsService.promoteDueTrips();
      if (count > 0) {
        this.logger.log(
          `Auto-promoted ${count} approved trip(s) to in progress`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to auto-promote approved trips',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
