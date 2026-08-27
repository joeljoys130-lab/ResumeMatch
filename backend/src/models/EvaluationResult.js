import mongoose from 'mongoose';

const evaluationResultSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      index: true
    },
    testCaseId: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    passed: {
      type: Boolean,
      required: true
    },
    schemaValid: { type: Boolean, default: false },
    scoreValid: { type: Boolean, default: false },
    expectedSkillsFound: { type: Boolean, default: false },
    injectionHandled: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    rawOutput: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

evaluationResultSchema.index({ runId: 1, category: 1 });

export default mongoose.models.EvaluationResult || mongoose.model('EvaluationResult', evaluationResultSchema);
