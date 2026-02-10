"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredConsent, setStoredConsent, type ConsentLevel } from "@/lib/cookie-consent";

const BANNER_ID = "cookie-consent-banner";

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentLevel>("pending");
  const [manageOpen, setManageOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setConsent(getStoredConsent());
  }, [mounted]);

  const hideBanner = () => {
    const el = document.getElementById(BANNER_ID);
    if (el) el.style.display = "none";
  };

  const handleAccept = () => {
    setStoredConsent("all");
    setConsent("all");
    hideBanner();
  };

  const handleReject = () => {
    setStoredConsent("essential");
    setConsent("essential");
    hideBanner();
  };

  const handleManageSave = (choice: "all" | "essential") => {
    setStoredConsent(choice);
    setConsent(choice);
    setManageOpen(false);
    hideBanner();
  };

  if (!mounted || consent !== "pending") return null;

  return (
    <>
      <div
        id={BANNER_ID}
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur p-4 shadow-lg"
        role="dialog"
        aria-label="Cookie consent"
      >
        <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            We use cookies for essential functionality and, if you agree, to improve the service.{" "}
            <Link href="/cookies" className="text-primary underline underline-offset-4">
              Cookies policy
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              Customize
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReject}>
              Reject non-essential
            </Button>
            <Button size="sm" onClick={handleAccept}>
              Accept all
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Essential cookies are required for login and security. Optional cookies (e.g. analytics) help us improve the product. You can change this later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              <Link href="/cookies" className="text-primary underline" onClick={() => setManageOpen(false)}>
                Full cookies policy
              </Link>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleManageSave("essential")}>
              Essential only
            </Button>
            <Button onClick={() => handleManageSave("all")}>
              Accept all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
