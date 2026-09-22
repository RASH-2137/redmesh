import type { FastifyInstance } from "fastify";
import { pool } from "../config/database.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/db", async () => {
    const result = await pool.query<{ ok: number }>("SELECT 1 AS ok");

    return {
      status: "ok",
      database: result.rows[0]?.ok === 1 ? "connected" : "unknown",
    };
  });
}