"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/authContext";
import { toast } from "react-toastify";

type WhatsAppStatus = "not_configured" | "connected" | "pending" | "error";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit?: () => void;
  }
}

export default function WhatsAppSetupPage() {
  const { user, loading: authLoading } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<WhatsAppStatus>("not_configured");
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<{
    whatsappBusinessId?: string;
    whatsappPhoneNumberId?: string;
    whatsappVerifiedAt?: string;
  }>({});

  /* ================= LOAD META SDK ================= */

  useEffect(() => {
    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: "1177788247837264", // META APP ID
        cookie: true,
        xfbml: false,
        version: "v24.0",
      });
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      delete window.fbAsyncInit;
    };
  }, []);

  /* ================= LOAD STATUS ================= */

  useEffect(() => {
    if (!user) return;

    async function loadStatus() {
      try {
        const res = await api.get("/vendor/whatsapp");
        setStatus(res.data.whatsappStatus || "not_configured");
        setConfig(res.data);
        setError(res.data.whatsappLastError || null);
      } catch {
        setStatus("not_configured");
      } finally {
        setPageLoading(false);
      }
    }

    loadStatus();
  }, [user]);

  /* ================= EMBEDDED SIGNUP EVENTS ================= */

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      )
        return;

      try {
        const data = JSON.parse(event.data as string);

        if (data.type !== "WA_EMBEDDED_SIGNUP") return;

        if (data.event === "FINISH") {
          api.post("/vendor/whatsapp/embedded/session", {
            wabaId: data.data.waba_id,
            phoneNumberId: data.data.phone_number_id,
          });
        }

        if (data.event === "CANCEL") {
          setSaving(false);
          setError("WhatsApp setup was cancelled");
        }

        if (data.event === "ERROR") {
          setSaving(false);
          setError("WhatsApp setup failed. Please try again.");
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* ================= CONNECT WHATSAPP ================= */

  function connectWhatsApp() {
    if (saving) return;

    setSaving(true);
    setError(null);

    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;

        if (!code) {
          setSaving(false);
          return;
        }

        api
          .post("/vendor/whatsapp/embedded/complete", { code })
          .then(async () => {
            toast.success("WhatsApp connected successfully");
            const res = await api.get("/vendor/whatsapp");
            setConfig(res.data);
            setStatus("connected");
          })
          .catch((err) => {
            setStatus("error");
            setError(
              err.response?.data?.message || "WhatsApp connection failed",
            );
          })
          .finally(() => setSaving(false));
      },
      {
        config_id: "871059392572300", // EMBEDDED SIGNUP CONFIG ID
        response_type: "code",
        override_default_response_type: true,
        extras: {
          version: "v3",
          featureType: "whatsapp_business_app_onboarding",
        },
      },
    );
  }

  /* ================= GUARDS ================= */

  if (authLoading || pageLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  if (!user || user.role !== "vendor_owner") {
    return (
      <div className="p-6 text-destructive">
        You do not have permission to access this page.
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">WhatsApp Business</h1>

      <div>
        {status === "connected" && (
          <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm">
            ✅ Connected
          </span>
        )}
        {status === "error" && (
          <span className="rounded-full bg-destructive/10 text-destructive px-3 py-1 text-sm">
            ❌ Error
          </span>
        )}
        {status === "not_configured" && (
          <span className="rounded-full bg-muted text-muted-foreground px-3 py-1 text-sm">
            Not connected
          </span>
        )}
      </div>

      {status !== "connected" && (
        <div className="border rounded-lg p-5 space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
              {error}
            </div>
          )}

          <button
            onClick={connectWhatsApp}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 font-medium disabled:opacity-50"
          >
            {saving ? "Connecting…" : "Connect WhatsApp"}
          </button>
        </div>
      )}

      {status === "connected" && (
        <div className="border rounded-lg p-5 space-y-2">
          <div>Business ID: {config.whatsappBusinessId}</div>
          <div>Phone Number ID: {config.whatsappPhoneNumberId}</div>
          {config.whatsappVerifiedAt && (
            <div>
              Connected on:{" "}
              {new Date(config.whatsappVerifiedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
