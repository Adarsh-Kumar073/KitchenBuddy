import connectMongo from "@/lib/mongodb";
import Conversation from "@/models/Conversations";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

async function getUser(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  return verifyToken(token);
}

export async function GET(req, { params }) {
  try {
    await connectMongo();
    const {id} = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.log("Fetching conversation for user:", user.id, "with id:", id);

    const convo = await Conversation.findOne({ _id: id, userId: user.id }).lean();
    if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json(convo);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectMongo();
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const {id} = await params;

    const deleted = await Conversation.findOneAndDelete({ _id: id, userId: user.id }).lean();
    if (!deleted) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json({ message: "Conversation deleted" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectMongo();
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title } = await req.json();
    const updated = await Conversation.findOneAndUpdate(
      { _id: params.id, userId: user.username },
      { title },
      { new: true }
    ).lean();

    if (!updated) return NextResponse.json({ error: "Title not updated" }, { status: 404 });

    return NextResponse.json({ message: "Title updated", conversation: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update title" }, { status: 500 });
  }
}
