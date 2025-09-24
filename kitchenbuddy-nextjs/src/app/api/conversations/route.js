import connectMongo from "@/lib/mongodb";
import Conversation from "@/models/Conversations";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function GET(req) {
  try {
    await connectMongo();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const conversations = await Conversation.find({ userId: user.id }).lean();
    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
