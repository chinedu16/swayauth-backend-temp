import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cluster from 'cluster';
import { cpus } from 'os';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter, TransformInterceptor } from './common';

const cpuNumber = cpus().length;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.enableShutdownHooks();
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/public/' });
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  app.setBaseViewsDir(join(__dirname, '..', 'templates'));
  app.setViewEngine('hbs');
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
  });
  await app.listen(process.env.PORT ?? 8000);
}

if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
  console.log(`Master cluster setting up ${cpuNumber}  workers...`);

  for (let i = 0; i < cpuNumber; i++) {
    cluster.fork();
  }

  cluster.on('online', function (worker) {
    console.log(`Worker ${worker.process.pid ?? 'anonymous'} is online`);
  });

  cluster.on('exit', function (worker, code, signal) {
    console.log(
      `Worker ${worker.process.pid ?? 'anonymous'} died with code:  ${code}, and signal: ${signal}`,
    );
    console.log('Starting a new worker');
    cluster.fork();
  });
} else {
  bootstrap();
}
