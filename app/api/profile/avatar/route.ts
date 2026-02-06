import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import {
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_ALLOWED_TYPES,
} from "@/lib/types/profile";

const UPLOAD_DIR = "public/uploads/avatars";

function sanitizeFilename(userId: string, mimeType: string): string {
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const safe = userId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe}.${ext}`;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use jpg, png or webp." },
        { status: 400 }
      );
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      );
    }

    const dir = path.join(process.cwd(), UPLOAD_DIR);
    await mkdir(dir, { recursive: true });

    const filename = sanitizeFilename(session.user.id, file.type);
    const filepath = path.join(dir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;

    await db.user.update({
      where: { id: session.user.id },
      data: { image: avatarUrl },
    });

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    if (user?.image?.startsWith("/uploads/avatars/")) {
      const filename = user.image.replace("/uploads/avatars/", "");
      const filepath = path.join(process.cwd(), UPLOAD_DIR, filename);
      try {
        await unlink(filepath);
      } catch {
        // File may not exist; ignore
      }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { image: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Avatar remove error:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}
