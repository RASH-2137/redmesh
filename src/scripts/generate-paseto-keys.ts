import { generateKeys } from "paseto-ts/v4";

const { secretKey, publicKey } = generateKeys("public");

console.log(`PASETO_SECRET_KEY=${secretKey}`);
console.log(`PASETO_PUBLIC_KEY=${publicKey}`);