"use client"
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Components/sidebar";
import MainContent from "./Components/maincontent";
import Image from "next/image";
import jwt from "jsonwebtoken";

const GUEST_LIMIT = 5;

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

  // Guest mode
  const [isGuest, setIsGuest] = useState(false);
  const [guestPromptsUsed, setGuestPromptsUsed] = useState(0);
  const [guestConvoId, setGuestConvoId] = useState(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // ✅ Check login
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwt.decode(token);
      setName(decoded?.email || "User");
      setCurrentUser(true);
    } else {
      // Guest mode — allow 5 free prompts, no redirect
      setIsGuest(true);
      setCurrentUser(true);
      setActiveChat("guest");

      const used = parseInt(localStorage.getItem("guestPromptsUsed") || "0");
      setGuestPromptsUsed(used);

      const storedConvoId = localStorage.getItem("guestConvoId");
      if (storedConvoId) {
        setGuestConvoId(storedConvoId);
        setActiveChat(storedConvoId);
      }
    }
  }, []);

  const goto_voice = () => router.push("/voiceInput");

  // ✅ Fetch conversations for logged-in users
  useEffect(() => {
    if (!currentUser || isGuest) return;

    const fetchConvos = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        setConversations(data);
        if (data.length > 0) setActiveChat(data[0]._id);
      } catch (err) {
        console.error("Error fetching conversations:", err);
      }
    };

    fetchConvos();
  }, [currentUser, isGuest]);

  // Fetch messages when switching conversations (logged-in users only)
  useEffect(() => {
    if (!activeChat || isGuest) return;

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
  }, [activeChat, isGuest]);

  // ✅ Create a new chat (logged-in users only)
  const handleNewChat = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

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

  // ✅ Send message
  const get_response = async (e) => {
    e.preventDefault();
    formRef.current.reset();

    // Block guests who've hit the limit
    if (isGuest && guestPromptsUsed >= GUEST_LIMIT) {
      setShowSignupModal(true);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const convoId = isGuest ? (guestConvoId || "guest") : activeChat;

      const res = await fetch(`/api/conversations/${convoId}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ query: text }),
      });

      const data = await res.json();
      setResponse(data?.answer || "No response");
      setMessages(data?.messages || []);

      // For guests: save conversation ID and increment counter
      if (isGuest && data.conversationId) {
        const newConvoId = String(data.conversationId);
        setGuestConvoId(newConvoId);
        setActiveChat(newConvoId);
        localStorage.setItem("guestConvoId", newConvoId);

        const newCount = guestPromptsUsed + 1;
        setGuestPromptsUsed(newCount);
        localStorage.setItem("guestPromptsUsed", newCount.toString());

        if (newCount >= GUEST_LIMIT) {
          setShowSignupModal(true);
        }
      }
    } catch (err) {
      console.error("Error getting response:", err);
      setResponse("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  const promptsLeft = GUEST_LIMIT - guestPromptsUsed;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile backdrop — tap to close sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
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
        isGuest={isGuest}
        onShowSignup={() => setShowSignupModal(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
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
              {/* Guest banner */}
              {isGuest && (
                <div className="max-w-3xl mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2">
                  <p className="text-xs text-orange-700">
                    <span className="font-semibold">{promptsLeft > 0 ? promptsLeft : 0}</span> free message{promptsLeft !== 1 ? "s" : ""} remaining
                  </p>
                  <div className="flex gap-2">
                    <a href="/login" className="text-xs text-orange-600 hover:underline font-medium">Log in</a>
                    <span className="text-orange-300">·</span>
                    <a href="/signup" className="text-xs text-orange-600 hover:underline font-medium">Sign up free</a>
                  </div>
                </div>
              )}

              <div className="max-w-3xl mx-auto flex items-center gap-2">
                <form ref={formRef} onSubmit={get_response} className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
                  <input
                    type="text"
                    placeholder="Ask me anything about cooking..."
                    onChange={(e) => setText(e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400"
                    required
                    disabled={isGuest && guestPromptsUsed >= GUEST_LIMIT}
                  />
                  <button
                    type="submit"
                    disabled={loading || (isGuest && guestPromptsUsed >= GUEST_LIMIT)}
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

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="text-4xl mb-3">🍳</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">You&apos;ve used your 5 free messages</h2>
            <p className="text-sm text-gray-500 mb-6">Create a free account to get unlimited access, save your conversations, and more.</p>
            <div className="flex flex-col gap-3">
              <a
                href="/signup"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                Create free account
              </a>
              <a
                href="/login"
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                Log in
              </a>
            </div>
            <button
              onClick={() => setShowSignupModal(false)}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
