"use client";
import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Sidebar({
  isOpen, setIsOpen,
  activeChat, setActiveChat,
  handleNewChat, conversations, setConversations, setMessages, setName, Name,
  isGuest, onShowSignup
}) {
  const router = useRouter();

  useEffect(() => {
    if (isGuest) return; // guests don't fetch conversations

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signup");
      return;
    }

    fetch("/api/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setConversations(data))
      .catch(err => console.error("Error fetching conversations:", err));
  }, [setConversations, router, isGuest]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/signup");
  };

  return (
    <aside className={`bg-gray-900 text-white flex flex-col h-screen transition-all duration-300 flex-shrink-0
      ${isOpen
        ? "w-64 fixed inset-y-0 left-0 z-40 md:relative md:inset-auto"
        : "w-0 overflow-hidden md:w-16 md:overflow-visible"
      }`}>

      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Image src="/sidebar.png" alt="sidebar icon" width={20} height={20} />
        </button>
        {isOpen && (
          <>
            <span className="font-semibold text-orange-400 truncate">KitchenBuddy</span>
            {!isGuest && (
              <button
                onClick={handleNewChat}
                className="ml-auto p-2 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
                aria-label="New chat"
              >
                <Image src="/icons8-chat-50.png" alt="new chat" width={20} height={20} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Chat List / Guest prompt */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {isGuest ? (
          isOpen && (
            <div className="px-3 py-4 text-center">
              <div className="text-2xl mb-2">🍳</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                You&apos;re using KitchenBuddy as a guest. Sign up for unlimited access and saved conversations.
              </p>
              <button
                onClick={onShowSignup}
                className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white text-xs py-2 px-3 rounded-lg transition-colors cursor-pointer"
              >
                Sign up — it&apos;s free
              </button>
            </div>
          )
        ) : (
          <>
            {isOpen ? conversations.map(convo => (
              <div
                key={convo._id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${activeChat === convo._id ? "bg-gray-700" : "hover:bg-gray-800"}`}
              >
                <span
                  onClick={() => setActiveChat(convo._id)}
                  className="flex-1 truncate text-sm text-gray-200"
                >
                  {convo.title || "Untitled Chat"}
                </span>
                <button
                  aria-label="Delete conversation"
                  onClick={async () => {
                    if (!confirm("Delete this conversation?")) return;
                    try {
                      const token = localStorage.getItem("token");
                      const res = await fetch(`/api/conversations/${convo._id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) {
                        setConversations(prev => prev.filter(c => c._id !== convo._id));
                        if (activeChat === convo._id) {
                          setActiveChat(null);
                          setMessages([]);
                        }
                      }
                    } catch (err) {
                      console.error("Error deleting conversation:", err);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-400 transition-all flex-shrink-0 ml-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            )) : null}

            {!isOpen && (
              <button
                onClick={handleNewChat}
                className="w-full flex justify-center p-2 rounded-lg hover:bg-gray-800 transition-colors mt-1"
                aria-label="New chat"
              >
                <Image src="/icons8-chat-50.png" alt="new chat" width={20} height={20} />
              </button>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800">
        {isGuest ? (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              G
            </div>
            {isOpen && <p className="text-xs text-gray-500 truncate flex-1">Guest</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {Name ? Name[0].toUpperCase() : "U"}
              </div>
              {isOpen && (
                <p className="text-xs text-gray-400 truncate flex-1">{Name}</p>
              )}
            </div>
            {isOpen && (
              <button
                onClick={handleLogout}
                className="mt-3 w-full bg-gray-800 hover:bg-red-900 text-gray-300 hover:text-red-300 text-sm py-2 px-3 rounded-lg transition-colors cursor-pointer text-left"
              >
                Sign out
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
