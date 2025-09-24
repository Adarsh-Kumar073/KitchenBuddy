"use client";
import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Sidebar({
  isOpen, setIsOpen,
  activeChat, setActiveChat,
  handleNewChat, conversations, setConversations, setMessages, setName, Name
}) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signup"); // redirect if not logged in
      return;
    }

    fetch("/api/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setConversations(data))
      .catch(err => console.error("Error fetching conversations:", err));
  }, [setConversations, router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/signup");
  };
  


  return (
    <aside className={`bg-black text-white flex flex-col h-screen transition-all duration-300
      ${isOpen ? "w-64" : "w-16"}`}>

      {/* Header */}
      <nav className="overflow-y-auto p-2 space-y-2 flex">
        <div className="p-4 border-b border-gray-700 flex items-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="absolute top-4 left-4 z-20 text-white px-3 py-1 rounded-md hover:bg-gray-700"
          >
            <Image src="/sidebar.png" alt="sidebar icon" width={24} height={24} />
          </button>

          <div className="mt-8 w-64 font-sans rounded-md px-2 py-2 text-sm font-medium hover:bg-gray-700 flex">
            <Image src="/icons8-chat-50.png" alt="chat icon" width={24} height={24} />
            <button
              onClick={handleNewChat}
              className="ml-1 font-sans rounded px-2 cursor-pointer text-sm font-medium hover:bg-gray-700"
            >
              {isOpen ? "New Chat" : ""}
            </button>
          </div>
        </div>
      </nav>

      {/* Chat List */}
      {isOpen && (
        <nav className="flex-1 overflow-y-auto p-2 space-y-2">
          {conversations.map(convo => (
            <div
              key={convo._id}
              className={`flex justify-between items-center p-2 rounded cursor-pointer
                ${activeChat === convo._id ? "bg-gray-700 font-semibold" : "hover:bg-gray-700"}`}
            >
              <span
                onClick={() => setActiveChat(convo._id)}
                className="flex-1 truncate cursor-pointer"
              >
                {convo.title || "Untitled Chat"}
              </span>
              <button
                aria-label="Delete conversation"
                onClick={async () => {
                  if (!confirm("Are you sure you want to delete this conversation?")) return;
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
                className="text-red-500 cursor-pointer hover:text-red-700 ml-2"
              >
                ❌
              </button>
            </div>
          ))}
        </nav>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 mt-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gray-600 rounded-full" />
          {isOpen && <span className="text-sm">{Name}</span>}
        </div>
        
        {isOpen && (
            <button
              onClick={handleLogout}
              className="mt-2 w-full bg-red-600 text-white text-sm py-1 rounded hover:bg-red-500 cursor-pointer relative z-10"
            >
              Logout
            </button>
        )}
      </div>
    </aside>
  );
}
