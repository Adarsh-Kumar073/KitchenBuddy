import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectMongo from "@/lib/mongodb";
import Conversation from "@/models/Conversations";
import mongoose from "mongoose";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export async function POST(request, { params }) {
  try {
    const { id } = await params; 
    const { query } = await request.json();
    await connectMongo();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      `${query}\n\nAssume you are a cooking specialist. Provide step-by-step cooking instructions with timeline.`
    );

    const answer = result?.response?.text() || "No response from Gemini";

     let convo;

    // ✅ If id is not valid  → create a new conversation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      convo = new Conversation({
        title: query.slice(0, 20) || "New Chat",
        messages: [],
      });
    } else {
      convo = await Conversation.findById(id);
      if (!convo) {
        convo = new Conversation({
          title: query.slice(0, 20) || "New Chat",
          messages: [],
        });
      }
    }
    
    if(convo.title=="New Conversation" || convo.title=="New Chat"){
      convo.title= query.slice(0,20)
    }
    convo.messages.push({ role: "user", text: query });
    convo.messages.push({ role: "bot", text: answer });
    await convo.save();

    return new Response(
      JSON.stringify({ answer, messages: convo.messages }),
      { status: 200 }
    );
  } catch (error) {
    console.log("Error in ask route:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong" }),
      { status: 500 }
    );
  }
}

