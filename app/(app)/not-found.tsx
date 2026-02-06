import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Page not found</h2>
            <p className="text-sm text-muted-foreground">
              The page you’re looking for doesn’t exist or was moved.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
