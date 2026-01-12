" use client";

import { motion } from "framer-motion";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { ImageIcon, X, Zap, Check, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

export default function CreateTemplateCampaignModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const mockTemplates = [
    { id: "1", name: "Welcome Message", preview: "Hi {{name}}, welcome!" },
    {
      id: "2",
      name: "Order Confirmation",
      preview: "Your order #{{order_id}} confirmed",
    },
    {
      id: "3",
      name: "Follow-up",
      preview: "Hi {{name}}, checking in on your purchase",
    },
  ];

  const mockLeads = [
    { id: "1", name: "John Smith", phone: "+1 (555) 123-4567" },
    { id: "2", name: "Sarah Johnson", phone: "+1 (555) 234-5678" },
    { id: "3", name: "Michael Chen", phone: "+1 (555) 345-6789" },
    { id: "4", name: "Emma Davis", phone: "+1 (555) 456-7890" },
  ];

  const filteredLeads = mockLeads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery)
  );

  const handleLaunch = () => {
    if (!campaignName || !selectedTemplate || selectedLeads.length === 0) {
      alert("Please fill in all required fields");
      return;
    }
    console.log("[v0] Launching template campaign:", {
      name: campaignName,
      template: selectedTemplate,
      recipients: selectedLeads.length,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <Card className="w-full max-w-2xl bg-card border-border max-h-[90vh] flex flex-col">
          <div className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border p-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Create Template Campaign
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Send approved templates to your contacts
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Campaign Name *
              </label>
              <input
                type="text"
                placeholder="e.g., Q4 Marketing Campaign"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Select Template *
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">Choose a template...</option>
                {mockTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {selectedTemplate && (
                <div className="p-4 bg-secondary border border-border rounded-lg">
                  <p className="text-sm text-foreground">
                    {
                      mockTemplates.find((t) => t.id === selectedTemplate)
                        ?.preview
                    }
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Select Recipients *
                </label>
                <span className="text-xs text-muted-foreground">
                  {selectedLeads.length} selected
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() =>
                      setSelectedLeads((prev) =>
                        prev.includes(lead.id)
                          ? prev.filter((id) => id !== lead.id)
                          : [...prev, lead.id]
                      )
                    }
                  >
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => {}}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {lead.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-border flex gap-2">
            <Button
              onClick={handleLaunch}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Zap className="w-4 h-4 mr-2" />
              Launch Campaign
            </Button>
            <Button
              className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
