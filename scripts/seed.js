// Creates the admin user, three sample problems (with tests, reference solutions and generators) and a demo contest.
// Safe to run more than once. Usage: npm run seed
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Contest, Problem, TestCase, User, connectMongo, sampleProblems } from '@judgebox/shared';

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/judgebox';
const handle = process.env.ADMIN_HANDLE || 'admin';
const email = (process.env.ADMIN_EMAIL || 'admin@judgebox.local').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin@12345';

await connectMongo(mongoUrl);

let admin = await User.findOne({ handle });
if (!admin) {
  admin = await User.create({ handle, email, passwordHash: await bcrypt.hash(password, 10), role: 'admin' });
  console.log(`Created admin: ${handle} / ${password}   (change this password in production!)`);
} else {
  console.log(`Admin "${handle}" already exists`);
}

const created = [];
for (const def of sampleProblems()) {
  const { tests, ...fields } = def;
  let p = await Problem.findOne({ slug: def.slug });
  if (!p) p = new Problem({ ...fields, authorId: admin._id });
  else p.set({ ...fields, authorId: admin._id });
  await p.save();
  await TestCase.deleteMany({ problemId: p._id });
  await TestCase.insertMany(tests.map((t, i) => ({ problemId: p._id, ordinal: i + 1, input: t.input, output: t.output, isSample: !!t.isSample, origin: 'manual' })));
  created.push(p);
  console.log(`Problem ready: ${p.slug} (${tests.length} tests)`);
}

if (!(await Contest.exists({ title: 'Welcome Contest' }))) {
  const now = Date.now();
  await Contest.create({
    title: 'Welcome Contest',
    description: 'A demo contest with the three sample problems. Runs for 30 days.',
    startsAt: new Date(now - 60 * 60 * 1000),
    endsAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
    freezeAt: new Date(now + 29 * 24 * 60 * 60 * 1000),
    problems: created.map((p, i) => ({ problemId: p._id, label: String.fromCharCode(65 + i) })),
    createdBy: admin._id,
  });
  console.log('Created contest: Welcome Contest');
}

console.log('Seed complete.');
process.exit(0);
