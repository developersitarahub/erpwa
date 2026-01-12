"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/card";
import { Badge } from "@/components/badge";
import { Calendar, Users, ImageIcon, Send } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: "image" | "template";
  status: "draft" | "active" | "completed" | "paused";
  recipientCount: number;
  createdAt: string;
}

export default function CampaignCard({
  campaign,
  index,
}: {
  campaign: Campaign;
  index: number;
}) {
  const statusColors: Record<Campaign["status"], string> = {
    draft: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  };

  const Icon = campaign.type === "image" ? ImageIcon : Send;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -5 }}
    >
      <Card className="bg-card border-border hover:border-primary transition-all duration-200">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {campaign.name}
                </h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {campaign.type} Campaign
                </p>
              </div>
            </div>
            <Badge
              className={`text-xs capitalize ${statusColors[campaign.status]}`}
            >
              {campaign.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              {campaign.recipientCount} recipients
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {campaign.createdAt}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
