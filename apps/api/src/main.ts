import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { API_PREFIX } from "@betgarantida/contracts";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { Express, json, urlencoded } from "express";
import { validationException } from "./validation-exception";
import { ApiExceptionFilter } from "./api-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

  const express = app.getHttpAdapter().getInstance() as Express;
  express.set("trust proxy", 1);
  app.use(helmet());
  app.use(json({ limit: "32kb" }));
  app.use(urlencoded({ extended: false, limit: "32kb" }));
  app.enableCors({ origin: appOrigin, credentials: true });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const openApiConfig = new DocumentBuilder()
    .setTitle("BetGarantida API")
    .setDescription("API do monólito modular BetGarantida")
    .setVersion("1.0")
    .addCookieAuth("betgarantida_session")
    .build();
  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(app, openApiConfig),
  );

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
