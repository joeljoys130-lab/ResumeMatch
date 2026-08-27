import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  citations: [
    {
      sourceFile: String,
      title: String,
      excerpt: String
    }
  ],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'New Conversation'
    },
    messages: [messageSchema],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

aiConversationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.AIConversation || mongoose.model('AIConversation', aiConversationSchema);
