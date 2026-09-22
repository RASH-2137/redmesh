import "dotenv/config";
import { sign, verify } from "paseto-ts/v4";

const secretKey = process.env.PASETO_SECRET_KEY;
const publicKey = process.env.PASETO_PUBLIC_KEY;

if (!secretKey || !publicKey) {
  throw new Error("PASETO keys are not configured");
}

const payload = JSON.stringify({
  sub: "20000000-0000-0000-0000-000000000001",
  purpose: "access",
});

const token = await sign(secretKey, payload);

console.log("Token generated:", `${token.slice(0, 30)}...`);

const verified = await verify(publicKey, token);

console.log("Verified payload:", verified);

try {
  const parts = token.split(".");

  if (parts.length !== 4) {
    throw new Error("Unexpected PASETO token format");
  }

  const tamperedToken = `${parts.slice(0, -1).join(".")}.tampered`;

  await verify(publicKey, tamperedToken);

  console.error("ERROR: Tampered token was accepted");
  process.exitCode = 1;
} catch {
  console.log("Tampered token rejected: PASS");
}