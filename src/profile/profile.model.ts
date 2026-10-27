import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProfessionalLink {
  @Field(() => String) label!: string;
  @Field(() => String) url!: string;
}

@ObjectType()
export class Skill {
  @Field(() => String) name!: string;
}

@ObjectType()
export class Experience {
  @Field(() => String) company!: string;
  @Field(() => String) position!: string;
  @Field(() => GraphQLISODateTime, { description: 'Start month as the first day, UTC.' })
  startDate!: Date;
  @Field(() => GraphQLISODateTime, { nullable: true, description: 'End month as the first day, UTC. Null means ongoing.' })
  endDate!: Date | null;
  @Field(() => [String]) achievements!: string[];
}

@ObjectType()
export class Project {
  @Field(() => String) name!: string;
  @Field(() => String) description!: string;
  @Field(() => String) url!: string;
}

@ObjectType()
export class Profile {
  @Field(() => String) name!: string;
  @Field(() => String) description!: string;
  @Field(() => [ProfessionalLink]) links!: ProfessionalLink[];
  @Field(() => [Skill]) skills!: Skill[];
  @Field(() => [Experience]) experience!: Experience[];
  @Field(() => [Project]) projects!: Project[];
}
