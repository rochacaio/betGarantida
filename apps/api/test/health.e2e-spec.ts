import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => app.close());

  it("GET /api/v1/health", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "betgarantida-api",
    });
  });

  it("protects private routes with the global session guard", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
  });
});
