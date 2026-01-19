import axios from "axios";

export async function sendWhatsAppImage({
  phoneNumberId,
  accessToken,
  to,
  imageUrl,
  caption,
}) {
  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: imageUrl,
      ...(caption ? { caption } : {}),
    },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

export async function sendWhatsAppTemplate({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  languageCode,
  components = [],
}) {
  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}
