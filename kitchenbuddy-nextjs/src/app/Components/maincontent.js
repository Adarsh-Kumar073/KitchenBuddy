"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef } from "react";

export default function MainContent({ response, text, messages, loading }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main
      ref={boxRef}
      className="flex-1 item-center justify-center bg-gray p-6 pb-32 px-4 w-150 overflow-y-auto main_body"
    >
      <div className="space-y-3 w-[100%]">
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`p-3 rounded-lg ${msg.role === "user"
                ? "bg-blue-100 text-blue-800 self-end"
                : "bg-gray-100 text-gray-800 self-start"
              }`}
          >
            <div className="prose max-w-none p-4 bg-white shadow rounded-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.text}
              </ReactMarkdown>
            </div>
            
          </div>
        ))}
        {loading && (
              <div className=" flex items-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-blue-500">Thinking...</span>
              </div>
            )}
      </div>
    </main>
  );
}
