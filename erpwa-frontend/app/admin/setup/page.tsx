"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/authContext";
import { toast } from "react-toastify";

type WhatsAppStatus = "not_configured" | "connected" | "error";
type SetupMethod = "embedded" | "manual";

export default function WhatsAppSetupPage() {
  const { user, loading: authLoading } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<WhatsAppStatus>("not_configured");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupMethod, setSetupMethod] = useState<SetupMethod>("embedded");

  const [config, setConfig] = useState<{
    whatsappBusinessId?: string;
    whatsappPhoneNumberId?: string;
    whatsappVerifiedAt?: string;
  }>({});

  const [form, setForm] = useState({
    whatsappBusinessId: "",
    whatsappPhoneNumberId: "",
    whatsappAccessToken: "",
  });

  const [embeddedSession, setEmbeddedSession] = useState<{
    whatsappBusinessId: string;
    whatsappPhoneNumberId: string;
  } | null>(null);

  /* ================= CONFIRM TOAST ================= */

  function showConfirmToast(options: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) {
    toast(
      ({ closeToast }) => (
        <div className="space-y-2">
          <p className="font-medium">{options.title}</p>
          <p className="text-sm text-muted-foreground">{options.message}</p>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                options.onConfirm();
                closeToast();
              }}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm"
            >
              {options.confirmLabel}
            </button>

            <button
              onClick={closeToast}
              className="border border-border px-3 py-1.5 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { autoClose: false, closeOnClick: false },
    );
  }

  useEffect(() => {
    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID!,
        xfbml: false,
        version: "v24.0",
      });
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      const payload =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;

      if (!payload) return;

      if (payload.type === "WA_EMBEDDED_SIGNUP") {
        console.log("📩 WA_EMBEDDED_SIGNUP:", payload);

        if (payload.event === "FINISH") {
          setEmbeddedSession({
            whatsappBusinessId: payload.data.waba_id,
            whatsappPhoneNumberId: payload.data.phone_number_id,
          });
        }

        if (payload.event === "ERROR") {
          console.error("❌ Embedded signup error:", payload.data);
        }

        if (payload.event === "CANCEL") {
          console.warn("⚠️ Embedded signup cancelled:", payload.data);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  /* ================= LOAD STATUS ================= */

  useEffect(() => {
    if (!user) return;

    async function loadStatus() {
      try {
        const res = await api.get("/vendor/whatsapp");
        setStatus(res.data.whatsappStatus);
        setError(res.data.whatsappLastError);
        setConfig(res.data);
      } catch {
        setStatus("not_configured");
      } finally {
        setPageLoading(false);
      }
    }

    loadStatus();
  }, [user]);

  /* ================= PREFILL FORM ON EDIT ================= */
  useEffect(() => {
    if (!config.whatsappBusinessId || !config.whatsappPhoneNumberId) return;

    setForm((prev) => ({
      ...prev,
      whatsappBusinessId: config.whatsappBusinessId!,
      whatsappPhoneNumberId: config.whatsappPhoneNumberId!,
      whatsappAccessToken: "", // never prefill token
    }));
  }, [config.whatsappBusinessId, config.whatsappPhoneNumberId]);

  /* ================= SUBMIT ================= */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.post("/vendor/whatsapp/setup", form);
      const res = await api.get("/vendor/whatsapp");

      setConfig(res.data);
      setStatus("connected");
      setIsEditing(false);

      setForm({
        whatsappBusinessId: "",
        whatsappPhoneNumberId: "",
        whatsappAccessToken: "",
      });

      toast.success("WhatsApp configuration updated successfully");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setStatus("error");
      setError(error.response?.data?.message || "Setup failed");
    } finally {
      setSaving(false);
    }
  }

  /* ================= EMBEDDED SIGNUP ================= */

  function handleEmbeddedSignup() {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded");
      return;
    }

    setSaving(true);
    setError(null);

    window.FB.login(
      (response: any) => {
        if (!response.authResponse) {
          setSaving(false);
          toast.error("Signup cancelled");
          return;
        }

        const code = response.authResponse.code;

        // ⏳ wait for WA_EMBEDDED_SIGNUP
        const waitForSession = async () => {
          for (let i = 0; i < 10; i++) {
            if (embeddedSession) return embeddedSession;
            await new Promise((r) => setTimeout(r, 300));
          }
          return null;
        };

        (async () => {
          const session = await waitForSession();

          if (!session) {
            setSaving(false);
            setError("Failed to receive WhatsApp account details from Meta");
            return;
          }

          try {
            await api.post("/vendor/whatsapp/embedded-setup", {
              code,
              whatsappBusinessId: session.whatsappBusinessId,
              whatsappPhoneNumberId: session.whatsappPhoneNumberId,
            });

            const res = await api.get("/vendor/whatsapp");
            setConfig(res.data);
            setStatus("connected");
            toast.success("WhatsApp connected successfully");
          } catch (err: any) {
            setStatus("error");
            setError(err.response?.data?.message || "Embedded signup failed");
          } finally {
            setSaving(false);
          }
        })();
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID!,
        response_type: "code",
        override_default_response_type: true,
        extras: { version: "v3" },
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp Business</h1>
        <p className="text-sm text-muted-foreground">
          Manage your WhatsApp Business integration.
        </p>
      </div>

      {/* Status */}
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
            Not configured
          </span>
        )}
      </div>

      {/* ================= CONNECTED VIEW ================= */}
      {status === "connected" && !isEditing && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="font-medium text-primary">
            WhatsApp is currently connected
          </p>

          <div className="text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Business ID:</span>{" "}
              {config.whatsappBusinessId}
            </div>
            <div>
              <span className="text-muted-foreground">Phone Number ID:</span>{" "}
              {config.whatsappPhoneNumberId}
            </div>
            {config.whatsappVerifiedAt && (
              <div>
                <span className="text-muted-foreground">Connected on:</span>{" "}
                {new Date(config.whatsappVerifiedAt).toLocaleString()}
              </div>
            )}
          </div>

          <button
            onClick={() =>
              showConfirmToast({
                title: "Edit WhatsApp configuration?",
                message:
                  "Reconfiguring will replace the existing connection and may interrupt message delivery.",
                confirmLabel: "Yes, edit",
                onConfirm: () => setIsEditing(true),
              })
            }
            className="border border-border rounded-md px-4 py-2 text-sm hover:bg-muted"
          >
            Reconfigure
          </button>
        </div>
      )}

      {/* ================= SETUP METHOD SELECTION ================= */}
      {(status !== "connected" || isEditing) && (
        <div className="space-y-4">
          {/* Setup Method Tabs */}
          <div className="bg-card border border-border rounded-lg p-1 flex gap-1">
            <button
              onClick={() => setSetupMethod("embedded")}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                setupMethod === "embedded"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>🚀</span>
                <span>Embedded Signup</span>
                <span className="text-xs opacity-75">(Recommended)</span>
              </div>
            </button>
            <button
              onClick={() => setSetupMethod("manual")}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                setupMethod === "manual"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>⚙️</span>
                <span>Manual Setup</span>
              </div>
            </button>
          </div>

          {/* ================= EMBEDDED SIGNUP ================= */}
          {setupMethod === "embedded" && (
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Quick Setup with Meta</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your WhatsApp Business account in just a few clicks
                  using Meta&apos;s secure OAuth flow.
                </p>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">✨ Benefits:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• No need to manually copy credentials</li>
                  <li>• Secure OAuth authentication</li>
                  <li>• Automatic token management</li>
                  <li>• Faster setup process</li>
                </ul>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                  {error}
                </div>
              )}

              <button
                onClick={handleEmbeddedSignup}
                disabled={saving}
                className="w-full bg-primary text-primary-foreground rounded-md py-3 font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>🔗</span>
                    <span>Connect with Meta</span>
                  </>
                )}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                You&apos;ll be redirected to Meta to authorize the connection
              </p>
            </div>
          )}

          {/* ================= MANUAL SETUP FORM ================= */}
          {setupMethod === "manual" && (
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-lg p-6 space-y-4"
            >
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Manual Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your WhatsApp Business credentials manually from Meta
                  Business Manager.
                </p>
              </div>

              {isEditing && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ Existing values are pre-filled. Access token must be
                    re-entered for security.
                  </p>
                </div>
              )}

              {/* Business ID */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  WhatsApp Business Account ID
                </label>
                <p className="text-xs text-muted-foreground">
                  Found in Meta Business Manager → WhatsApp Accounts
                </p>
                <input
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.whatsappBusinessId}
                  onChange={(e) =>
                    setForm({ ...form, whatsappBusinessId: e.target.value })
                  }
                  placeholder="123456789012345"
                  required
                />
              </div>

              {/* Phone Number ID */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone Number ID</label>
                <p className="text-xs text-muted-foreground">
                  Your WhatsApp phone number identifier from Meta
                </p>
                <input
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.whatsappPhoneNumberId}
                  onChange={(e) =>
                    setForm({ ...form, whatsappPhoneNumberId: e.target.value })
                  }
                  placeholder="987654321098765"
                  required
                />
              </div>

              {/* Access Token */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Access Token</label>
                <p className="text-xs text-muted-foreground">
                  Permanent token with WhatsApp permissions (stored securely
                  encrypted)
                </p>
                <textarea
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  value={form.whatsappAccessToken}
                  onChange={(e) =>
                    setForm({ ...form, whatsappAccessToken: e.target.value })
                  }
                  rows={4}
                  placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxx..."
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                  {error}
                </div>
              )}

              <button
                disabled={saving}
                className="w-full bg-primary text-primary-foreground rounded-md py-3 font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {saving ? "Verifying…" : "Verify & Save"}
              </button>

              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Need help?</strong> Follow our{" "}
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    setup guide
                  </a>{" "}
                  to get your credentials from Meta Business Manager.
                </p>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
