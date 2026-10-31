// Creates .env from .env.example with fresh random secrets. Safe to re-run (never overwrites an existing .env).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');
if (existsSync(target)) {
  console.log('.env already exists, leaving it untouched.');
  process.exit(0);
}
let text = readFileSync(join(root, '.env.example'), 'utf8');
const secret = () => randomBytes(48).toString('hex');
text = text.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`).replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secret()}`);
writeFileSync(target, text);
console.log('Created .env with fresh random JWT secrets.');
console.log('Default admin login after "npm run seed":  admin / Admin@12345  (change ADMIN_PASSWORD in .env before seeding on a real server).');
