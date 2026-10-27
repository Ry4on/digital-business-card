import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readConfig } from './config';

async function bootstrap(): Promise<void> {
  const { port } = readConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

void bootstrap().catch(() => {
  // Connection errors may contain credentials; report configuration without printing URLs.
  process.stderr.write('Application startup failed. Check configuration and database availability.\n');
  process.exitCode = 1;
});
