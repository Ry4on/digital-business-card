import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    DatabaseModule,
    ProfileModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      graphiql: false,
      // Public API exploration is the purpose of this demo, including production.
      introspection: true,
      includeStacktraceInErrorResponses: false,
      formatError: error => error.extensions?.code === 'INTERNAL_SERVER_ERROR'
        ? { message: 'The profile is temporarily unavailable', extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        : error,
      plugins: [ApolloServerPluginLandingPageLocalDefault({
        embed: { runTelemetry: false },
        footer: false,
      })],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
