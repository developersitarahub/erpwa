"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ImageIcon, Send } from "lucide-react";

import CampaignCard from "@/components/campaigns/campaignCard";
import CampaignImage from "@/components/campaigns/CreateImageCampaignModal";
import CampaignTemplate from "@/components/campaigns/createTemplateCampaignModal";

export default function CampaignsPage() {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const campaigns = [
    {
      id: "1",
      name: "Summer Sale 2024",
      type: "image",
      status: "active",
      recipientCount: 256,
      createdAt: "2 days ago",
    },
    {
      id: "2",
      name: "Q4 Newsletter",
      type: "template",
      status: "completed",
      recipientCount: 512,
      createdAt: "1 week ago",
    },
    {
      id: "3",
      name: "New Product Launch",
      type: "image",
      status: "draft",
      recipientCount: 128,
      createdAt: "3 hours ago",
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage WhatsApp marketing campaigns
          </p>
        </motion.div>

        {/* Create buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setIsImageModalOpen(true)}
            className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <ImageIcon className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold">Image Campaign</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Send branded images to your contacts
            </p>
          </button>

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Send className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold">Template Campaign</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Send approved templates to your contacts
            </p>
          </button>
        </div>

        {/* Campaign list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c, i) => (
            <CampaignCard key={c.id} campaign={c} index={i} />
          ))}
        </div>
      </div>

      <CampaignImage
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
      />

      <CampaignTemplate
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
    </div>
  );
}
