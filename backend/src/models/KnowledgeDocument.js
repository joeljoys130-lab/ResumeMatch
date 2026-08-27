import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  metadata: {
    sourceFile: String,
    title: String,
    chunkIndex: Number
  }
});

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    sourceFile: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    chunks: [chunkSchema],
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.KnowledgeDocument || mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
