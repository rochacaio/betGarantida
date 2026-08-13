import { Injectable } from "@nestjs/common";

@Injectable()
export class ObservabilityService {
  private requests = 0;
  private errors = 0;
  private totalDurationMs = 0;
  record(status: number, durationMs: number) {
    this.requests++;
    this.totalDurationMs += durationMs;
    if (status >= 400) this.errors++;
  }
  snapshot() {
    return {
      requests: this.requests,
      errors: this.errors,
      errorRate: this.requests ? this.errors / this.requests : 0,
      averageLatencyMs: this.requests
        ? this.totalDurationMs / this.requests
        : 0,
    };
  }
}
