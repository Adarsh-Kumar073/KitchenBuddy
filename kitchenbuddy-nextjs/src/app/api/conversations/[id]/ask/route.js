import Groq from "groq-sdk";
import connectMongo from "@/lib/mongodb";
import Conversation from "@/models/Conversations";
import mongoose from "mongoose";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { query } = await request.json();
    await connectMongo();

    const result = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: "You are a cooking specialist. Provide step-by-step cooking instructions with timeline.",
        },
        {
          role: "user",
          content: query,
        },
      ],
    });

    const answer = result.choices[0]?.message?.content || "No response";

    let convo;

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

    if (convo.title == "New Conversation" || convo.title == "New Chat") {
      convo.title = query.slice(0, 20);
    }
    convo.messages.push({ role: "user", text: query });
    convo.messages.push({ role: "bot", text: answer });
    await convo.save();

    return new Response(
      JSON.stringify({ answer, messages: convo.messages, conversationId: convo._id }),
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
