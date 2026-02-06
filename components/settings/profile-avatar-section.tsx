"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AVATAR_MAX_SIZE_BYTES, AVATAR_ALLOWED_TYPES } from "@/lib/types/profile";

const MAX_MB = 5;
const ALLOWED_EXT = "jpg, png, webp";

interface ProfileAvatarSectionProps {
  avatarUrl: string | null;
  userName: string | null;
  onAvatarChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function ProfileAvatarSection({
  avatarUrl,
  userName,
  onAvatarChange,
  disabled,
  className,
}: ProfileAvatarSectionProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setError(`Invalid type. Use ${ALLOWED_EXT}.`);
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setError(`Max ${MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as { avatarUrl?: string; error?: string };
      if (!res.ok) {
        setError(data?.error ?? "Upload failed");
        return;
      }
      if (data.avatarUrl) {
        onAvatarChange(data.avatarUrl);
        router.refresh();
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setRemoving(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove");
        return;
      }
      onAvatarChange(null);
      router.refresh();
    } catch {
      setError("Failed to remove");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-4 sm:flex-row sm:items-center", className)}>
      <Avatar className="h-24 w-24 shrink-0 rounded-full border-2 border-white/10">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="bg-primary/20 text-primary text-xl">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
            disabled={disabled || uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            Upload
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || removing || !avatarUrl}
            onClick={handleRemove}
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Remove
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Max {MAX_MB}MB, {ALLOWED_EXT}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
