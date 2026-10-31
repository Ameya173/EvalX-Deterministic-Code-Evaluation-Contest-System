import 'dotenv/config';
import { Problem, connectMongo } from '@judgebox/shared';

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/judgebox';

await connectMongo(mongoUrl);

console.log('Rebalancing sheet tags across JudgeBox database...');

const problems = await Problem.find().sort({ createdAt: 1 }).lean();
console.log(`Fetched ${problems.length} total problems from database.`);

// Priority scoring:
// - Base named problems (!title.includes('Mastery:')) get priority 1
// - Balanced across categories (Arrays, Strings, Linked Lists, Trees, Graphs, DP, etc.)
const baseNamed = problems.filter((p) => !p.title.includes('Mastery:'));
const variations = problems.filter((p) => p.title.includes('Mastery:'));

console.log(`Found ${baseNamed.length} base named problems and ${variations.length} extended problems.`);

// Sort base problems by difficulty and topic so we get a great mix
baseNamed.sort((a, b) => (a.difficulty || 800) - (b.difficulty || 800));
variations.sort((a, b) => (a.difficulty || 800) - (b.difficulty || 800));

// 1. Blind 75 Selection:
// Take the first 75 base classic problems (covers Arrays, Strings, Trees, Graphs, DP, etc.)
// If baseNamed is slightly different, take up to 75
const blind75Set = new Set(baseNamed.slice(0, 75).map((p) => String(p._id)));
if (blind75Set.size < 75) {
  for (const v of variations) {
    if (blind75Set.size >= 75) break;
    blind75Set.add(String(v._id));
  }
}

// 2. NeetCode 150 Selection:
// Includes all 75 from Blind 75 + next 75 problems (combining rest of baseNamed + top variations)
const neetCode150Set = new Set(blind75Set);
for (const p of baseNamed.slice(75)) {
  if (neetCode150Set.size >= 150) break;
  neetCode150Set.add(String(p._id));
}
for (const v of variations) {
  if (neetCode150Set.size >= 150) break;
  neetCode150Set.add(String(v._id));
}

// 3. Striver SDE Sheet Selection:
// EXACTLY 180 problems
const striverSet = new Set();
// Add all base named problems
for (const p of baseNamed) {
  if (striverSet.size >= 180) break;
  striverSet.add(String(p._id));
}
// Fill up to 180 from variations
for (const v of variations) {
  if (striverSet.size >= 180) break;
  striverSet.add(String(v._id));
}

console.log(`Computed Sets: Blind75=${blind75Set.size}, NeetCode150=${neetCode150Set.size}, Striver=${striverSet.size}`);

// Bulk update problems
let updated = 0;
for (const p of problems) {
  const idStr = String(p._id);
  const newSheets = ['Top 500 Mastery'];

  if (blind75Set.has(idStr)) newSheets.push('Blind 75');
  if (neetCode150Set.has(idStr)) newSheets.push('NeetCode 150');
  if (striverSet.has(idStr)) newSheets.push('Striver SDE');

  await Problem.updateOne({ _id: p._id }, { $set: { sheet: newSheets } });
  updated++;
}

console.log(`Updated ${updated} problems.`);

// Verify counts in DB
const b75Count = await Problem.countDocuments({ sheet: 'Blind 75' });
const nc150Count = await Problem.countDocuments({ sheet: 'NeetCode 150' });
const striverCount = await Problem.countDocuments({ sheet: 'Striver SDE' });
const top500Count = await Problem.countDocuments({ sheet: 'Top 500 Mastery' });

console.log('✓ Verification in MongoDB:');
console.log(`  - Blind 75: ${b75Count} problems (Target: 75)`);
console.log(`  - NeetCode 150: ${nc150Count} problems (Target: 150)`);
console.log(`  - Striver SDE: ${striverCount} problems (Target: 180)`);
console.log(`  - Top 500 Mastery: ${top500Count} problems (Target: 500+)`);

process.exit(0);
