"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/card";
import { Badge } from "@/components/badge";
import { Calendar, Users, ImageIcon, Send, ShoppingBag, Layers } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: "image" | "template";
  status: "draft" | "active" | "completed" | "paused" | "scheduled" | "failed" | "pending";
  recipientCount: number;
  createdAt: string;
  totalMessages?: number;
  sentMessages?: number;
  failedMessages?: number;
  template?: {
    templateType?: "standard" | "catalog" | "carousel" | string;
  };
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
    scheduled: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  let Icon = ImageIcon;
  const normalizedType = (campaign.type || "").toLowerCase();

  if (normalizedType === "template") {
    Icon = Send;
    const templateType = campaign.template?.templateType?.toLowerCase();
    if (templateType === "catalog") Icon = ShoppingBag;
    if (templateType === "carousel") Icon = Layers;
  }

  // Calculate progress
  const total = campaign.totalMessages || 0;
  const sent = campaign.sentMessages || 0;
  const failed = campaign.failedMessages || 0;
  const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;
  const successRate = total > 0 ? (sent / total) * 100 : 0;

  // Derive display status: if completed but all failed, show as "failed"
  const displayStatus: Campaign["status"] =
    campaign.status === "completed" && sent === 0 && failed > 0
      ? "failed"
      : campaign.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <Card className="bg-card border-border hover:border-primary transition-all duration-200 h-full flex flex-col">
        <div className="p-6 space-y-4 flex-1 flex flex-col">
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
                  {(campaign.type || "").toLowerCase() === "template" && campaign.template?.templateType
                    ? `${campaign.template.templateType} Campaign`
                    : `${(campaign.type || "").toLowerCase()} Campaign`}
                </p>
              </div>
            </div>
            <Badge
              className={`text-xs capitalize ${statusColors[displayStatus]}`}
            >
              {displayStatus}
            </Badge>
          </div>

          {/* Progress Bar Section - Fixed height container */}
          <div className="min-h-[80px] flex items-center">
            {total > 0 && (displayStatus === "active" || displayStatus === "completed" || displayStatus === "pending" || displayStatus === "failed") ? (
              <div className="space-y-2 w-full">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full ${displayStatus === "failed"
                      ? "bg-red-500"
                      : displayStatus === "completed"
                        ? "bg-blue-500"
                        : displayStatus === "pending"
                          ? "bg-orange-500"
                          : "bg-green-500"
                      }`}
                  />
                </div>
                <div className="flex gap-3 text-xs">
                  {campaign.status === "pending" ? (
                    <>
                      <span className="text-orange-500 flex items-center gap-1">
                        <span className="inline-block animate-bounce">⏳</span> In Queue
                      </span>
                      <span className="text-muted-foreground">0 sent / {total} total</span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-500">✓ {sent} sent</span>
                      {failed > 0 && <span className="text-red-500">✗ {failed} failed</span>}
                      <span className="text-muted-foreground">/ {total} total</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-xs text-muted-foreground/50 italic">
                  {campaign.status === "draft" ? "Not started" : "Preparing..."}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mt-auto">
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
