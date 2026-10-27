import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfileRepository } from './profile.repository';
import { Profile } from './profile.model';

@Injectable()
export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  async getProfile(): Promise<Profile> {
    const profile = await this.repository.findProfile();
    if (!profile) throw new NotFoundException('Profile is not initialized');
    return profile;
  }
}
