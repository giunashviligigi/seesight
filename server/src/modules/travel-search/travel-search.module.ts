import { Module } from '@nestjs/common';
import { SerpApiClient } from './serpapi.client';
import { TravelSearchController } from './travel-search.controller';
import { TravelSearchService } from './travel-search.service';

@Module({
  controllers: [TravelSearchController],
  providers: [SerpApiClient, TravelSearchService],
  exports: [TravelSearchService, SerpApiClient],
})
export class TravelSearchModule {}
