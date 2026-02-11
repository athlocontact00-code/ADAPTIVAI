import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { del, put } from "@vercel/blob";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import {
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_ALLOWED_TYPES,
} from "@/lib/types/profile";

const UPLOAD_DIR = "public/uploads/avatars";
const BLOB_PREFIX = "adaptivai/avatars";

function isManagedBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const pathname = u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
    return pathname.startsWith(`${BLOB_PREFIX}/`);
  } catch {
    return false;
  }
}

function sanitizeFilename(userId: string, mimeType: string): string {
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const safe = userId.replace(/[^a-zA-Z0-9-_]/g, "_");
  // Unique per upload to avoid aggressive browser/CDN caching for public assets.
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${safe}-${stamp}-${rand}.${ext}`;
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

    // Best-effort: remove the previous avatar file to avoid orphaned uploads.
    const existing = await db.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    const filename = sanitizeFilename(session.user.id, file.type);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    let avatarUrl: string;

    if (token) {
      // Vercel Blob storage (recommended for production on Vercel)
      if (existing?.image && isManagedBlobUrl(existing.image)) {
        try {
          await del(existing.image, { token });
        } catch {
          // ignore
        }
      }

      const blobPath = `${BLOB_PREFIX}/${session.user.id}/${filename}`;
      const blob = await put(blobPath, buffer, {
        access: "public",
        contentType: file.type,
        token,
      });
      avatarUrl = blob.url;
    } else {
      // Local filesystem fallback (works in local dev / traditional servers)
      if (existing?.image?.startsWith("/uploads/avatars/")) {
        const rawName = existing.image.replace("/uploads/avatars/", "");
        const filenameToDelete = rawName.split("?")[0] || rawName;
        const toDelete = path.join(process.cwd(), UPLOAD_DIR, filenameToDelete);
        try {
          await unlink(toDelete);
        } catch {
          // ignore
        }
      }

      const dir = path.join(process.cwd(), UPLOAD_DIR);
      await mkdir(dir, { recursive: true });
      const filepath = path.join(dir, filename);
      await writeFile(filepath, buffer);

      avatarUrl = `/uploads/avatars/${filename}`;
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { image: avatarUrl },
    });

    return NextResponse.json(
      { avatarUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Avatar upload error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (
      !process.env.BLOB_READ_WRITE_TOKEN &&
      process.env.NODE_ENV === "production" &&
      (msg.includes("EROFS") || msg.toLowerCase().includes("read-only"))
    ) {
      return NextResponse.json(
        { error: "Avatar uploads require BLOB_READ_WRITE_TOKEN (Vercel Blob) in production." },
        { status: 500 }
      );
    }
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

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (user?.image) {
      if (token && isManagedBlobUrl(user.image)) {
        try {
          await del(user.image, { token });
        } catch {
          // ignore
        }
      } else if (user.image.startsWith("/uploads/avatars/")) {
        const filename = user.image.replace("/uploads/avatars/", "");
        const filenameClean = filename.split("?")[0] || filename;
        const filepath = path.join(process.cwd(), UPLOAD_DIR, filenameClean);
        try {
          await unlink(filepath);
        } catch {
          // File may not exist; ignore
        }
      }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { image: null },
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Avatar remove error:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}
