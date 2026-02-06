"use client";

import { useLocale } from "@/components/i18n-provider";
import { LOCALE_LABELS, type SupportedLocale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

export function LanguageSwitcher({ variant = "dropdown" }: { variant?: "dropdown" | "compact" }) {
  const { locale, setLocale } = useLocale();
  const { status } = useSession();
  const t = useTranslations("settings");

  const handleChange = async (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;
    await setLocale(newLocale);
    if (status === "authenticated") {
      toast.success(t("languageUpdated") || "Language updated");
    }
  };

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Languages className="h-4 w-4" />
            <span className="sr-only">Language</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px] max-h-[70vh] overflow-y-auto">
          {(Object.keys(LOCALE_LABELS) as SupportedLocale[]).map((l) => (
            <DropdownMenuItem
              key={l}
              onClick={() => handleChange(l)}
              className={l === locale ? "bg-accent" : ""}
            >
              <span className="truncate">{LOCALE_LABELS[l]}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[140px] justify-between">
          <span className="truncate">{LOCALE_LABELS[locale]}</span>
          <Languages className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-[70vh] overflow-y-auto">
        {(Object.keys(LOCALE_LABELS) as SupportedLocale[]).map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => handleChange(l)}
            className={l === locale ? "bg-accent" : ""}
          >
            <span className="truncate">{LOCALE_LABELS[l]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
