"use client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Brain, Link, Folder, Mic } from "lucide-react"
import { LiquidMetal, PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { useState, useEffect, useRef } from "react"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function ChatInterface() {
  const [isFocused, setIsFocused] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch chat history on mount or sessionId change
  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/chat/history?sessionId=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              content: m.text,
              role: m.sender === "user" ? "user" : "assistant",
              timestamp: new Date(m.timestamp)
            }))
          )
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load chat history.")
        setLoading(false)
      })
  }, [sessionId])

  // Send message handler
  async function handleSend() {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    const prevSessionId = sessionId
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, sessionId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Unknown error")
      // Add user message
      setMessages(msgs => [
        ...msgs,
        { id: crypto.randomUUID(), content: input, role: "user", timestamp: new Date() },
        { id: crypto.randomUUID(), content: data.reply, role: "assistant", timestamp: new Date() }
      ])
      setSessionId(data.sessionId)
      setInput("")
    } catch (e: any) {
      setError(e.message || "Failed to send message.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl relative">
        <div className="flex flex-row items-center mb-2">
          {/* Shader Circle */}
          <motion.div
            id="circle-ball"
            className="relative flex items-center justify-center z-10"
            animate={{
              y: isFocused ? 50 : 0,
              opacity: isFocused ? 0 : 100,
              filter: isFocused ? "blur(4px)" : "blur(0px)",
            }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
          >
            <div className="z-10 absolute bg-white/5 h-11 w-11 rounded-full backdrop-blur-[3px]">
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-4 left-4  blur-[1px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-3 left-7  blur-[0.8px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-8 left-2  blur-[1px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-5 left-9 blur-[0.8px]" />
              <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-7 left-7  blur-[1px]" />
            </div>
            <LiquidMetal
              style={{ height: 80, width: 80, filter: "blur(14px)", position: "absolute" }}
              colorBack="hsl(0, 0%, 0%, 0)"
              colorTint="hsl(29, 77%, 49%)"
              repetition={4}
              softness={0.5}
              shiftRed={0.3}
              shiftBlue={0.3}
              distortion={0.1}
              contour={1}
              shape="circle"
              offsetX={0}
              offsetY={0}
              scale={0.58}
              rotation={50}
              speed={5}
            />
            <LiquidMetal
              style={{ height: 80, width: 80 }}
              colorBack="hsl(0, 0%, 0%, 0)"
              colorTint="hsl(29, 77%, 49%)"
              repetition={4}
              softness={0.5}
              shiftRed={0.3}
              shiftBlue={0.3}
              distortion={0.1}
              contour={1}
              shape="circle"
              offsetX={0}
              offsetY={0}
              scale={0.58}
              rotation={50}
              speed={5}
            />
          </motion.div>

          {/* Greeting Text */}
          <motion.p
            className="text-white/40 text-sm font-light z-10"
            animate={{
              y: isFocused ? 50 : 0,
              opacity: isFocused ? 0 : 100,
              filter: isFocused ? "blur(4px)" : "blur(0px)",
            }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
          >
            Hey there! I'm here to help with anything you need
          </motion.p>
        </div>

        <div className="relative">
          <motion.div
            className="absolute w-full h-full z-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{
              duration: 0.8, 
            }}
          >
            <PulsingBorder
              style={{ height: "146.5%", minWidth: "143%" }}
              colorBack="hsl(0, 0%, 0%)"
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.3}
              bloom={2}
              spots={2}
              spotSize={0.25}
              pulse={0}
              smoke={0.35}
              smokeSize={0.4}
              scale={0.7}
              rotation={0}
              offsetX={0}
              offsetY={0}
              speed={1}
              colors={[
                "hsl(29, 70%, 37%)",
                "hsl(32, 100%, 83%)",
                "hsl(4, 32%, 30%)",
                "hsl(25, 60%, 50%)",
                "hsl(0, 100%, 10%)",
              ]}
            />
          </motion.div>

          <motion.div
            className="relative bg-[#040404] rounded-2xl p-4 z-10"
            animate={{
              borderColor: isFocused ? "#BA9465" : "#3D3D3D",
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
            }}
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            {/* Chat messages */}
            <div className="mb-4 max-h-[400px] overflow-y-auto bg-black/30 rounded-xl p-3">
              {messages.length === 0 && !loading && (
                <div className="text-zinc-500 text-center">No messages yet. Start the conversation!</div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`mb-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`px-4 py-2 rounded-xl max-w-[70%] text-sm ${msg.role === "user" ? "bg-orange-400 text-black" : "bg-zinc-800 text-white"}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-zinc-400 text-center">Thinking...</div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Message Input */}
            <div className="relative mb-6">
              <Textarea
                placeholder="Type your message..."
                className="min-h-[80px] resize-none bg-transparent border-none text-white text-base placeholder:text-zinc-500 focus:ring-0 focus:outline-none"
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading) handleSend();
                  }
                }}
                disabled={loading}
              />
              {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
            </div>
            <div className="flex items-center justify-between">
              {/* Left side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white p-0"
                >
                  <Brain className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Link className="h-4 w-4" />
                </Button>
                {/* Center model selector */}
                <div className="flex items-center">
                  <Select defaultValue="gpt-4">
                    <SelectTrigger className="bg-zinc-900 border-[#3D3D3D] text-white hover:bg-zinc-700 text-xs rounded-full px-2 h-8 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">⚡</span>
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 z-30 border-[#3D3D3D] rounded-xl z-30">
                      <SelectItem value="gemini-2.5-pro" className="text-white hover:bg-zinc-700 rounded-lg">
                        Gemini 2.5 Pro
                      </SelectItem>
                      <SelectItem value="gpt-4" className="text-white hover:bg-zinc-700 rounded-lg">
                        GPT-4
                      </SelectItem>
                      <SelectItem value="claude-3" className="text-white hover:bg-zinc-700 rounded-lg">
                        Claude 3
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white p-0"
                >
                  <Folder className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-orange-200 hover:bg-orange-300 text-orange-800 p-0"
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="ml-2 bg-orange-400 text-black hover:bg-orange-500"
                >
                  Send
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
