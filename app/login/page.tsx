import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-headline-md font-bold text-on-surface">Gofer Outreach</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            B2B Growth — Internal Sales Tool
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-body-sm text-on-surface-variant">Loading...</p>}>
              <AuthForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
