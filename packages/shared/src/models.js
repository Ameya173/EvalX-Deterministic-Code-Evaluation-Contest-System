import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

const userSchema = new Schema(
  {
    handle: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'setter', 'admin'], default: 'user' },
    tokenVersion: { type: Number, default: 0 },
  },
  opts
);

const problemSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true },
    statementMd: { type: String, default: '' },
    timeLimitMs: { type: Number, default: 1000 },
    memoryKb: { type: Number, default: 262144 },
    checkerType: { type: String, enum: ['token', 'exact', 'float'], default: 'token' },
    checkerEpsilon: { type: Number, default: 1e-6 },
    visibility: { type: String, enum: ['public', 'private', 'contest'], default: 'public' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    tags: [String],
    difficulty: Number,
    category: { type: String, default: 'Arrays' },
    companies: [String],
    sheet: [String],
    hints: [String],
    acceptanceRate: { type: Number, default: 65 },
    // C2: declared complexity of the reference solution, e.g. "n log n"
    declaredComplexity: { type: String, default: '' },
    reference: { lang: String, source: String },
    // Generator contract: reads "n seed" from stdin and prints one valid input of size n.
    generator: { lang: String, source: String },
    scaling: {
      minN: { type: Number, default: 1000 },
      maxN: { type: Number, default: 256000 },
    },
    // C3 summary (full report is in the Report collection)
    strength: {
      score: Number,
      mutantsTotal: Number,
      nonEquivalent: Number,
      killed: Number,
      computedAt: Date,
    },
  },
  opts
);

const testCaseSchema = new Schema(
  {
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    ordinal: { type: Number, required: true },
    input: { type: String, default: '' },
    output: { type: String, default: '' },
    isSample: { type: Boolean, default: false },
    origin: { type: String, enum: ['manual', 'hardened'], default: 'manual' },
  },
  opts
);
testCaseSchema.index({ problemId: 1, ordinal: 1 });

const testResultSchema = new Schema(
  {
    ordinal: Number,
    verdict: String,
    timeMs: Number, // normalised median CPU time (C1)
    rawMs: Number, // raw CPU time of the first run
    runs: [Number], // normalised times of every run
    ciLow: Number,
    ciHigh: Number,
    confidence: Number, // null for clear cases
    borderline: { type: Boolean, default: false },
    memKb: Number,
    isSample: Boolean,
  },
  { _id: false }
);

const submissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    handle: String,
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    problemSlug: String,
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest', index: true },
    language: { type: String, required: true },
    source: { type: String, required: true },
    isRun: { type: Boolean, default: false },
    customInput: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    runOutput: {
      stdout: { type: String, default: '' },
      stderr: { type: String, default: '' },
      timeMs: Number,
      memKb: Number,
      exitCode: Number,
    },
    status: { type: String, enum: ['queued', 'judging', 'done'], default: 'queued' },
    verdict: String,
    failedTest: Number,
    maxTimeMs: Number,
    maxMemKb: Number,
    compileLog: String,
    tests: [testResultSchema],
    testsTotal: Number,
    speedFactor: Number,
    borderline: { type: Boolean, default: false },
    minConfidence: Number,
    policy: String,
    workerId: String,
    analysisStatus: { type: String, enum: ['none', 'queued', 'running', 'done', 'failed'], default: 'none' },
    judgedAt: Date,
  },
  opts
);
submissionSchema.index({ userId: 1, createdAt: -1 });
submissionSchema.index({ contestId: 1, createdAt: 1 });

const contestSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    freezeAt: Date,
    problems: [{ problemId: { type: Schema.Types.ObjectId, ref: 'Problem' }, label: String, _id: false }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  opts
);

const participantSchema = new Schema(
  {
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  opts
);
participantSchema.index({ contestId: 1, userId: 1 }, { unique: true });

const reportSchema = new Schema(
  {
    kind: { type: String, enum: ['complexity', 'strength'], required: true },
    problemId: { type: Schema.Types.ObjectId, index: true },
    submissionId: { type: Schema.Types.ObjectId, index: true },
    status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
    progress: { type: Number, default: 0 },
    error: String,
    data: Schema.Types.Mixed,
  },
  opts
);

const calibrationSchema = new Schema({
  workerId: String,
  canaryMs: Number,
  speedFactor: Number,
  ts: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

export const User = model('User', userSchema);
export const Problem = model('Problem', problemSchema);
export const TestCase = model('TestCase', testCaseSchema);
export const Submission = model('Submission', submissionSchema);
export const Contest = model('Contest', contestSchema);
export const Participant = model('Participant', participantSchema);
export const Report = model('Report', reportSchema);
export const Calibration = model('Calibration', calibrationSchema);

export async function connectMongo(url) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(url, { serverSelectionTimeoutMS: 15000 });
  return mongoose.connection;
}
export { mongoose };
