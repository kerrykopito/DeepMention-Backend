import axios from "axios"
import https from "https"
import { SESClient, SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses"
import { httpError } from "../../lib/http_error"

type SendEmailInput = {
    to: string
    subject: string
    html: string
    text?: string
    attachments?: Array<{
        name: string
        content: Buffer
    }>
}

/** Machine code for "the mail provider refused the send", which is never the caller's fault. */
export const EMAIL_DELIVERY_FAILED = "EMAIL_DELIVERY_FAILED"

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

function getBrevoHttpsAgent() {
    return new https.Agent({
        rejectUnauthorized: process.env.BREVO_TLS_REJECT_UNAUTHORIZED === "true",
    })
}

type BrevoSendResponse = {
    messageId?: string
}

export async function sendEmail(input: SendEmailInput & { awsConfig?: { region: string, accessKey: string, secretKey: string, source: string } }) {
    const provider = process.env.EMAIL_PROVIDER ?? "brevo"
    if (provider !== "brevo" && provider !== "ses") {
        throw new Error(`Unsupported email provider: ${provider}`)
    }

    if (provider === "ses") {
        const region = input.awsConfig?.region || process.env.AWS_SES_REGION || "ap-south-1"
        const accessKeyId = input.awsConfig?.accessKey || process.env.AWS_ACCESS_KEY_ID
        const secretAccessKey = input.awsConfig?.secretKey || process.env.AWS_SECRET_ACCESS_KEY
        
        if (!accessKeyId || !secretAccessKey) {
            throw new Error("AWS SES credentials not configured")
        }

        const sesClient = new SESClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            }
        })

        const source = input.awsConfig?.source || `${process.env.EMAIL_FROM_NAME ?? "DeepMention"} <${process.env.EMAIL_FROM_ADDRESS}>`

        const command = new SendEmailCommand({
            Source: source,
            Destination: {
                ToAddresses: [input.to]
            },
            Message: {
                Subject: { Data: input.subject, Charset: "UTF-8" },
                Body: {
                    Html: { Data: input.html, Charset: "UTF-8" },
                    ...(input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {})
                }
            }
        })

        try {
            const response = await sesClient.send(command)
            return { messageId: response.MessageId }
        } catch (error) {
            console.error("AWS SES email send failed", error)
            throw error
        }
    }

    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) {
        throw new Error("BREVO_API_KEY is not configured")
    }

    // Brevo rejects any sender it hasn't verified, so a default address would fail upstream
    // with a confusing error rather than here, where the cause is obvious.
    const fromEmail = process.env.EMAIL_FROM_ADDRESS
    if (!fromEmail) {
        throw new Error("EMAIL_FROM_ADDRESS is not configured; it must be an address verified in Brevo")
    }
    const fromName = process.env.EMAIL_FROM_NAME ?? "DeepMention"

    try {
        const response = await axios.post<BrevoSendResponse>(
            BREVO_API_URL,
            {
                sender: {
                    name: fromName,
                    email: fromEmail,
                },
                to: [{ email: input.to }],
                subject: input.subject,
                htmlContent: input.html,
                textContent: input.text,
                attachment: input.attachments?.map(attachment => ({
                    name: attachment.name,
                    content: attachment.content.toString("base64"),
                })),
            },
            {
                httpsAgent: getBrevoHttpsAgent(),
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json",
                },
                timeout: 15000,
            },
        )
        return response.data
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status
            const data = error.response?.data as { code?: string; message?: string } | undefined
            const brevoMessage = data?.message ?? error.message
            console.error("Brevo email send failed", {
                status,
                code: data?.code,
                message: brevoMessage,
                fromEmail,
                to: input.to,
            })
            // Tagged rather than reworded: the provider's own text is useful in the logs and
            // must never reach a client, so the callers answer 502 with a sentence of their
            // own. They select on the code, which is what they used to do by looking for
            // "Brevo email send failed" inside this message.
            throw httpError(502, `Brevo email send failed${status ? ` (${status})` : ""}: ${brevoMessage}`, EMAIL_DELIVERY_FAILED)
        }
        throw error
    }
}

export async function sendVerificationOtpEmail(email: string, otp: string) {
    await sendEmail({
        to: email,
        subject: `Welcome to DeepMention — your code is ${otp}`,
        text: `Welcome to DeepMention!\n\nYour verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not create an account, you can safely ignore this email.`,
        html: `
            <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b1220;padding:32px 16px;color:#0f172a">
                <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(2,6,23,.35)">
                    <div style="background:linear-gradient(135deg,#111827,#2563eb);padding:28px 32px;color:#ffffff">
                        <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe">DeepMention</p>
                        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#ffffff">Welcome aboard 👋</h1>
                    </div>
                    <div style="padding:32px">
                        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">Thanks for signing up. Enter this code to verify your email and finish creating your workspace:</p>
                        <div style="font-size:34px;font-weight:800;letter-spacing:.22em;color:#111827;background:#f1f5f9;border:1px solid #dbe4ef;border-radius:14px;padding:20px;text-align:center">${otp}</div>
                        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b">This code expires in <strong>10 minutes</strong>. If you did not request it, you can safely ignore this email — no account will be created.</p>
                    </div>
                    <div style="padding:16px 32px;border-top:1px solid #eef2f7;background:#f8fafc">
                        <p style="margin:0;font-size:12px;color:#94a3b8">Sent by DeepMention · welcome@deepmention.xyz</p>
                    </div>
                </div>
            </div>
        `,
    })
}

export async function sendAgencyInvitationEmail(email: string, agencyEmail: string, inviteUrl: string) {
    await sendEmail({
        to: email,
        subject: `${agencyEmail} invited you to DeepMention`,
        text: `${agencyEmail} invited you to collaborate in DeepMention. Accept your invitation here: ${inviteUrl}`,
        html: `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:28px;color:#0f172a"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px"><p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">DeepMention</p><h1 style="margin:0 0 12px;font-size:24px">You have a new workspace invitation</h1><p style="color:#475569;line-height:1.6">${agencyEmail} invited you to collaborate with their agency in DeepMention.</p><a href="${inviteUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">Accept invitation</a><p style="font-size:13px;color:#64748b;line-height:1.6">This invitation expires in 7 days.</p></div></div>`,
    })
}
