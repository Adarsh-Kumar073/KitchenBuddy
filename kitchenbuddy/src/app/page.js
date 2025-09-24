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
    if(token){
      const decoded = jwt.decode(token);
      console.log("Token:", decoded?.email);
      setName(decoded?.email || "User");
    }
    

    if (!token && !visited) {
      localStorage.setItem("hasVisited", "true");

      router.push("/signup");
    }
    else{
      setCurrentUser(true);
    }
  }, []);


  const goto_voice = () => {
    router.push("/voiceInput");
  }

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
          Authorization: `Bearer ${token}`, // ✅ include token
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
    <div className="flex h-screen">
      <Sidebar
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        handleNewChat={handleNewChat}
        conversations={conversations}
        setConversations={setConversations}
        setMessages={setMessages}
        setName= {setName}
        Name={Name}
      />


      {activeChat ? (
        <MainContent
          response={response}
          text={text}
          messages={messages}
          loading={loading}
        />

      ) : (
        <div className="flex items-center justify-center h-full">
          <div className=" item-center justify-center text-lg pl-[30vw]">
          </div>
        </div>
      )}



      {activeChat ? (
        // Input box
        <div className="mt-4 fixed bottom-0 px-68  h-[20%]  w-[100%] py-10">
        <div className="flex w-[100%] ">
          <form ref={formRef} onSubmit={get_response} className="flex border rounded-full w-full">
            <div className="w-[100%] ">
              <input
                type="text"
                placeholder="Type your message..."
                onChange={(e) => setText(e.target.value)}
                className="text-lg overflow-x w-full border-none focus:outline-none focus:ring-0 py-1 px-2 "
                required
              />
            </div>
            <button type="submit" className="text-white px-4 rounded-r float-right cursor-pointer">
              <Image src="/arrow-right (1).png" alt="arrow icon" width={30} height={30} />
            </button>
          </form>
          <button className="cursor-pointer" onClick={goto_voice}>
            <Image src="/microphone.png" alt="microphone icon" width={50} height={40} />
          </button>
        </div>
      </div>

      ) : (
        <div className="flex items-center justify-center h-full">
          <div className=" item-center medium font-mono justify-center text-lg ">
            Click here to start new <button onClick={handleNewChat} className="text-blue-500 underline font-bold  cursor-pointer">chat</button> /  <button onClick={goto_voice} className="text-blue-500 underline font-bold cursor-pointer">voicechat</button> 
          </div>
        </div>
      )}

    </div>
  );
}

