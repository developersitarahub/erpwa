"use client";

import { useState, useEffect } from "react";
import {
  X,
  Save,
  Code,
  Eye,
  Workflow,
  Trash2,
  Smartphone,
  Battery,
  Wifi,
  Signal,
  ChevronLeft,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/button";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { toast } from "react-toastify";

interface FlowEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  flow: any | null;
  onSave: () => void;
}

const SAMPLE_FLOW_JSON = {
  version: "6.0",
  data_api_version: "3.0",
  routing_model: {
    START: [],
  },
  screens: [
    {
      id: "START",
      title: "Start Screen",
      data: {},
      terminal: false,
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextHeading", text: "Welcome" },
          {
            type: "Footer",
            label: "Continue",
            "on-click-action": {
              name: "complete",
              payload: {},
            },
          },
        ],
      },
    },
  ],
};

const CATEGORIES = [
  { value: "LEAD_GENERATION", label: "Lead Generation" },
  { value: "APPOINTMENT_BOOKING", label: "Appointment Booking" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "SIGN_IN", label: "Sign In" },
  { value: "CUSTOMER_SUPPORT", label: "Customer Support" },
  { value: "OTHER", label: "Other" },
];

export default function FlowEditorModal({
  isOpen,
  onClose,
  flow,
  onSave,
}: FlowEditorModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "LEAD_GENERATION",
    flowJson: JSON.stringify(SAMPLE_FLOW_JSON, null, 2),
    endpointUri: "",
  });
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState("");

  // Helper: Parse JSON back to Screens for Visual Builder
  const parseJSONToScreens = (json: any): FlowScreen[] => {
    if (!json.screens) return screens; // Fallback to default if invalid

    return json.screens.map((s: any) => ({
      id: s.id,
      title: s.title,
      terminal: s.terminal || false,
      children: parseChildrenToComponents(
        s.layout?.children || [],
        json.routing_model,
        s.id,
      ),
    }));
  };

  const parseChildrenToComponents = (
    children: any[],
    routingModel: any = {},
    currentScreenId: string = "",
  ): FlowComponent[] => {
    return children
      .map((child: any, index: number) => {
        const baseId = `c_${Date.now()}_${index}`;
        let type: FlowComponentType = "TextBody"; // Default fallback
        let data: any = {};

        if (child.type === "TextHeading") {
          type = "TextHeading";
          data = { text: child.text };
        } else if (child.type === "TextBody") {
          type = "TextBody";
          data = { text: child.text };
        } else if (child.type === "TextInput") {
          type = "TextInput";
          data = {
            label: child.label,
            name: child.name,
            required: child.required,
            inputType: child["input-type"],
          };
        } else if (child.type === "Dropdown") {
          type = "Dropdown";
          data = {
            label: child.label,
            name: child.name,
            required: child.required,
            options: child["data-source"],
          };
        } else if (child.type === "RadioButtons") {
          type = "RadioButtons";
          data = {
            label: child.label,
            name: child.name,
            required: child.required,
            options: child["data-source"],
          };
        } else if (child.type === "CheckboxGroup") {
          type = "CheckboxGroup";
          data = {
            label: child.label,
            name: child.name,
            required: child.required,
            options: child["data-source"],
          };
        } else if (child.type === "DatePicker") {
          type = "DatePicker";
          data = {
            label: child.label,
            name: child.name,
            required: child.required,
          };
        } else if (child.type === "Footer") {
          type = "Footer";
          data = { label: child.label };
          if (child["on-click-action"]) {
            const action = child["on-click-action"];
            if (action.name === "complete") {
              data.actionType = "complete";
              data.nextScreenId = "";
            } else if (action.name === "data_exchange") {
              data.actionType = "data_exchange";
              // Recover target from routing model
              // routing_model[currentScreenId] should be array [nextScreenId]
              const routes = routingModel[currentScreenId];
              if (routes && routes.length > 0) {
                data.nextScreenId = routes[0];
              } else {
                data.nextScreenId = "";
              }
            } else if (action.name === "navigate") {
              data.actionType = "navigate";
              data.nextScreenId = action.next?.name;
            }
          } else {
            // Default
            data.actionType = "navigate";
          }
        } else if (child.type === "Form") {
          // Flatten Form children for this simple builder
          return parseChildrenToComponents(
            child.children || [],
            routingModel,
            currentScreenId,
          );
        }

        // Handle flattened array return from Form case above
        if (Array.isArray(type)) return type;

        return { id: baseId, type, data };
      })
      .flat();
  };

  useEffect(() => {
    if (flow) {
      setFormData({
        name: flow.name,
        category: flow.category,
        flowJson: JSON.stringify(flow.flowJson, null, 2),
        endpointUri: flow.endpointUri || "",
      });
      // Load into Visual Builder
      try {
        if (flow.flowJson) {
          let json = flow.flowJson;
          if (typeof json === "string") {
            try {
              json = JSON.parse(json);
            } catch (e) {
              console.error("Error parsing flowJson string:", e);
            }
          }
          const parsedScreens = parseJSONToScreens(json);
          setScreens(parsedScreens);
          setActiveScreenId(parsedScreens[0]?.id || "START");
        }
      } catch (e) {
        console.error("Failed to parse existing flow for builder", e);
      }
    }
  }, [flow]);

  const validateJSON = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);

      // Basic Flow JSON validation
      if (
        !parsed.version ||
        !parsed.screens ||
        !Array.isArray(parsed.screens)
      ) {
        return "Invalid Flow JSON: missing required fields (version, screens)";
      }

      setJsonError("");
      return parsed;
    } catch (error: any) {
      return null;
    }
  };

  const handleJsonChange = (value: string) => {
    setFormData({ ...formData, flowJson: value });
    if (value) validateJSON(value);
  };

  const handleSave = async (currentJsonString?: string) => {
    try {
      let jsonToSave = currentJsonString || formData.flowJson;

      // Ensure JSON is up-to-date if saving from Builder tab
      if (activeTab === "builder" && !currentJsonString) {
        jsonToSave = generateJSONFromScreens();
      }

      // Validate JSON first
      const parsedJson = validateJSON(jsonToSave);
      if (!parsedJson) {
        toast.error("Invalid Flow JSON");
        return;
      }

      if (!formData.name) {
        toast.error("Flow name is required");
        return;
      }

      // Endpoint Validation
      if (!formData.endpointUri) {
        toast.error("Endpoint URI is required for V3 Flows");
        return;
      }
      try {
        const url = new URL(formData.endpointUri);
        if (url.protocol === 'http:') {
          toast.error("Endpoint must be HTTPS (Meta Requirement). Use ngrok/tunnel.");
          return;
        }
      } catch (e) {
        toast.error("Endpoint URI must be a valid URL");
        return;
      }

      setSaving(true);

      const payload = {
        name: formData.name,
        category: formData.category,
        flowJson: parsedJson,
        endpointUri: formData.endpointUri,
      };

      if (flow) {
        // Update existing Flow
        await api.put(`/whatsapp/flows/${flow.id}`, payload);
        toast.success("Flow updated successfully!");
      } else {
        // Create new Flow
        await api.post("/whatsapp/flows", payload);
        toast.success("Flow created successfully!");
      }

      onSave();
    } catch (error: any) {
      console.error("Error saving Flow:", error);
      toast.error(error.response?.data?.message || "Failed to save Flow");
    } finally {
      setSaving(false);
    }
  };

  const loadSample = () => {
    setFormData({
      ...formData,
      flowJson: JSON.stringify(SAMPLE_FLOW_JSON, null, 2),
    });
    setJsonError("");
    toast.success("Sample Flow loaded");
  };

  const [activeTab, setActiveTab] = useState<"builder" | "json" | "validation">(
    "builder",
  ); // Default to builder
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  useEffect(() => {
    if (flow?.validationErrors) {
      setValidationErrors(flow.validationErrors);
    }
  }, [flow]);

  const checkValidation = async () => {
    if (!flow) return;
    try {
      const res = await api.get(`/whatsapp/flows/${flow.id}`);
      if (res.data.success && res.data.flow.validationErrors) {
        setValidationErrors(res.data.flow.validationErrors);
        toast.success("Validation status updated");
      } else {
        // Fallback if no specific errors returned but success
        setValidationErrors([]);
        toast.success("No validation errors found");
      }
    } catch (error) {
      toast.error("Failed to fetch validation status");
    }
  };

  // --- NEW BUILDER STATE ---
  type FlowComponentType =
    | "TextHeading"
    | "TextBody"
    | "TextInput"
    | "Dropdown"
    | "RadioButtons"
    | "CheckboxGroup"
    | "DatePicker"
    | "Footer";

  interface FlowComponent {
    id: string;
    type: FlowComponentType;
    data: any;
  }

  interface FlowScreen {
    id: string;
    title: string;
    terminal: boolean;
    children: FlowComponent[];
  }

  const [screens, setScreens] = useState<FlowScreen[]>([
    {
      id: "START",
      title: "Start Screen",
      terminal: false,
      children: [
        { id: "c1", type: "TextHeading", data: { text: "Welcome" } },
        { id: "c2", type: "Footer", data: { label: "Continue", onNext: null } },
      ],
    },
  ]);

  const [activeScreenId, setActiveScreenId] = useState<string>("START");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null,
  );

  // Auto-switch to Properties tab when a component is selected
  const [activeRightTab, setActiveRightTab] = useState<
    "components" | "properties"
  >("components");
  useEffect(() => {
    if (selectedComponentId) {
      setActiveRightTab("properties");
    }
  }, [selectedComponentId]);

  // --- JSON GENERATION ---
  const generateJSONFromScreens = () => {
    console.log(`🔧 Generating JSON from ${screens.length} screens:`, screens.map(s => s.id));
    const screensJson = screens.map((screen) => {
      // Determine if this screen has connectable inputs
      const inputFields = screen.children.filter((c) =>
        [
          "TextInput",
          "Dropdown",
          "RadioButtons",
          "CheckboxGroup",
          "DatePicker",
        ].includes(c.type)
      );
      const hasInputs = inputFields.length > 0;

      const childrenJson = screen.children
        .map((comp) => {
          // ... (Component mappings same as before, simplified for Footer)
          switch (comp.type) {
            case "TextHeading":
            case "TextBody":
              return { type: comp.type, text: comp.data.text };
            case "TextInput":
              return {
                type: "TextInput",
                name: comp.data.name,
                label: comp.data.label,
                required: comp.data.required,
                "input-type": comp.data.inputType || "text",
              };
            case "Dropdown":
            case "RadioButtons":
            case "CheckboxGroup":
              return {
                type: comp.type,
                name: comp.data.name,
                label: comp.data.label,
                required: comp.data.required,
                "data-source": comp.data.options || [],
              };
            case "DatePicker":
              return {
                type: "DatePicker",
                name: comp.data.name,
                label: comp.data.label,
                required: comp.data.required,
              };
            case "Footer":
              // SMART ACTION LOGIC - Respect Explicit Action Type
              let action: any = {};
              const actionType = comp.data.actionType || "navigate";
              const nextScreenId = comp.data.nextScreenId;

              if (screen.terminal) {
                // Terminal screens MUST use complete action
                action = { name: "complete", payload: {} };
              } else if (actionType === "complete") {
                action = { name: "complete", payload: {} };
              } else if (actionType === "navigate") {
                if (nextScreenId) {
                  action = {
                    name: "navigate",
                    next: { type: "screen", name: nextScreenId },
                    payload: {},
                  };
                } else {
                  // Fallback: navigate to nowhere -> complete
                  console.warn(`⚠️ Screen "${screen.id}" has navigate action but no target screen. Defaulting to complete.`);
                  action = { name: "complete", payload: {} };
                }
              } else if (actionType === "data_exchange") {
                const payload: any = {};
                // Gather inputs if any
                if (hasInputs) {
                  inputFields.forEach((f) => {
                    // Use 'form' context for safer field access
                    payload[f.data.name] = `\${form.${f.data.name}}`;
                  });
                }

                if (nextScreenId) {
                  payload.next_screen_id = nextScreenId;
                }

                // Even if no inputs, data_exchange is valid (triggers server flow logic)
                action = { name: "data_exchange", payload };
              } else {
                // Fallback
                action = { name: "complete", payload: {} };
              }

              return {
                type: "Footer",
                label: comp.data.label,
                "on-click-action": action,
              };
            default:
              return null;
          }
        })
        .filter(Boolean);

      return {
        id: screen.id,
        title: screen.title,
        terminal: screen.terminal,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children: childrenJson,
        },
      };
    });

    // Valid Routing Model Generation
    const routing_model: any = {};

    // Initialize all screens in routing model
    screens.forEach(s => {
      routing_model[s.id] = [];
    });

    screens.forEach((s) => {
      // Terminal screens must have empty routing model (no outbound links allowed)
      if (s.terminal) return;

      const footer = s.children.find((c) => c.type === "Footer");

      if (footer) {
        const actionType = footer.data.actionType || "navigate";
        const nextScreenId = footer.data.nextScreenId;

        if (actionType !== "complete" && nextScreenId) {
          const targetExists = screens.some((scr) => scr.id === nextScreenId);

          if (targetExists) {
            if (!routing_model[s.id].includes(nextScreenId)) {
              routing_model[s.id].push(nextScreenId);
            }
          }
        }
      }
    });

    const fullJson = {
      version: "6.0",
      data_api_version: "3.0",
      routing_model,
      screens: screensJson,
    };

    console.log(`✅ Generated Flow JSON with ${screensJson.length} screens`);
    const newJsonString = JSON.stringify(fullJson, null, 2);
    setFormData((prev) => ({ ...prev, flowJson: newJsonString }));
    return newJsonString;
  };

  // --- ACTIONS ---
  const addScreen = () => {
    let suffix = screens.length + 1;
    let id = `SCREEN_${suffix}`;
    while (screens.some((s) => s.id === id)) {
      suffix++;
      id = `SCREEN_${suffix}`;
    }
    const newScreen: FlowScreen = {
      id,
      title: "New Screen",
      terminal: false,
      children: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: "TextHeading",
          data: { text: "New Screen" }
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          type: "Footer",
          data: {
            label: "Continue",
            actionType: "complete",
            nextScreenId: ""
          }
        }
      ],
    };
    setScreens([...screens, newScreen]);
    setActiveScreenId(id);
  };

  const deleteScreen = (id: string) => {
    if (screens.length <= 1)
      return toast.error("Cannot delete the only screen");
    setScreens(screens.filter((s) => s.id !== id));
    if (activeScreenId === id) setActiveScreenId(screens[0].id);
  };

  const addComponent = (type: FlowComponentType) => {
    const newComp: FlowComponent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data:
        type === "Footer"
          ? {
            label: "Continue",
            actionType: "complete",
            nextScreenId: "",
          }
          : {
            label: "New Component",
            text: "Text Content",
            name: `field_${Math.floor(Math.random() * 1000)}`,
            required: true,
            options: [{ id: "1", title: "Option 1" }],
          },
    };

    setScreens(
      screens.map((s) => {
        if (s.id === activeScreenId) {
          return { ...s, children: [...s.children, newComp] };
        }
        return s;
      }),
    );
  };

  const updateComponent = (compId: string, data: any) => {
    setScreens(
      screens.map((s) => {
        if (s.id === activeScreenId) {
          return {
            ...s,
            children: s.children.map((c) =>
              c.id === compId ? { ...c, data: { ...c.data, ...data } } : c,
            ),
          };
        }
        return s;
      }),
    );
  };

  const deleteComponent = (compId: string) => {
    setScreens(
      screens.map((s) => {
        if (s.id === activeScreenId) {
          return { ...s, children: s.children.filter((c) => c.id !== compId) };
        }
        return s;
      }),
    );
    setSelectedComponentId(null);
  };

  // Auto-generate on mount or field change?
  // Better to have a "Sync to Code" or just do it when switching tabs.
  useEffect(() => {
    if (activeTab === "builder") {
      // Optional: Sync JSON in background or on save
    }
  }, [screens, activeTab]);

  // UI Helpers
  const activeScreenContext = screens.find((s) => s.id === activeScreenId);
  const selectedComponentContext = activeScreenContext?.children.find(
    (c) => c.id === selectedComponentId,
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card w-full max-w-5xl h-[90vh] rounded-xl shadow-xl border border-border flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Workflow className="w-5 h-5 text-primary" />
                {flow ? "Edit Flow" : "Create New Flow"}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border bg-card">
              <div>
                <label className="block text-sm font-semibold mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Category
                </label>
                <select
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Endpoints Section */}
            <div className="px-4 py-2 border-b border-border bg-muted/10">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Endpoint URI (Required)
              </label>
              <input
                type="url"
                value={formData.endpointUri}
                onChange={(e) =>
                  setFormData({ ...formData, endpointUri: e.target.value })
                }
                placeholder="https://..."
                className="w-full px-3 py-1.5 text-sm bg-background border rounded-md"
              />
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => {
                    const protocol = window.location.protocol;
                    if (protocol === "http:") {
                      toast.warning(
                        "Meta requires a public HTTPS URL. Use ngrok or a deployed URL.",
                        { autoClose: 5000 },
                      );
                    }
                    setFormData({
                      ...formData,
                      endpointUri: `${protocol}//${window.location.host}/api/whatsapp/flows/endpoint`,
                    });
                  }}
                  className="text-[10px] text-primary hover:underline"
                >
                  Use Default Endpoint
                </button>
              </div>
            </div>

            {/* Builder Tabs */}
            <div className="flex border-b border-border bg-muted/30 px-4">
              <button
                onClick={() => setActiveTab("builder")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "builder" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                Visual Builder
              </button>
              <button
                onClick={() => {
                  setActiveTab("json");
                  generateJSONFromScreens();
                }} // Sync on switch
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "json" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                JSON Code
              </button>
              <button
                onClick={() => setActiveTab("validation")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "validation" ? "border-orange-500 text-orange-600" : "border-transparent text-muted-foreground"}`}
              >
                Validation
                {validationErrors.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-[10px]">
                    {validationErrors.length}
                  </span>
                )}
              </button>
            </div>

            {/* Validation Tab Content */}
            {activeTab === "validation" && (
              <div className="flex-1 overflow-y-auto p-4 bg-muted/5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-sm">
                    Meta Validation Errors
                  </h3>
                  <Button size="sm" variant="outline" onClick={checkValidation}>
                    <Workflow className="w-4 h-4 mr-2" /> Refresh Validation
                  </Button>
                </div>
                {validationErrors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-green-500/5 rounded-lg border border-green-500/20">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium text-green-700">
                      No Validation Errors Found
                    </p>
                    <p className="text-xs">
                      Your Flow JSON structure looks good to Meta.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {validationErrors.map((err: any, idx) => (
                      <div
                        key={idx}
                        className="bg-red-50 border border-red-200 p-3 rounded-lg flex gap-3 text-sm text-red-900"
                      >
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            {err.error_code} -{" "}
                            {err.error_title || "Validation Error"}
                          </p>
                          <p className="text-red-700 mt-1">{err.error}</p>
                          <p className="text-xs text-red-500 mt-2 font-mono bg-white/50 p-1 rounded inline-block">
                            {err.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-hidden flex">
              {/* VISUAL BUILDER */}
              {activeTab === "builder" && (
                <div className="flex bg-muted/5 h-full overflow-hidden w-full">
                  {/* 1. LEFT SIDEBAR: SCREEN MANAGER */}
                  <div className="w-64 bg-card border-r border-border flex flex-col shrink-0">
                    <div className="p-4 border-b border-border bg-muted/20">
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        Screens
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {screens.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setActiveScreenId(s.id);
                            setSelectedComponentId(null);
                          }}
                          className={`p-3 rounded-lg text-sm font-medium cursor-pointer flex justify-between items-center group transition-colors ${activeScreenId === s.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted text-muted-foreground"}`}
                        >
                          <span className="truncate">{s.title}</span>
                          {screens.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteScreen(s.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-border">
                      <Button
                        variant="outline"
                        className="w-full text-xs"
                        onClick={addScreen}
                      >
                        + Add Screen
                      </Button>
                    </div>
                  </div>

                  {/* 2. CENTER: CANVAS (PHONE) */}
                  {/* 2. CENTER: CANVAS (PHONE) */}
                  <div className="flex-1 overflow-y-auto bg-muted/10 flex flex-col items-center p-4 relative">
                    {/* Mobile Frame - Scaled for fit */}
                    {/* Mobile Frame - Scaled for fit, centered via margin */}
                    <div className="w-[320px] h-[640px] bg-background border-[6px] border-zinc-800 rounded-[3rem] shadow-2xl relative flex flex-col shrink-0 scale-90 origin-center overflow-hidden my-auto">
                      {/* Status Bar */}
                      <div className="bg-zinc-100 h-6 flex items-center justify-between px-5 text-[10px] font-medium border-b shrink-0 select-none text-zinc-900">
                        <span>9:41</span>
                        <div className="flex gap-1 text-zinc-900">
                          <Signal className="w-2.5 h-2.5" />
                          <Wifi className="w-2.5 h-2.5" />
                          <Battery className="w-2.5 h-2.5" />
                        </div>
                      </div>

                      {/* WhatsApp Header */}
                      <div className="bg-[#008069] text-white px-4 py-2 flex items-center gap-3 shadow-md z-10 shrink-0 select-none">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                          A
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold leading-none">
                            Flow Builder
                          </div>
                          <div className="text-[10px] opacity-80 mt-0.5">
                            WhatsApp Flows
                          </div>
                        </div>
                      </div>

                      {/* Screen Content Canvas */}
                      <div className="flex-1 bg-[#efeae2] p-3 overflow-y-auto relative scrollbar-hide">
                        {/* The Flow UI Container - FORCE LIGHT MODE for preview accuracy */}
                        <div className="bg-white rounded-lg shadow-sm min-h-[300px] flex flex-col relative overflow-hidden text-zinc-900">
                          {/* Screen Header */}
                          <div className="h-10 border-b flex items-center justify-between px-3 shrink-0 bg-white z-10 sticky top-0">
                            <X className="w-4 h-4 opacity-50 text-zinc-600" />
                            <span className="font-semibold text-xs truncate max-w-[150px] text-zinc-900">
                              {activeScreenContext?.title}
                            </span>
                            <div className="w-4" />
                          </div>

                          {/* Components List */}
                          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {activeScreenContext?.children.length === 0 && (
                              <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                                Empty Screen <br /> Add components from right
                                panel
                              </div>
                            )}

                            {activeScreenContext?.children.map((comp) => (
                              <div
                                key={comp.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedComponentId(comp.id);
                                }}
                                className={`relative group cursor-pointer transition-all ${selectedComponentId === comp.id ? "ring-2 ring-primary bg-primary/5 rounded px-2 -mx-2 py-2 -my-2" : ""}`}
                              >
                                {/* Render Component */}
                                {comp.type === "TextHeading" && (
                                  <h1 className="text-lg font-bold text-zinc-900">
                                    {comp.data.text}
                                  </h1>
                                )}
                                {comp.type === "TextBody" && (
                                  <p className="text-sm text-zinc-500 whitespace-pre-wrap">
                                    {comp.data.text}
                                  </p>
                                )}

                                {(comp.type === "TextInput" ||
                                  comp.type === "DatePicker") && (
                                    <div className="space-y-1">
                                      <label className="text-xs font-bold text-zinc-500 flex gap-0.5">
                                        {comp.data.label}{" "}
                                        {comp.data.required && (
                                          <span className="text-red-500">*</span>
                                        )}
                                      </label>
                                      <div className="h-10 w-full bg-transparent border border-zinc-300 rounded-lg px-3 flex items-center text-sm text-zinc-400">
                                        {comp.type === "TextInput" ? (
                                          <span className="truncate">
                                            {comp.data.text ||
                                              `Enter ${comp.data.label}`}
                                          </span>
                                        ) : (
                                          "DD/MM/YYYY"
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {(comp.type === "Dropdown" ||
                                  comp.type === "RadioButtons" ||
                                  comp.type === "CheckboxGroup") && (
                                    <div className="space-y-1">
                                      <label className="text-xs font-bold text-zinc-500 flex gap-0.5">
                                        {comp.data.label}{" "}
                                        {comp.data.required && (
                                          <span className="text-red-500">*</span>
                                        )}
                                      </label>
                                      {comp.type === "Dropdown" ? (
                                        <div className="h-10 w-full bg-transparent border border-zinc-300 rounded-lg px-3 flex items-center justify-between text-sm text-zinc-400">
                                          <span>Select...</span>
                                          <span className="opacity-50">▼</span>
                                        </div>
                                      ) : (
                                        <div className="space-y-2 pt-1">
                                          {comp.data.options?.map((opt: any) => (
                                            <div
                                              key={opt.id}
                                              className="flex items-center gap-2"
                                            >
                                              <div
                                                className={`w-5 h-5 border border-zinc-400 ${comp.type === "RadioButtons" ? "rounded-full" : "rounded-md"} flex items-center justify-center`}
                                              ></div>
                                              <span className="text-sm text-zinc-700">
                                                {opt.title || opt.id}
                                              </span>
                                            </div>
                                          ))}
                                          {(!comp.data.options ||
                                            comp.data.options.length === 0) && (
                                              <span className="text-[10px] italic text-zinc-400">
                                                No options added
                                              </span>
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                {comp.type === "Footer" && (
                                  <div className="mt-4 pt-2">
                                    <button className="w-full h-10 text-sm font-semibold text-white bg-[#007bff] rounded-full shadow-sm hover:bg-[#0056b3] transition-colors">
                                      {comp.data.label}
                                    </button>
                                  </div>
                                )}

                                {/* Hover Actions */}
                                {selectedComponentId === comp.id && (
                                  <div className="absolute -right-2 -top-2 flex gap-1 bg-white dark:bg-zinc-800 shadow rounded-full p-1 border z-20">
                                    <button
                                      className="p-1 hover:text-red-500 text-muted-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteComponent(comp.id);
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. RIGHT SIDEBAR: PROPERTIES */}
                  <div className="w-96 bg-card border-l border-border flex flex-col shrink-0 overflow-hidden">
                    {/* TABS: Components vs Properties */}
                    <div className="flex border-b text-xs font-semibold">
                      <button
                        className={`flex-1 py-3 border-b-2 ${activeRightTab === "components" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                        onClick={() => {
                          setSelectedComponentId(null);
                          setActiveRightTab("components");
                        }}
                      >
                        Components
                      </button>
                      <button
                        className={`flex-1 py-3 border-b-2 ${activeRightTab === "properties" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                        onClick={() => setActiveRightTab("properties")}
                      >
                        Properties
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {/* COMPONENT PALETTE */}
                      {activeRightTab === "components" ? (
                        <div className="space-y-6">
                          {/* Screen Settings Moved to Properties Tab */}

                          <div>
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">
                              Layout Elements
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("TextHeading")}
                              >
                                Heading
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("TextBody")}
                              >
                                Body Text
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("Footer")}
                              >
                                Footer Button
                              </Button>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">
                              Form Inputs
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("TextInput")}
                              >
                                Text Input
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("Dropdown")}
                              >
                                Dropdown
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("RadioButtons")}
                              >
                                Radio Group
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("CheckboxGroup")}
                              >
                                Checkbox
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-8"
                                onClick={() => addComponent("DatePicker")}
                              >
                                Date Picker
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* COMPONENT PROPERTIES */
                        <div className="space-y-4">
                          {!selectedComponentId ? (
                            /* SCREEN PROPERTIES */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">
                                  Screen Properties
                                </h4>
                              </div>
                              <div className="p-3 bg-muted/20 rounded-lg border space-y-3">
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    ID
                                  </label>
                                  <input
                                    className="w-full text-xs font-mono bg-background border px-2 py-1.5 rounded"
                                    value={activeScreenContext?.id}
                                    onChange={(e) => {
                                      const oldId = activeScreenContext?.id;
                                      const newId = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"); // Enforce valid ID format
                                      if (!oldId) return;

                                      setScreens(screens.map(s => {
                                        if (s.id === oldId) return { ...s, id: newId };
                                        // Update references in other screens' footers
                                        return {
                                          ...s,
                                          children: s.children.map(c => {
                                            if (c.type === 'Footer' && c.data.nextScreenId === oldId) {
                                              return { ...c, data: { ...c.data, nextScreenId: newId } };
                                            }
                                            return c;
                                          })
                                        };
                                      }));
                                      setActiveScreenId(newId);
                                    }}
                                    placeholder="e.g., START, QUESTION_1"
                                  />
                                  <p className="text-[9px] text-muted-foreground mt-1">
                                    Used in navigation. Must be unique and uppercase.
                                  </p>
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Title
                                  </label>
                                  <input
                                    className="w-full text-xs bg-background border px-2 py-1.5 rounded"
                                    value={activeScreenContext?.title}
                                    onChange={(e) =>
                                      setScreens(
                                        screens.map((s) =>
                                          s.id === activeScreenId
                                            ? { ...s, title: e.target.value }
                                            : s,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="pt-2">
                                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Terminal Screen?
                                  </label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <input
                                      type="checkbox"
                                      checked={activeScreenContext?.terminal}
                                      onChange={(e) =>
                                        setScreens(
                                          screens.map((s) =>
                                            s.id === activeScreenId
                                              ? {
                                                ...s,
                                                terminal: e.target.checked,
                                              }
                                              : s,
                                          ),
                                        )
                                      }
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      End Navigation Logic Here
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-[10px] text-muted-foreground p-2">
                                Select a component in the simulator to edit its
                                properties.
                              </div>
                            </div>
                          ) : (
                            /* COMPONENT PROPERTIES */
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="-ml-2 text-xs text-muted-foreground"
                                  onClick={() => {
                                    setSelectedComponentId(null);
                                    setActiveRightTab("components");
                                  }}
                                >
                                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                </Button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                                  {selectedComponentContext?.type}
                                </span>
                              </div>

                              {/* Properties Form */}
                              <div className="space-y-4">
                                {/* Component Type Display */}
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">
                                  {selectedComponentContext?.type} Properties
                                </div>

                                {/* 1. Common Text/Label Field */}
                                {(selectedComponentContext?.type ===
                                  "TextHeading" ||
                                  selectedComponentContext?.type ===
                                  "TextBody") && (
                                    <div>
                                      <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                        Text Content
                                      </label>
                                      <textarea
                                        className="w-full text-xs bg-background border px-2 py-1.5 rounded min-h-[80px]"
                                        value={
                                          selectedComponentContext?.data.text ||
                                          ""
                                        }
                                        onChange={(e) =>
                                          selectedComponentId &&
                                          updateComponent(selectedComponentId, {
                                            text: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  )}

                                {/* 2. Input Fields: Label & Name & Required */}
                                {[
                                  "TextInput",
                                  "Dropdown",
                                  "RadioButtons",
                                  "CheckboxGroup",
                                  "DatePicker",
                                  "Footer",
                                ].includes(
                                  selectedComponentContext?.type || "",
                                ) && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                          Label / Button Text
                                        </label>
                                        <input
                                          type="text"
                                          className="w-full text-xs bg-background border px-2 py-1.5 rounded"
                                          value={
                                            selectedComponentContext?.data
                                              .label || ""
                                          }
                                          onChange={(e) =>
                                            selectedComponentId &&
                                            updateComponent(selectedComponentId, {
                                              label: e.target.value,
                                            })
                                          }
                                        />
                                      </div>

                                      {selectedComponentContext?.type !==
                                        "Footer" && (
                                          <>
                                            <div>
                                              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                                Field Name (ID)
                                              </label>
                                              <input
                                                type="text"
                                                className="w-full text-xs bg-background border px-2 py-1.5 rounded font-mono"
                                                value={
                                                  selectedComponentContext?.data
                                                    .name || ""
                                                }
                                                onChange={(e) =>
                                                  selectedComponentId &&
                                                  updateComponent(
                                                    selectedComponentId,
                                                    { name: e.target.value },
                                                  )
                                                }
                                                placeholder="e.g. first_name"
                                              />
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="req-check"
                                                checked={
                                                  selectedComponentContext?.data
                                                    .required || false
                                                }
                                                onChange={(e) =>
                                                  selectedComponentId &&
                                                  updateComponent(
                                                    selectedComponentId,
                                                    { required: e.target.checked },
                                                  )
                                                }
                                              />
                                              <label
                                                htmlFor="req-check"
                                                className="text-xs"
                                              >
                                                Required Field
                                              </label>
                                            </div>
                                          </>
                                        )}
                                    </div>
                                  )}

                                {/* 3. Dropdown/Radio Options */}
                                {(selectedComponentContext?.type ===
                                  "Dropdown" ||
                                  selectedComponentContext?.type ===
                                  "RadioButtons" ||
                                  selectedComponentContext?.type ===
                                  "CheckboxGroup") && (
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                          Options List
                                        </label>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-5 text-[10px] px-2"
                                          onClick={() => {
                                            const currentOpts =
                                              selectedComponentContext.data
                                                .options || [];
                                            const newOpt = {
                                              id: `opt_${Date.now()}`,
                                              title: "New Option",
                                            };
                                            updateComponent(
                                              selectedComponentContext.id,
                                              {
                                                options: [...currentOpts, newOpt],
                                              },
                                            );
                                          }}
                                        >
                                          <Plus className="w-3 h-3 mr-1" /> Add
                                        </Button>
                                      </div>
                                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                        {(
                                          selectedComponentContext?.data
                                            .options || []
                                        ).map((opt: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="flex items-center gap-2 group"
                                          >
                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                              <input
                                                className="w-full text-xs bg-background border px-2 py-1.5 rounded"
                                                placeholder="Label"
                                                value={opt.title}
                                                onChange={(e) => {
                                                  const newOpts = [
                                                    ...(selectedComponentContext
                                                      .data.options || []),
                                                  ];
                                                  newOpts[idx] = {
                                                    ...newOpts[idx],
                                                    title: e.target.value,
                                                  };
                                                  updateComponent(
                                                    selectedComponentContext.id,
                                                    { options: newOpts },
                                                  );
                                                }}
                                              />
                                              <input
                                                className="w-full text-xs bg-muted/50 border px-2 py-1.5 rounded font-mono text-muted-foreground"
                                                placeholder="ID"
                                                value={opt.id}
                                                onChange={(e) => {
                                                  const newOpts = [
                                                    ...(selectedComponentContext
                                                      .data.options || []),
                                                  ];
                                                  newOpts[idx] = {
                                                    ...newOpts[idx],
                                                    id: e.target.value,
                                                  };
                                                  updateComponent(
                                                    selectedComponentContext.id,
                                                    { options: newOpts },
                                                  );
                                                }}
                                              />
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                              onClick={() => {
                                                const newOpts =
                                                  selectedComponentContext.data.options.filter(
                                                    (_: any, i: number) =>
                                                      i !== idx,
                                                  );
                                                updateComponent(
                                                  selectedComponentContext.id,
                                                  { options: newOpts },
                                                );
                                              }}
                                            >
                                              <X className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        ))}
                                        {(!selectedComponentContext?.data
                                          .options ||
                                          selectedComponentContext.data.options
                                            .length === 0) && (
                                            <div className="text-center py-4 border-2 border-dashed rounded text-[10px] text-muted-foreground">
                                              No options added.
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  )}

                                {/* Footer Navigation */}
                                <div>
                                  <div className="mb-2">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                      Action Type
                                    </label>
                                    <select
                                      className="w-full text-xs bg-background border px-2 py-1.5 rounded"
                                      value={
                                        selectedComponentContext?.data
                                          .actionType || "navigate"
                                      }
                                      onChange={(e) =>
                                        selectedComponentId &&
                                        updateComponent(selectedComponentId, {
                                          actionType: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="navigate">
                                        Navigate to Screen
                                      </option>
                                      <option value="data_exchange">
                                        Submit Data (Server)
                                      </option>
                                      <option value="complete">
                                        Complete Flow
                                      </option>
                                    </select>
                                  </div>

                                  {(selectedComponentContext?.data
                                    .actionType === "navigate" ||
                                    selectedComponentContext?.data
                                      .actionType === "data_exchange") && (
                                      <div>
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">
                                          Target Screen
                                        </label>
                                        <select
                                          className="w-full text-xs bg-background border px-2 py-1.5 rounded"
                                          value={
                                            selectedComponentContext?.data
                                              .nextScreenId || ""
                                          }
                                          onChange={(e) =>
                                            selectedComponentId &&
                                            updateComponent(selectedComponentId, {
                                              nextScreenId: e.target.value,
                                            })
                                          }
                                        >
                                          <option value="" disabled>
                                            Select Screen...
                                          </option>
                                          {screens
                                            .filter(
                                              (s) => s.id !== activeScreenId,
                                            ) // Prevent self-linking loop
                                            .map((s) => (
                                              <option key={s.id} value={s.id}>
                                                {s.title} ({s.id})
                                              </option>
                                            ))}
                                        </select>
                                        {selectedComponentContext?.data
                                          .actionType === "navigate" &&
                                          !selectedComponentContext?.data.nextScreenId && (
                                            <p className="text-[10px] text-red-500 mt-1 font-semibold">
                                              ⚠️ Please select a target screen to avoid validation errors.
                                            </p>
                                          )}
                                        {selectedComponentContext?.data
                                          .actionType === "data_exchange" && (
                                            <p className="text-[10px] text-muted-foreground mt-1 text-orange-600">
                                              Server <b>MUST</b> return this screen
                                              ID after processing.
                                            </p>
                                          )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* JSON EDITOR */}
              {activeTab === "json" && (
                <div className="flex-1 relative">
                  <textarea
                    className="w-full h-full p-4 bg-zinc-950 text-zinc-50 font-mono text-sm resize-none focus:outline-none"
                    value={formData.flowJson}
                    onChange={(e) =>
                      setFormData({ ...formData, flowJson: e.target.value })
                    }
                    spellCheck={false}
                  />
                  <div className="absolute top-2 right-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          flowJson: JSON.stringify(SAMPLE_FLOW_JSON, null, 2),
                        });
                      }}
                      className="text-xs bg-white/10 hover:bg-white/20 text-white border-0"
                    >
                      Reset to Sample
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  let jsonToUse;
                  if (activeTab === "builder") {
                    jsonToUse = generateJSONFromScreens();
                  }
                  handleSave(jsonToUse);
                }}
              >
                {flow ? "Update Flow" : "Create Flow"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
