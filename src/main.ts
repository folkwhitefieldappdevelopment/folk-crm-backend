import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:9002',
      'http://localhost:8081',
      'https://studio-spwarrior.vercel.app',
      'https://studio-folkwhitefieldappdevelopment-spwarrior.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api\n`);
}
bootstrap();
