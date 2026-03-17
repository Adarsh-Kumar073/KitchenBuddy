"use client"
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Components/sidebar";
import MainContent from "./Components/maincontent";
import Image from "next/image";
import jwt from "jsonwebtoken";

export default function Home() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(true);
  const formRef = useRef(null);
  const [activeChat, setActiveChat] = useState(null);
  const [response, setResponse] = useState("");
  const [text, setText] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [Name, setName] = useState("");

  // ✅ Check login
  useEffect(() => {
    const token = localStorage.getItem("token");
    const visited = localStorage.getItem("hasVisited");
    if (token) {
      const decoded = jwt.decode(token);
      console.log("Token:", decoded?.email);
      setName(decoded?.email || "User");
    }

    if (!token && !visited) {
      localStorage.setItem("hasVisited", "true");
      router.push("/signup");
    } else {
      setCurrentUser(true);
    }
  }, []);

  const goto_voice = () => {
    router.push("/voiceInput");
  };

  // ✅ Fetch existing conversations when page loads
  useEffect(() => {
    if (!currentUser) return;

    const fetchConvos = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`);
        }

        const data = await res.json();
        setConversations(data);

        if (data.length > 0) setActiveChat(data[0]._id);
      } catch (err) {
        console.error("Error fetching conversations:", err);
      }
    };

    fetchConvos();
  }, [currentUser]);

  // fetching chat
  useEffect(() => {
    if (!activeChat) return;

    const fetchChat = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/conversations/${activeChat}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load conversation");
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Error loading conversation:", err);
      }
    };

    fetchChat();
  }, [activeChat]);

  // ✅ Create a new chat
  const handleNewChat = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login first");
        return;
      }

      const res = await fetch("/api/conversations/new", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to create conversation");

      const newChat = await res.json();
      setConversations(prev => [newChat, ...prev]);
      setActiveChat(newChat._id);
      setMessages([]);
    } catch (err) {
      console.error("Error creating new chat:", err);
    }
  };

  // ✅ Ask Gemini backend
  const get_response = async (e) => {
    e.preventDefault();
    formRef.current.reset();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/conversations/${activeChat}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: text }),
      });

      const data = await res.json();
      setResponse(data?.answer || "No response");
      setMessages(data?.messages || []);
    } catch (err) {
      console.error("Error getting response:", err);
      setResponse("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        handleNewChat={handleNewChat}
        conversations={conversations}
        setConversations={setConversations}
        setMessages={setMessages}
        setName={setName}
        Name={Name}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            <MainContent
              response={response}
              text={text}
              messages={messages}
              loading={loading}
            />

            {/* Input Bar */}
            <div className="border-t border-gray-200 bg-white p-4">
              <div className="max-w-3xl mx-auto flex items-center gap-2">
                <form ref={formRef} onSubmit={get_response} className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
                  <input
                    type="text"
                    placeholder="Ask me anything about cooking..."
                    onChange={(e) => setText(e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="p-1.5 bg-orange-500 hover:bg-orange-600 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                    aria-label="Send message"
                  >
                    <Image src="/arrow-right (1).png" alt="send" width={18} height={18} />
                  </button>
                </form>
                <button
                  onClick={goto_voice}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
                  aria-label="Voice input"
                >
                  <Image src="/microphone.png" alt="voice" width={22} height={22} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🍳</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to KitchenBuddy</h1>
              <p className="text-gray-500 text-sm max-w-sm">Your AI-powered kitchen assistant. Ask about recipes, ingredients, cooking techniques, and more.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleNewChat}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
              >
                Start a Chat
              </button>
              <button
                onClick={goto_voice}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Image src="/microphone.png" alt="voice" width={16} height={16} />
                Voice Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
