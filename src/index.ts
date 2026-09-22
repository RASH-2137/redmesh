import "dotenv/config";
import Fastify from "fastify";
import { validateAppEnv } from "./config/env.js";

validateAppEnv();
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { assetRoutes } from "./routes/assets.js";
import { provisioningRoutes } from "./routes/provisioning.js";
import { auditRoutes } from "./routes/audit.js";
import { trace } from "@opentelemetry/api";

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: {
            paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "headers.authorization",
                "headers.cookie",
                "*.password",
                "*.passwordHash",
                "*.accessToken",
                "*.refreshToken",
                "*.token",
                "*.paseto",
            ],
            remove: true,
        },
    },
});

app.addHook("onRequest", async (request) => {
    const span = trace.getActiveSpan();

    if (!span) {
        return;
    }

    const spanContext = span.spanContext();

    request.log.info(
        {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
            requestId: request.id,
        },
        "request.trace_context",
    );
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

app.get("/health", async () => {
    return {
        status: "ok",
        service: "REDmesh",
        environment: process.env.NODE_ENV ?? "development",
    };
});

await healthRoutes(app);
await authRoutes(app);
await assetRoutes(app);
await provisioningRoutes(app);
await auditRoutes(app);

try {
    await app.listen({
        port,
        host,
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}