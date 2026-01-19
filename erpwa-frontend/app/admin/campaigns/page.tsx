"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ImageIcon, Send, RefreshCw } from "lucide-react";

import CampaignCard from "@/components/campaigns/campaignCard";
import CampaignImage from "@/components/campaigns/CreateImageCampaignModal";
import CampaignTemplate from "@/components/campaigns/createTemplateCampaignModal";
import api from "@/lib/api";
import { toast } from "react-toastify";

interface Campaign {
  id: string | number;
  type: string;
  createdAt: string;
  [key: string]: unknown;
}

export default function CampaignsPage() {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCampaigns = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const res = await api.get("/campaign");
      setCampaigns(res.data);
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
      if (!silent) toast.error("Failed to load campaigns");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns(); // Initial load with spinner

    // Auto-refresh every 5 seconds silently (no loading spinner)
    const interval = setInterval(() => fetchCampaigns(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateSuccess = () => {
    fetchCampaigns(true); // Refresh silently
    toast.success("Campaign created successfully! 🚀");
  };

  // Pagination logic
  const totalPages = Math.ceil(campaigns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCampaigns = campaigns.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

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
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentCampaigns.map((c, i) => (
                <CampaignCard
                  key={c.id}
                  campaign={{
                    ...c,
                    type: c.type.toLowerCase(),
                    createdAt: new Date(c.createdAt).toLocaleDateString(),
                  }}
                  index={i}
                />
              ))}
              {campaigns.length === 0 && (
                <div className="col-span-full text-center py-10 text-muted-foreground">
                  No campaigns found. Create your first campaign!
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`w-10 h-10 rounded-lg border transition-all ${currentPage === page
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border bg-card hover:bg-secondary"
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <CampaignImage
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <CampaignTemplate
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
