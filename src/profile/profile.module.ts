import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProfileRepository } from './profile.repository';
import { ProfileResolver } from './profile.resolver';
import { ProfileService } from './profile.service';

@Module({
  imports: [DatabaseModule],
  providers: [ProfileRepository, ProfileService, ProfileResolver],
})
export class ProfileModule {}
