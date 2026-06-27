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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        'http://localhost:9002',
        'http://localhost:8081',
        'https://studio-spwarrior.vercel.app',
        'https://studio-folkwhitefieldappdevelopment-spwarrior.vercel.app',
      ];
      if (allowed.includes(origin)) return callback(null, true);
      // Allow Vercel preview deployments: https://studio-XXXXX-spwarrior.vercel.app
      if (/^https:\/\/studio-.+-spwarrior\.vercel\.app$/.test(origin)) return callback(null, true);
      const extra = process.env.CORS_ORIGINS;
      if (extra && extra.split(',').map(s => s.trim()).includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
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
