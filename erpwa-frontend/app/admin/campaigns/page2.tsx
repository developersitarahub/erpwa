"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Checkbox } from "@/components/checkbox";
import {
  ImageIcon,
  X,
  Send,
  Search,
  Calendar,
  Users,
  Zap,
  Check,
  ChevronRight,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: "image" | "template";
  status: "draft" | "active" | "completed" | "paused";
  recipientCount: number;
  createdAt: string;
}

interface ImageSkeleton {
  id: string;
}

function CreateImageCampaignModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState("Electronics");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Phones");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientCategory, setRecipientCategory] = useState("All");
  const [recipientSubcategory, setRecipientSubcategory] = useState("All");
  const [isLoading, setIsLoading] = useState(false);

  // Mock data
  const categories = {
    Electronics: ["Phones", "Laptops", "Accessories"],
    Fashion: ["Men", "Women", "Kids"],
    Home: ["Furniture", "Decor", "Kitchen"],
  };

  const mockImages = [
    { id: "1", name: "Product 1" },
    { id: "2", name: "Product 2" },
    { id: "3", name: "Product 3" },
    { id: "4", name: "Product 4" },
    { id: "5", name: "Product 5" },
    { id: "6", name: "Product 6" },
  ];

  const mockContacts = [
    {
      id: "1",
      name: "John Smith",
      category: "Electronics",
      subcategory: "Phones",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      category: "Electronics",
      subcategory: "Laptops",
    },
    { id: "3", name: "Michael Chen", category: "Fashion", subcategory: "Men" },
    { id: "4", name: "Emma Davis", category: "Fashion", subcategory: "Women" },
    {
      id: "5",
      name: "James Brown",
      category: "Home",
      subcategory: "Furniture",
    },
    {
      id: "6",
      name: "Lisa Anderson",
      category: "Home",
      subcategory: "Kitchen",
    },
  ];

  // Filter contacts based on selected category/subcategory
  const filteredContacts = mockContacts.filter((contact) => {
    if (recipientCategory === "All") return true;
    if (recipientSubcategory === "All")
      return contact.category === recipientCategory;
    return (
      contact.category === recipientCategory &&
      contact.subcategory === recipientSubcategory
    );
  });

  const handleSelectAll = () => {
    if (selectedImages.length === mockImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(mockImages.map((img) => img.id));
    }
  };

  const handleToggleImage = (id: string) => {
    setSelectedImages((prev) =>
      prev.includes(id) ? prev.filter((img) => img !== id) : [...prev, id]
    );
  };

  const handleRecipientToggle = (id: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleNextStep = () => {
    if (selectedImages.length === 0) {
      alert("Please select at least one image");
      return;
    }
    setStep(2);
  };

  const handleLaunch = () => {
    if (!campaignName.trim()) {
      alert("Please enter campaign name");
      return;
    }
    if (selectedRecipients.length === 0) {
      alert("Please select at least one recipient");
      return;
    }
    console.log("[v0] Launching image campaign:", {
      step,
      name: campaignName,
      images: selectedImages,
      recipients: selectedRecipients.length,
    });
    onClose();
    setStep(1);
    setCampaignName("");
    setSelectedImages([]);
    setSelectedRecipients([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <Card className="w-full max-w-3xl bg-card border-border max-h-[90vh] flex flex-col">
          <div className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border p-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Create Image Campaign - Step {step}/2
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {step === 1
                  ? "Select images from your inventory"
                  : "Set campaign details and recipients"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {step === 1 ? (
              <div className="space-y-6">
                {/* Category Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedSubcategory(
                          Object.keys(categories)[0] === e.target.value
                            ? categories[
                                e.target.value as keyof typeof categories
                              ][0]
                            : ""
                        );
                      }}
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      {Object.keys(categories).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Subcategory
                    </label>
                    <select
                      value={selectedSubcategory}
                      onChange={(e) => setSelectedSubcategory(e.target.value)}
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      {categories[
                        selectedCategory as keyof typeof categories
                      ]?.map((subcat) => (
                        <option key={subcat} value={subcat}>
                          {subcat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Image Grid with Skeleton Loader */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Select Images *
                    </label>
                    <button
                      onClick={handleSelectAll}
                      className="text-xs px-3 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                    >
                      {selectedImages.length === mockImages.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {isLoading
                      ? mockImages.map((_, idx) => (
                          <div
                            key={idx}
                            className="aspect-square bg-gradient-to-br from-secondary to-muted rounded-lg animate-pulse"
                          />
                        ))
                      : mockImages.map((image) => (
                          <motion.div
                            key={image.id}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => handleToggleImage(image.id)}
                            className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all ${
                              selectedImages.includes(image.id)
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="w-full h-full bg-secondary rounded-md flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                            {selectedImages.includes(image.id) && (
                              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <p className="absolute bottom-2 left-2 right-2 text-xs font-medium text-foreground truncate">
                              {image.name}
                            </p>
                          </motion.div>
                        ))}
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Checkbox checked={true} onChange={() => {}} />
                    <span className="text-sm text-foreground">
                      Include in next step
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Campaign Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Summer Sale 2024"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                {/* Recipient Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Select Recipients *
                  </label>

                  {/* Category Filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={recipientCategory}
                      onChange={(e) => {
                        setRecipientCategory(e.target.value);
                        setRecipientSubcategory("All");
                      }}
                      className="px-3 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="All">All Categories</option>
                      {Object.keys(categories).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <select
                      value={recipientSubcategory}
                      onChange={(e) => setRecipientSubcategory(e.target.value)}
                      className="px-3 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="All">All Subcategories</option>
                      {recipientCategory !== "All" &&
                        categories[
                          recipientCategory as keyof typeof categories
                        ]?.map((subcat) => (
                          <option key={subcat} value={subcat}>
                            {subcat}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Recipients List */}
                  <div className="border border-border rounded-lg max-h-[300px] overflow-y-auto">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleRecipientToggle(contact.id)}
                      >
                        <Checkbox
                          checked={selectedRecipients.includes(contact.id)}
                          onChange={() => {}}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {contact.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contact.category} • {contact.subcategory}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Selected Count */}
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-foreground">
                      Total contacts selected:{" "}
                      <span className="text-primary">
                        {selectedRecipients.length}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-border flex gap-2">
            {step === 2 && (
              <Button
                onClick={() => setStep(1)}
                className="bg-secondary border-border text-foreground hover:bg-muted"
              >
                Back
              </Button>
            )}
            {step === 1 ? (
              <Button
                onClick={handleNextStep}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Next Step <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Zap className="w-4 h-4 mr-2" />
                Launch Campaign
              </Button>
            )}
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

function CreateTemplateCampaignModal({
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

function CampaignCard({
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

  const typeIcons: Record<Campaign["type"], typeof ImageIcon> = {
    image: ImageIcon,
    template: Send,
  };

  const TypeIcon = typeIcons[campaign.type];

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
                <TypeIcon className="w-5 h-5 text-primary" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-medium">
                {campaign.recipientCount}
              </span>
              <span className="text-muted-foreground">recipients</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {campaign.createdAt}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function CampaignsPage() {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([
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
  ]);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage WhatsApp marketing campaigns
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <button
            onClick={() => setIsImageModalOpen(true)}
            className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <ImageIcon className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-foreground">
                Image Campaign
              </h3>
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
              <Send className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-foreground">
                Template Campaign
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Send approved templates to your contacts
            </p>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-semibold text-foreground">
            Active Campaigns
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign, index) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                index={index}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <CreateImageCampaignModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
      />
      <CreateTemplateCampaignModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
    </div>
  );
}
