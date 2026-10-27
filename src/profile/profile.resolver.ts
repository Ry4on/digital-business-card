import { Query, Resolver } from '@nestjs/graphql';
import { Profile } from './profile.model';
import { ProfileService } from './profile.service';

@Resolver(() => Profile)
export class ProfileResolver {
  constructor(private readonly profiles: ProfileService) {}

  @Query(() => Profile, { description: 'The professional profile and its related collections.' })
  profile(): Promise<Profile> {
    return this.profiles.getProfile();
  }
}
