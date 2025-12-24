import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch history if sessionId exists
  useEffect(() => {
    if (sessionId) {
      fetch(`${API_BASE}/chat/history?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) setMessages(data.messages);
        });
    }
  }, [sessionId]);

  const sendMessage = async () => {
    setError(null);
    if (!input.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    if (input.length > 1000) {
      setError('Message too long (max 1000 chars).');
      return;
    }
    setLoading(true);
    const userMsg: Message = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, sessionId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSessionId(data.sessionId);
        setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
      }
    } catch (e) {
      setError('Network error.');
    }
    setInput('');
    setLoading(false);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <h2>AI Support Chat</h2>
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-msg ${msg.sender}`}> 
            <span>{msg.sender === 'user' ? 'You' : 'Agent'}:</span> {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {loading && <div className="typing">Agent is typing...</div>}
      <div className="chat-input-row">
        <input
          type="text"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="faq">
        <strong>Try asking:</strong>
        <ul>
          <li>What’s your return policy?</li>
          <li>Do you ship to USA?</li>
          <li>What are your support hours?</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
