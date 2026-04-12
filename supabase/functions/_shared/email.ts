import { SESv2Client, SendEmailCommand } from "npm:@aws-sdk/client-sesv2@3.556.0";

const AWS_REGION = Deno.env.get("AWS_REGION");
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const SES_SENDER = Deno.env.get("SES_SENDER");
const SES_CONFIGURATION_SET = Deno.env.get("SES_CONFIGURATION_SET");

export interface EmailTag {
  key: string;
  value: string;
}

export interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  reply_to?: string[];
  tags?: EmailTag[];
}

let client: SESv2Client | null = null;

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function getEmailEnvError() {
  const missing: string[] = [];
  if (!AWS_REGION) missing.push("AWS_REGION");
  if (!AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  return missing.length
    ? `Missing required environment variables: ${missing.join(", ")}`
    : null;
}

function getClient() {
  if (!client) {
    client = new SESv2Client({
      region: AWS_REGION,
      credentials: AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }

  return client;
}

function isNonEmptyArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function sanitizeAddresses(addresses?: string[]) {
  if (!addresses) return undefined;
  const unique = Array.from(
    new Set(addresses.map((address) => address.trim()).filter(Boolean)),
  );
  return unique.length ? unique : undefined;
}

function buildEmailTags(tags?: EmailTag[]) {
  if (!tags?.length) return undefined;
  return tags.slice(0, 50).map((tag) => ({
    Name: tag.key,
    Value: tag.value,
  }));
}

export async function sendEmail(payload: EmailRequest) {
  const envError = getEmailEnvError();
  if (envError) throw new Error(envError);

  if (!isNonEmptyArray(payload.to)) {
    throw new Error('Field "to" must be a non-empty string array');
  }

  if (!payload.subject?.trim()) {
    throw new Error('Field "subject" is required');
  }

  const from = (payload.from || SES_SENDER || "").trim();
  if (!from) {
    throw new Error('Missing sender. Provide "from" or set SES_SENDER secret');
  }

  if (!payload.text && !payload.html) {
    throw new Error('Provide at least one of "text" or "html"');
  }

  const command = new SendEmailCommand({
    FromEmailAddress: from,
    Destination: {
      ToAddresses: sanitizeAddresses(payload.to),
      CcAddresses: sanitizeAddresses(payload.cc),
      BccAddresses: sanitizeAddresses(payload.bcc),
    },
    ReplyToAddresses: sanitizeAddresses(payload.reply_to),
    EmailTags: buildEmailTags(payload.tags),
    ConfigurationSetName: SES_CONFIGURATION_SET || undefined,
    Content: {
      Simple: {
        Subject: {
          Data: payload.subject,
          Charset: "UTF-8",
        },
        Body: {
          ...(payload.text
            ? {
                Text: {
                  Data: payload.text,
                  Charset: "UTF-8",
                },
              }
            : {}),
          ...(payload.html
            ? {
                Html: {
                  Data: payload.html,
                  Charset: "UTF-8",
                },
              }
            : {}),
        },
      },
    },
  });

  const result = await getClient().send(command);

  return {
    messageId: result.MessageId ?? null,
  };
}
