"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (window.opener) {
      // Send the code or error back to the parent window
      window.opener.postMessage(
        {
          type: "whatsapp-embedded-signup",
          code: code || null,
          error: error || null,
          errorDescription: errorDescription || null,
        },
        window.location.origin,
      );

      // Close the popup after sending the message
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      // If there's no opener, redirect back to setup page
      window.location.href = "/admin/setup";
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-muted-foreground">Completing WhatsApp setup...</p>
        <p className="text-xs text-muted-foreground">
          This window will close automatically
        </p>
      </div>
    </div>
  );
}
