import mongoose from 'mongoose';

const llmResponseSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      default: null,
      index: true
    },
    feature: {
      type: String,
      enum: ['ANALYSIS', 'RAG', 'INTERVIEW', 'EVALUATION', 'TOOL_CALL'],
      required: true
    },
    model: {
      type: String,
      required: true
    },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    cached: { type: Boolean, default: false },
    success: { type: Boolean, default: true },
    errorCode: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

llmResponseSchema.index({ feature: 1, createdAt: -1 });
llmResponseSchema.index({ createdAt: -1 });

export default mongoose.models.LLMResponse || mongoose.model('LLMResponse', llmResponseSchema);
