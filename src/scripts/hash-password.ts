import argon2 from "argon2";

const password = process.argv[2];

if (!password) {
    throw new Error("Usage: npx tsx src/scripts/hash-password.ts <password>");
}

console.log(await argon2.hash(password, {
    type: argon2.argon2id,
}));
