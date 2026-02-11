"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Apple, Chrome, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [providers, setProviders] = useState<
    Record<string, { id: string; name: string; type: string }> | null
  >(null);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "apple">(null);

  useEffect(() => {
    void getProviders()
      .then((p) => setProviders(p))
      .catch(() => setProviders(null));
  }, []);

  const hasOAuth = Boolean(providers?.google || providers?.apple);

  async function onOAuth(providerId: "google" | "apple") {
    setOauthLoading(providerId);
    try {
      await signIn(providerId, { callbackUrl });
    } catch {
      toast.error(t("somethingWrong"));
      setOauthLoading(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("registrationFailed"));
        setIsLoading(false);
        return;
      }

      toast.success(t("accountCreated"));
      router.push("/login");
    } catch {
      toast.error(t("somethingWrong"));
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo variant="lockup" size={36} className="h-9" />
          </div>
          <CardTitle>{t("createAccountTitle")}</CardTitle>
          <CardDescription>{t("createAccountDesc")}</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {hasOAuth && (
              <div className="space-y-3">
                {providers?.google && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isLoading || oauthLoading !== null}
                    onClick={() => onOAuth("google")}
                  >
                    {oauthLoading === "google" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Continue with Google
                      </>
                    ) : (
                      <>
                        <Chrome className="mr-2 h-4 w-4" />
                        Continue with Google
                      </>
                    )}
                  </Button>
                )}
                {providers?.apple && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isLoading || oauthLoading !== null}
                    onClick={() => onOAuth("apple")}
                  >
                    {oauthLoading === "apple" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Continue with Apple
                      </>
                    ) : (
                      <>
                        <Apple className="mr-2 h-4 w-4" />
                        Continue with Apple
                      </>
                    )}
                  </Button>
                )}

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("creatingAccount")}
                </>
              ) : (
                t("createAccount")
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              {t("hasAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("signIn")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
