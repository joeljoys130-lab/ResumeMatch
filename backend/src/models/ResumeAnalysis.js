import mongoose from 'mongoose';

const resumeAnalysisSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true
    },
    jobDescriptionId: {
      type: Number,
      default: null
    },
    resumeFileName: {
      type: String,
      required: true
    },
    resumeText: {
      type: String,
      required: true
    },
    jobDescriptionText: {
      type: String,
      required: true
    },
    result: {
      matchScore: { type: Number, required: true, min: 0, max: 100 },
      atsScore: { type: Number, required: true, min: 0, max: 100 },
      experienceMatch: { type: String, default: '' },
      matchedSkills: [{ type: String }],
      missingSkills: [{ type: String }],
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      recommendations: [{ type: String }],
      summary: { type: String, default: '' }
    },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    model: { type: String, default: 'claude-3-5-sonnet-20241022' },
    latencyMs: { type: Number, default: 0 },
    cached: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

resumeAnalysisSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.ResumeAnalysis || mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
