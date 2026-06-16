import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@handeck/env/server";

const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 60 * 5;

export function createS3Client() {
  return new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    ...(env.S3_ENDPOINT
      ? {
          endpoint: env.S3_ENDPOINT,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
        }
      : {}),
  });
}

export function getDeckObjectKey(userId: string, deckId: string) {
  return `decks/${userId}/${deckId}.apkg`;
}

// this deserves a better implementation in the future
export function getDeckDownloadFilename(templateName: string) {
  const sanitized = templateName
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

  return `${sanitized || "deck"}.apkg`;
}

export async function getDeckDownloadUrl(objectKey: string, filename: string) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  return getSignedUrl(createS3Client(), command, {
    expiresIn: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
  });
}

export async function uploadDeckPackage(objectKey: string, body: Buffer) {
  const s3Client = createS3Client();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
      Body: body,
      ContentType: "application/octet-stream",
    }),
  );
}
