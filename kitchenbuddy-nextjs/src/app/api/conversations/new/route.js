import connectMongo from "@/lib/mongodb";
import Conversation from "@/models/Conversations";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    await connectMongo();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);
    console.log("Decoded user:", user);

    if (!user || !user.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const conversation = await Conversation.create({
      userId: user.id, // ✅ must match your schema type
      title: "New Conversation",
      messages: [],
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
