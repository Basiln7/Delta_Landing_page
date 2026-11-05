#!/usr/bin/env node
// Produce an ADMIN_PASSWORD_HASH (scrypt) so production never stores the admin password in plain text.
//
//   npm run hash-password            → prompts for the password (input hidden)
//   echo "s3cret…" | npm run hash-password
//
// Put the printed line in the server environment and remove ADMIN_PASSWORD.
import crypto from "node:crypto";
import readline from "node:readline";

function hash(password) {
  const N = 2 ** 15, r = 8, p = 1;
  const salt = crypto.randomBytes(16);
  const out = crypto.scryptSync(password.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  // Colon-separated: "$" would be expanded as a variable when the line is pasted into a .env file.
  return ["scrypt", N, r, p, salt.toString("base64url"), out.toString("base64url")].join(":");
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let data = "";
    for await (const chunk of process.stdin) data += chunk;
    return data.replace(/\r?\n$/, "");
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Hide typed characters.
  rl._writeToOutput = (s) => rl.output.write(s.includes("Password") ? s : "");
  const answer = await new Promise((resolve) => rl.question("Password (12+ characters): ", resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

const password = await readPassword();
if (password.length < 12) {
  console.error("Use at least 12 characters (a passphrase of 4+ random words is ideal).");
  process.exit(1);
}
console.log(`ADMIN_PASSWORD_HASH=${hash(password)}`);
