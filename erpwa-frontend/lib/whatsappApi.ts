import api from "./api";

/**
 * Check if a phone number is on WhatsApp
 */
export async function checkWhatsAppNumber(phoneNumber: string) {
  const response = await api.post("/whatsapp/check-number", { phoneNumber });
  return response.data;
}

/**
 * Create a new conversation for a WhatsApp number
 */
export async function createWhatsAppConversation(
  phoneNumber: string,
  companyName?: string,
) {
  const response = await api.post("/whatsapp/create-conversation", {
    phoneNumber,
    companyName,
  });
  return response.data;
}
