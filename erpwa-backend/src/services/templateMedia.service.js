import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

/**
 * ===============================
 * S3 CLIENT
 * ===============================
 */
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * ===============================
 * UPLOAD TEMPLATE MEDIA TO S3
 * ===============================
 *
 * Used for:
 * - WhatsApp template header media
 * - IMAGE / VIDEO / DOCUMENT
 *
 * ❗ This URL is NEVER sent to WhatsApp directly
 * ❗ Used only to upload media to WhatsApp Media API
 */
export async function uploadTemplateMediaToS3({
  buffer,
  mimeType,
  vendorId,
  templateId,
  language,
  extension,
}) {
  if (!process.env.S3_BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME is not set");
  }

  if (!process.env.CLOUDFRONT_BASE_URL) {
    throw new Error("CLOUDFRONT_BASE_URL is not set");
  }

  /**
   * 📂 S3 PATH STRUCTURE
   * vendors/{vendorId}/templates/{templateId}/{language}/{uuid}.{ext}
   */
  const key = `vendors/${vendorId}/templates/${templateId}/${language}/${uuid()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: "private", // CloudFront should handle access
    })
  );

  return {
    s3Key: key,
    url: `${process.env.CLOUDFRONT_BASE_URL}/${key}`,
  };
}
