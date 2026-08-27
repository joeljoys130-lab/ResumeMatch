import React, { useState } from 'react';
import api from '../services/api';
import { StreamingText, SourceCitation } from '../components/StreamingText';

export default function CareerAssistant() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your RAG-grounded Career Assistant. Ask me anything about resume writing, ATS optimization, interview strategies, or career growth guidelines!'
    }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamToken, setCurrentStreamToken] = useState('');
  const [currentCitations, setCurrentCitations] = useState([]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim() || isStreaming) return;

    const userMsg = query.trim();
    setQuery('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsStreaming(true);
    setCurrentStreamToken('');
    setCurrentCitations([]);

    try {
      // 1. Send query to RAG endpoint
      const res = await api.post('/knowledge/query', { query: userMsg });

      if (res.data?.success) {
        const { answer, citations } = res.data.data;
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: answer, citations }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.response?.data?.error?.message || 'Failed to process RAG query.'}` }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }} className="animate-fade">
      {/* Header Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>📚 RAG Career Assistant</h2>
          <p className="subtitle">Retrieval-Augmented Generation grounded in localized career knowledge base documents</p>
        </div>
        <span style={{ fontSize: '0.8rem', background: 'rgba(20,184,166,0.15)', color: 'var(--accent-teal)', padding: '0.35rem 0.75rem', borderRadius: '999px', fontWeight: 600 }}>
          ⚡ Vector Similarity Retrieval
        </span>
      </div>

      {/* Chat Messages Log */}
      <div className="chat-container card" style={{ minHeight: '400px', background: 'rgba(11, 15, 25, 0.9)' }}>
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.8 }}>
              {m.role === 'user' ? 'You' : 'RAG Assistant'}
            </div>
            <div>{m.content}</div>
            {m.citations && <SourceCitation citations={m.citations} />}
          </div>
        ))}

        {isStreaming && (
          <div className="chat-bubble chat-assistant">
            <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.8 }}>
              RAG Assistant
            </div>
            <StreamingText text={currentStreamToken || 'Searching vector embeddings & generating grounded response...'} isStreaming={true} />
          </div>
        )}
      </div>

      {/* Query Form */}
      <form onSubmit={handleSend} className="card" style={{ display: 'flex', gap: '0.75rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Ask e.g. How do I optimize my resume for ATS parsers?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isStreaming}
        />
        <button type="submit" className="btn btn-primary" disabled={!query.trim() || isStreaming}>
          {isStreaming ? 'Searching...' : 'Ask Assistant'}
        </button>
      </form>
    </div>
  );
}
