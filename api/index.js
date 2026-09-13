const __importMetaUrl = require('url').pathToFileURL(__filename).href;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/prisma.ts
var prisma_exports = {};
__export(prisma_exports, {
  default: () => prisma_default
});
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const ssl = connectionString.includes("supabase.co") ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
    ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA : process.env.DB_SSL_CA_PATH ? import_node_fs.default.readFileSync(process.env.DB_SSL_CA_PATH, "utf8") : void 0
  } : void 0;
  const adapter = new import_adapter_pg.PrismaPg({ connectionString, ssl });
  return new import_client.PrismaClient({ adapter });
}
var import_node_fs, import_client, import_adapter_pg, globalForPrisma, prisma, prisma_default;
var init_prisma = __esm({
  "src/lib/prisma.ts"() {
    import_node_fs = __toESM(require("node:fs"), 1);
    import_client = require("@prisma/client");
    import_adapter_pg = require("@prisma/adapter-pg");
    globalForPrisma = globalThis;
    prisma = globalForPrisma.prisma ?? createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prisma;
    }
    prisma_default = prisma;
  }
});

// src/utils/jwt.ts
function generateAccessToken(userId) {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "12h";
  return import_jsonwebtoken.default.sign({ sub: userId }, ACCESS_SECRET, { expiresIn });
}
function generateRefreshToken(userId) {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";
  return import_jsonwebtoken.default.sign({ sub: userId }, REFRESH_SECRET, { expiresIn });
}
var import_jsonwebtoken, ACCESS_SECRET, REFRESH_SECRET;
var init_jwt = __esm({
  "src/utils/jwt.ts"() {
    import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
    ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
    REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
  }
});

// src/features/email/email_service.ts
function getBrevoHttpsAgent() {
  return new import_https.default.Agent({
    rejectUnauthorized: process.env.BREVO_TLS_REJECT_UNAUTHORIZED === "true"
  });
}
async function sendEmail(input) {
  const provider = process.env.EMAIL_PROVIDER ?? "brevo";
  if (provider !== "brevo" && provider !== "ses") {
    throw new Error(`Unsupported email provider: ${provider}`);
  }
  if (provider === "ses") {
    const region = input.awsConfig?.region || process.env.AWS_SES_REGION || "ap-south-1";
    const accessKeyId = input.awsConfig?.accessKey || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = input.awsConfig?.secretKey || process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS SES credentials not configured");
    }
    const sesClient = new import_client_ses.SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    const source = input.awsConfig?.source || `${process.env.EMAIL_FROM_NAME ?? "DeepMention"} <${process.env.EMAIL_FROM_ADDRESS}>`;
    const command = new import_client_ses.SendEmailCommand({
      Source: source,
      Destination: {
        ToAddresses: [input.to]
      },
      Message: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          ...input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {}
        }
      }
    });
    try {
      const response = await sesClient.send(command);
      return { messageId: response.MessageId };
    } catch (error) {
      console.error("AWS SES email send failed", error);
      throw error;
    }
  }
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  if (!fromEmail) {
    throw new Error("EMAIL_FROM_ADDRESS is not configured; it must be an address verified in Brevo");
  }
  const fromName = process.env.EMAIL_FROM_NAME ?? "DeepMention";
  try {
    const response = await import_axios.default.post(
      BREVO_API_URL,
      {
        sender: {
          name: fromName,
          email: fromEmail
        },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        attachment: input.attachments?.map((attachment) => ({
          name: attachment.name,
          content: attachment.content.toString("base64")
        }))
      },
      {
        httpsAgent: getBrevoHttpsAgent(),
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 15e3
      }
    );
    return response.data;
  } catch (error) {
    if (import_axios.default.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const brevoMessage = data?.message ?? error.message;
      console.error("Brevo email send failed", {
        status,
        code: data?.code,
        message: brevoMessage,
        fromEmail,
        to: input.to
      });
      throw new Error(`Brevo email send failed${status ? ` (${status})` : ""}: ${brevoMessage}`);
    }
    throw error;
  }
}
async function sendVerificationOtpEmail(email, otp) {
  await sendEmail({
    to: email,
    subject: `Welcome to DeepMention \u2014 your code is ${otp}`,
    text: `Welcome to DeepMention!

Your verification code is ${otp}. It expires in 10 minutes.

If you did not create an account, you can safely ignore this email.`,
    html: `
            <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b1220;padding:32px 16px;color:#0f172a">
                <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(2,6,23,.35)">
                    <div style="background:linear-gradient(135deg,#111827,#2563eb);padding:28px 32px;color:#ffffff">
                        <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe">DeepMention</p>
                        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#ffffff">Welcome aboard \u{1F44B}</h1>
                    </div>
                    <div style="padding:32px">
                        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">Thanks for signing up. Enter this code to verify your email and finish creating your workspace:</p>
                        <div style="font-size:34px;font-weight:800;letter-spacing:.22em;color:#111827;background:#f1f5f9;border:1px solid #dbe4ef;border-radius:14px;padding:20px;text-align:center">${otp}</div>
                        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b">This code expires in <strong>10 minutes</strong>. If you did not request it, you can safely ignore this email \u2014 no account will be created.</p>
                    </div>
                    <div style="padding:16px 32px;border-top:1px solid #eef2f7;background:#f8fafc">
                        <p style="margin:0;font-size:12px;color:#94a3b8">Sent by DeepMention \xB7 welcome@deepmention.xyz</p>
                    </div>
                </div>
            </div>
        `
  });
}
async function sendAgencyInvitationEmail(email, agencyEmail, inviteUrl) {
  await sendEmail({
    to: email,
    subject: `${agencyEmail} invited you to DeepMention`,
    text: `${agencyEmail} invited you to collaborate in DeepMention. Accept your invitation here: ${inviteUrl}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:28px;color:#0f172a"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px"><p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">DeepMention</p><h1 style="margin:0 0 12px;font-size:24px">You have a new workspace invitation</h1><p style="color:#475569;line-height:1.6">${agencyEmail} invited you to collaborate with their agency in DeepMention.</p><a href="${inviteUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">Accept invitation</a><p style="font-size:13px;color:#64748b;line-height:1.6">This invitation expires in 7 days.</p></div></div>`
  });
}
var import_axios, import_https, import_client_ses, BREVO_API_URL;
var init_email_service = __esm({
  "src/features/email/email_service.ts"() {
    import_axios = __toESM(require("axios"), 1);
    import_https = __toESM(require("https"), 1);
    import_client_ses = require("@aws-sdk/client-ses");
    BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
  }
});

// src/features/subscription/plan_config.ts
var PLAN_LIMITS, CREDIT_COSTS;
var init_plan_config = __esm({
  "src/features/subscription/plan_config.ts"() {
    PLAN_LIMITS = {
      FREE: {
        projects: 1,
        prompts: 5,
        competitors: 3,
        refreshes_per_week: 0,
        exports: "none",
        credits: 0,
        engine_limit: 3
      },
      STARTER: {
        projects: 1,
        prompts: 15,
        competitors: 3,
        refreshes_per_week: "daily",
        exports: "full",
        credits: 2250,
        engine_limit: "all"
      },
      GROWTH: {
        projects: 2,
        prompts: 30,
        competitors: 6,
        refreshes_per_week: "daily",
        exports: "full",
        credits: 5e3,
        engine_limit: "all"
      },
      PRO: {
        projects: 5,
        prompts: 75,
        competitors: 15,
        refreshes_per_week: "daily",
        exports: "full",
        credits: 13e3,
        engine_limit: "all"
      }
      // Agency is a dedicated Pay-As-You-Go plan.
      // No base credits — agencies buy credits as they consume them across client projects.
    };
    CREDIT_COSTS = {
      prompt_run: 3,
      // legacy individual fallback; live charges use the account-aware policy
      dashboard_export_xlsx: 1,
      dashboard_export_pdf: 0,
      geo_article_pdf: 0,
      ai_visibility_report: 25,
      ai_report_ppt: 0,
      content_brief: 15,
      full_article: 30,
      weekly_email_report: 25,
      reddit_intelligence_standard: 25,
      reddit_intelligence_deep: 50,
      seo_audit: 15
    };
  }
});

// src/features/subscription/entitlements.ts
function addFreeTrialDays(date) {
  return new Date(date.getTime() + FREE_TRIAL_DAYS * MS_PER_DAY);
}
async function ensureFreeTrialSubscription(userId) {
  const existing = await prisma_default.subscription.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: { id: true }
  });
  if (existing) return existing;
  const startsAt = /* @__PURE__ */ new Date();
  const endsAt = addFreeTrialDays(startsAt);
  return prisma_default.subscription.create({
    data: {
      user_id: userId,
      plan: import_client2.Plan.GROWTH,
      status: import_client2.SubscriptionStatus.TRIALING,
      amount_cents: 0,
      trial_starts_at: startsAt,
      trial_ends_at: endsAt,
      current_period_start: startsAt,
      current_period_end: endsAt
    },
    select: { id: true }
  });
}
async function getEffectivePlanAccess(userId) {
  const subscriptions = await prisma_default.subscription.findMany({
    where: {
      user_id: userId,
      status: {
        in: [
          import_client2.SubscriptionStatus.ACTIVE,
          import_client2.SubscriptionStatus.TRIALING,
          import_client2.SubscriptionStatus.PAST_DUE,
          import_client2.SubscriptionStatus.INCOMPLETE
        ]
      }
    },
    orderBy: { created_at: "desc" },
    take: 10,
    select: {
      id: true,
      plan: true,
      status: true,
      amount_cents: true,
      stripe_subscription_id: true,
      current_period_start: true,
      current_period_end: true,
      cancel_at_period_end: true,
      trial_starts_at: true,
      trial_ends_at: true
    }
  });
  if (subscriptions.length === 0) {
    const user = await prisma_default.user.findUnique({
      where: { id: userId },
      select: { is_verified: true, plan: true }
    });
    if (user?.is_verified && user.plan === import_client2.Plan.FREE) {
      await ensureFreeTrialSubscription(userId);
      return getEffectivePlanAccess(userId);
    }
  }
  const now = /* @__PURE__ */ new Date();
  const activePaidSubscription = subscriptions.find(
    (subscription2) => subscription2.status === import_client2.SubscriptionStatus.ACTIVE || subscription2.status === import_client2.SubscriptionStatus.PAST_DUE
  );
  const activeTrialSubscription = subscriptions.find(
    (subscription2) => subscription2.status === import_client2.SubscriptionStatus.TRIALING && (subscription2.trial_ends_at ?? addFreeTrialDays(subscription2.trial_starts_at)).getTime() > now.getTime()
  );
  const latestExpiredTrial = subscriptions.find(
    (subscription2) => subscription2.status === import_client2.SubscriptionStatus.TRIALING && (subscription2.trial_ends_at ?? addFreeTrialDays(subscription2.trial_starts_at)).getTime() <= now.getTime()
  );
  const subscription = activePaidSubscription ?? activeTrialSubscription ?? subscriptions[0] ?? null;
  const trialStartsAt = subscription?.trial_starts_at ?? null;
  const trialEndsAt = subscription?.trial_ends_at ?? (trialStartsAt ? addFreeTrialDays(trialStartsAt) : null);
  const isTrialStatus = subscription?.status === import_client2.SubscriptionStatus.TRIALING;
  const trialActive = Boolean(isTrialStatus && trialEndsAt && trialEndsAt.getTime() > now.getTime());
  const trialExpired = Boolean(
    !activePaidSubscription && !activeTrialSubscription && latestExpiredTrial
  );
  const paidAccess = Boolean(subscription && (subscription.status === import_client2.SubscriptionStatus.ACTIVE || subscription.status === import_client2.SubscriptionStatus.PAST_DUE));
  const isFreeProductTrial = Boolean(trialActive && !subscription?.stripe_subscription_id && subscription?.amount_cents === 0);
  const effectivePlan = trialActive ? import_client2.Plan.GROWTH : paidAccess ? subscription.plan : import_client2.Plan.FREE;
  const limits = isFreeProductTrial ? { ...PLAN_LIMITS.GROWTH, prompts: PLAN_LIMITS.FREE.prompts } : PLAN_LIMITS[effectivePlan];
  return {
    plan: isFreeProductTrial ? import_client2.Plan.FREE : effectivePlan,
    effective_plan: effectivePlan,
    status: isFreeProductTrial ? "FREE_TRIAL" : trialExpired ? "TRIAL_EXPIRED" : subscription?.status ?? "FREE",
    subscription: subscription ? {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_starts_at: subscription.trial_starts_at,
      trial_ends_at: subscription.trial_ends_at
    } : null,
    limits,
    trial: {
      active: isFreeProductTrial,
      expired: trialExpired,
      starts_at: latestExpiredTrial?.trial_starts_at ?? trialStartsAt,
      ends_at: latestExpiredTrial?.trial_ends_at ?? trialEndsAt,
      days_left: isFreeProductTrial && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY)) : 0
    }
  };
}
async function getAccessPeriod(userId) {
  const access = await getEffectivePlanAccess(userId);
  const now = /* @__PURE__ */ new Date();
  return {
    start: access.subscription?.current_period_start ?? access.trial.starts_at ?? new Date(now.getFullYear(), now.getMonth(), 1),
    end: access.subscription?.current_period_end ?? access.trial.ends_at ?? new Date(now.getFullYear(), now.getMonth() + 1, 1)
  };
}
var import_client2, FREE_TRIAL_DAYS, MS_PER_DAY;
var init_entitlements = __esm({
  "src/features/subscription/entitlements.ts"() {
    import_client2 = require("@prisma/client");
    init_prisma();
    init_plan_config();
    FREE_TRIAL_DAYS = 7;
    MS_PER_DAY = 24 * 60 * 60 * 1e3;
  }
});

// src/features/payments/credits_config.ts
function creditPolicyFor(accountType) {
  return ACCOUNT_CREDIT_POLICY[accountType];
}
function signupBonusFor(accountType) {
  return 105 * creditPolicyFor(accountType).prompt_run;
}
function getCreditPack(id) {
  return [...CREDIT_PACKS, ...AGENCY_CREDIT_PACKS].find((p) => p.id === id) ?? null;
}
function getCustomCreditPack(credits, accountType = import_client3.AccountType.SINGLE) {
  if (!Number.isInteger(credits) || credits < 1e3 || credits > 1e6) return null;
  const agencyRate = credits >= 15e3 ? 0.7 : credits >= 7500 ? 0.7332 : credits >= 3e3 ? 0.7664 : 1;
  const rate = accountType === import_client3.AccountType.AGENCY ? agencyRate : 1;
  const amountEUR = Math.ceil(credits * rate);
  return {
    id: `custom_${credits}`,
    label: `${credits.toLocaleString("en-IN")} Credits`,
    amount_EUR: amountEUR,
    credits,
    bonus_credits: 0
  };
}
var import_client3, ACCOUNT_CREDIT_POLICY, CREDIT_PACKS, AGENCY_CREDIT_PACKS, LOW_BALANCE_THRESHOLD;
var init_credits_config = __esm({
  "src/features/payments/credits_config.ts"() {
    import_client3 = require("@prisma/client");
    ACCOUNT_CREDIT_POLICY = {
      [import_client3.AccountType.SINGLE]: {
        prompt_run: 1,
        seo_provider_credits_per_usd: 180,
        site_audit: { quick: 4, standard: 8, deep: 15 }
      },
      [import_client3.AccountType.AGENCY]: {
        prompt_run: 1,
        seo_provider_credits_per_usd: 150,
        site_audit: { quick: 3, standard: 6, deep: 12 }
      }
    };
    CREDIT_PACKS = [
      {
        id: "pack_1000",
        label: "1,000 Credits",
        amount_EUR: 1e3,
        credits: 1e3,
        bonus_credits: 0
      },
      {
        id: "pack_3000",
        label: "3,000 Credits",
        amount_EUR: 2500,
        credits: 3e3,
        bonus_credits: 0
      },
      {
        id: "pack_10000",
        label: "10,000 Credits",
        amount_EUR: 8e3,
        credits: 1e4,
        bonus_credits: 0
      }
    ];
    AGENCY_CREDIT_PACKS = [
      {
        id: "agency_1000",
        label: "1,000 Agency Credits",
        amount_EUR: 1e3,
        credits: 1e3,
        bonus_credits: 0
      },
      {
        id: "agency_3000",
        label: "3,000 Agency Credits",
        amount_EUR: 2300,
        credits: 3e3,
        bonus_credits: 0
      },
      {
        id: "agency_7500",
        label: "7,500 Agency Credits",
        amount_EUR: 5500,
        credits: 7500,
        bonus_credits: 0
      },
      {
        id: "agency_15000",
        label: "15,000 Agency Credits",
        amount_EUR: 10500,
        credits: 15e3,
        bonus_credits: 0
      }
    ];
    LOW_BALANCE_THRESHOLD = 50;
  }
});

// src/features/payments/billing_catalog.ts
function getBillingPlan(plan) {
  return BILLING_PLANS[plan];
}
function publicBillingCatalog(accountType) {
  const policy = creditPolicyFor(accountType);
  return {
    currency: "EUR",
    annual_discount_percent: 10,
    account_type: accountType,
    wallet_mode: accountType === import_client4.AccountType.AGENCY ? "SHARED_AGENCY" : "INDIVIDUAL",
    credit_policy: {
      successful_ai_engine_check: policy.prompt_run,
      seo_provider_credits_per_usd: policy.seo_provider_credits_per_usd,
      site_audit: policy.site_audit,
      failed_provider_run: 0,
      cached_report: 0
    },
    plans: (accountType === import_client4.AccountType.AGENCY ? [] : Object.values(BILLING_PLANS)).map((plan) => ({
      ...plan,
      annual_effective_monthly_EUR: Math.floor(plan.annual_amount_EUR / 12),
      annual_credits: plan.monthly_credits * 12,
      annual_credit_delivery: "monthly"
    }))
  };
}
var import_client4, BILLING_PLANS;
var init_billing_catalog = __esm({
  "src/features/payments/billing_catalog.ts"() {
    import_client4 = require("@prisma/client");
    init_credits_config();
    BILLING_PLANS = {
      STARTER: {
        id: import_client4.Plan.STARTER,
        name: "Starter",
        monthly_amount_EUR: 5e3,
        annual_amount_EUR: 54e3,
        monthly_credits: 2250,
        base_credits: 2250,
        bonus_credits: 0,
        detail: "For validating one brand",
        expiry: "Included credits reset each month"
      },
      GROWTH: {
        id: import_client4.Plan.GROWTH,
        name: "Growth",
        monthly_amount_EUR: 8e3,
        annual_amount_EUR: 86400,
        monthly_credits: 5e3,
        base_credits: 4500,
        bonus_credits: 500,
        detail: "Best-value monthly capacity",
        expiry: "Unused included credits roll over"
      },
      PRO: {
        id: import_client4.Plan.PRO,
        name: "Pro",
        monthly_amount_EUR: 11e3,
        annual_amount_EUR: 118800,
        monthly_credits: 13e3,
        base_credits: 11250,
        bonus_credits: 1750,
        detail: "For higher-capacity teams and agencies",
        expiry: "Unused included credits roll over"
      }
    };
  }
});

// src/features/subscription/stripe_config.ts
function getStripeClient() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  stripeClient = new import_stripe.default(key);
  return stripeClient;
}
function getStripePrice(plan, interval) {
  const config = PRICES[plan][interval];
  const priceId = process.env[config.env] ?? (config.legacy_env ? process.env[config.legacy_env] : void 0);
  if (!priceId) throw new Error(`${config.env} is required`);
  return { price_id: priceId, amount_cents: config.amount_cents };
}
function getStripeId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}
var import_stripe, stripeClient, PRICES;
var init_stripe_config = __esm({
  "src/features/subscription/stripe_config.ts"() {
    import_stripe = __toESM(require("stripe"), 1);
    stripeClient = null;
    PRICES = {
      STARTER: {
        monthly: { amount_cents: 5e3, env: "STRIPE_STARTER_MONTHLY_PRICE_ID", legacy_env: "STRIPE_STARTER_PRICE_ID" },
        annual: { amount_cents: 54e3, env: "STRIPE_STARTER_ANNUAL_PRICE_ID" }
      },
      GROWTH: {
        monthly: { amount_cents: 8e3, env: "STRIPE_GROWTH_MONTHLY_PRICE_ID", legacy_env: "STRIPE_GROWTH_PRICE_ID" },
        annual: { amount_cents: 86400, env: "STRIPE_GROWTH_ANNUAL_PRICE_ID" }
      },
      PRO: {
        monthly: { amount_cents: 11e3, env: "STRIPE_PRO_MONTHLY_PRICE_ID", legacy_env: "STRIPE_PRO_PRICE_ID" },
        annual: { amount_cents: 118800, env: "STRIPE_PRO_ANNUAL_PRICE_ID" }
      }
    };
  }
});

// src/features/payments/credits_service.ts
async function getBillingAccountContext(userId) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { account_type: true } });
  if (user?.account_type === import_client5.AccountType.AGENCY) return { billingUserId: userId, accountType: import_client5.AccountType.AGENCY };
  const membership = await prisma_default.agencyMembership.findFirst({ where: { member_user_id: userId, status: "ACTIVE" }, select: { agency_user_id: true } });
  const clientLink = membership ? null : await prisma_default.agencyClientLink.findFirst({ where: { client_user_id: userId, status: "ACTIVE" }, select: { agency_user_id: true } });
  const billingUserId = membership?.agency_user_id ?? clientLink?.agency_user_id ?? userId;
  if (billingUserId === userId) return { billingUserId, accountType: user?.account_type ?? import_client5.AccountType.SINGLE };
  const owner = await prisma_default.user.findUnique({ where: { id: billingUserId }, select: { account_type: true } });
  return { billingUserId, accountType: owner?.account_type ?? import_client5.AccountType.AGENCY };
}
async function resolveBillingUserId(userId) {
  return (await getBillingAccountContext(userId)).billingUserId;
}
async function getPromptRunCreditCost(userId) {
  const { accountType } = await getBillingAccountContext(userId);
  return creditPolicyFor(accountType).prompt_run;
}
async function expireCreditBuckets(userId) {
  const now = /* @__PURE__ */ new Date();
  const expired = await prisma_default.creditBucket.findMany({ where: { user_id: userId, amount_remaining: { gt: 0 }, expires_at: { lte: now } }, select: { id: true, amount_remaining: true, source: true } });
  if (!expired.length) return 0;
  const amount = expired.reduce((sum, bucket) => sum + bucket.amount_remaining, 0);
  await prisma_default.$transaction(async (tx) => {
    await tx.creditBucket.updateMany({ where: { id: { in: expired.map((bucket) => bucket.id) } }, data: { amount_remaining: 0 } });
    await tx.user.update({ where: { id: userId }, data: { credits_balance: { decrement: amount } } });
    await tx.creditTransaction.create({ data: { user_id: userId, amount: -amount, action: "CREDIT_EXPIRY", description: `${expired.map((bucket) => bucket.source).join(", ")} credits expired`, metadata: { expired_at: now.toISOString() } } });
  });
  return amount;
}
async function createCreditBucket(userId, amount, source, expiresAt = null) {
  if (amount <= 0) return;
  await prisma_default.creditBucket.create({ data: { user_id: userId, amount_remaining: amount, source, expires_at: expiresAt } });
}
async function getCreditBalance(userId) {
  const billingUserId = await resolveBillingUserId(userId);
  await expireCreditBuckets(billingUserId);
  const user = await prisma_default.user.findUnique({
    where: { id: billingUserId },
    select: { credits_balance: true }
  });
  return user?.credits_balance ?? 0;
}
async function awardCredits(userId, amount, action, description, metadata) {
  const billingUserId = await resolveBillingUserId(userId);
  await expireCreditBuckets(billingUserId);
  const [updatedUser] = await prisma_default.$transaction([
    prisma_default.user.update({
      where: { id: billingUserId },
      data: { credits_balance: { increment: amount } },
      select: { credits_balance: true }
    }),
    prisma_default.creditTransaction.create({
      data: {
        user_id: billingUserId,
        amount: +amount,
        action,
        description: description ?? action,
        metadata: metadata ? metadata : void 0
      }
    })
  ]);
  await createCreditBucket(billingUserId, amount, action, null);
  return updatedUser.credits_balance;
}
async function ensureSignupBonusCredits(userId) {
  const billingUserId = await resolveBillingUserId(userId);
  await expireCreditBuckets(billingUserId);
  const user = await prisma_default.user.findUnique({
    where: { id: billingUserId },
    select: { credits_balance: true, is_verified: true, account_type: true }
  });
  if (!user) return 0;
  if (!user.is_verified) return user.credits_balance;
  const existingBonus = await prisma_default.creditTransaction.findFirst({
    where: {
      user_id: billingUserId,
      action: "SIGNUP_BONUS"
    },
    select: { id: true }
  });
  if (existingBonus) return user.credits_balance;
  if (user.credits_balance > 0) return user.credits_balance;
  const signupBonus = signupBonusFor(user.account_type);
  return awardCredits(
    billingUserId,
    signupBonus,
    "SIGNUP_BONUS",
    `${signupBonus} free trial credits`,
    { source: "trial_onboarding_guard" }
  );
}
async function isLowBalance(userId) {
  const balance = await getCreditBalance(userId);
  return balance < LOW_BALANCE_THRESHOLD;
}
async function getCreditTransactions(userId, page = 1, limit = 20, options = {}) {
  const billingUserId = await resolveBillingUserId(userId);
  const skip = (page - 1) * limit;
  const safeDays = options.days ? Math.min(Math.max(options.days, 1), 30) : void 0;
  const createdAt = safeDays ? { gte: new Date(Date.now() - safeDays * 24 * 60 * 60 * 1e3) } : void 0;
  const amount = options.type === "credit" ? { gt: 0 } : options.type === "debit" ? { lt: 0 } : void 0;
  const where = {
    user_id: billingUserId,
    ...createdAt ? { created_at: createdAt } : {},
    ...amount ? { amount } : {}
  };
  const [transactions, total] = await Promise.all([
    prisma_default.creditTransaction.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        amount: true,
        action: true,
        description: true,
        metadata: true,
        created_at: true
      }
    }),
    prisma_default.creditTransaction.count({ where })
  ]);
  return { transactions, total };
}
async function getBillingAudience(userId) {
  const billingUserId = await resolveBillingUserId(userId);
  const user = await prisma_default.user.findUnique({ where: { id: billingUserId }, select: { account_type: true } });
  return user?.account_type ?? import_client5.AccountType.SINGLE;
}
function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}
async function grantSubscriptionCredits(subscriptionId, grantKey, scheduledFor) {
  const subscription = await prisma_default.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.status === import_client5.SubscriptionStatus.CANCELED) return { granted: false, credits: 0 };
  const plan = subscription.plan;
  const credits = getBillingPlan(plan).monthly_credits;
  const expiresAt = plan === import_client5.Plan.STARTER ? addMonths(scheduledFor, 1) : null;
  try {
    await prisma_default.$transaction(async (tx) => {
      await tx.subscriptionCreditGrant.create({
        data: { subscription_id: subscription.id, grant_key: grantKey, credits, scheduled_for: scheduledFor }
      });
      await tx.user.update({
        where: { id: subscription.user_id },
        data: { credits_balance: { increment: credits }, plan }
      });
      await tx.creditTransaction.create({
        data: {
          user_id: subscription.user_id,
          idempotency_key: grantKey,
          amount: credits,
          action: "PLAN_CREDITS",
          description: `${getBillingPlan(plan).name} included credits`,
          metadata: {
            idempotency_key: grantKey,
            subscription_id: subscription.id,
            billing_interval: subscription.billing_interval,
            scheduled_for: scheduledFor.toISOString()
          }
        }
      });
      await tx.creditBucket.create({
        data: {
          user_id: subscription.user_id,
          amount_remaining: credits,
          source: `${plan}_INCLUDED`,
          expires_at: expiresAt
        }
      });
    });
    return { granted: true, credits };
  } catch (error) {
    if (error instanceof import_client5.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { granted: false, credits: 0 };
    }
    throw error;
  }
}
async function grantDueAnnualSubscriptionCreditsForUser(actorUserId) {
  const userId = await resolveBillingUserId(actorUserId);
  const now = /* @__PURE__ */ new Date();
  const due = await prisma_default.subscription.findMany({
    where: {
      user_id: userId,
      billing_interval: "annual",
      status: import_client5.SubscriptionStatus.ACTIVE,
      next_credit_grant_at: { lte: now },
      current_period_end: { gt: now }
    }
  });
  for (const subscription of due) {
    let scheduledFor = subscription.next_credit_grant_at;
    while (scheduledFor <= now && (!subscription.current_period_end || scheduledFor < subscription.current_period_end)) {
      const key = `annual-tranche:${subscription.id}:${scheduledFor.toISOString().slice(0, 10)}`;
      await grantSubscriptionCredits(subscription.id, key, scheduledFor);
      scheduledFor = addMonths(scheduledFor, 1);
    }
    await prisma_default.subscription.update({ where: { id: subscription.id }, data: { next_credit_grant_at: scheduledFor } });
  }
}
async function createCreditPackCheckoutSession(userId, input, requestId) {
  const accountType = await getBillingAudience(userId);
  const pack = input.pack_id ? getCreditPack(input.pack_id) : input.custom_credits ? getCustomCreditPack(input.custom_credits, accountType) : null;
  if (!pack) throw new Error("Invalid credit pack");
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw new Error("User not found");
  const stripe = getStripeClient();
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const automaticTax = process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
  const totalCredits = pack.credits + pack.bonus_credits;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: pack.amount_EUR,
          product_data: { name: pack.label }
        },
        quantity: 1
      }
    ],
    success_url: `${frontendUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/billing?checkout=cancelled`,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: automaticTax },
    metadata: {
      user_id: user.id,
      pack_id: pack.id,
      credits: String(totalCredits)
    }
  }, requestId ? { idempotencyKey: `credit-pack-checkout:${user.id}:${requestId}` } : void 0);
  if (!session.url) throw new Error("Stripe checkout session URL was not created");
  return {
    checkout_session_id: session.id,
    checkout_url: session.url,
    pack_id: pack.id,
    credits: totalCredits
  };
}
async function awardCreditPackFromCheckoutSession(session) {
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const packId = session.metadata?.pack_id;
  const credits = Number(session.metadata?.credits);
  if (!userId || !packId || !Number.isFinite(credits) || credits <= 0) {
    throw new Error("Checkout session is missing credit pack metadata");
  }
  await awardCredits(userId, credits, "CREDIT_PACK_PURCHASE", `Purchased ${packId}`, {
    pack_id: packId,
    checkout_session_id: session.id
  });
}
var import_client5, InsufficientCreditsError;
var init_credits_service = __esm({
  "src/features/payments/credits_service.ts"() {
    init_prisma();
    import_client5 = require("@prisma/client");
    init_credits_config();
    init_billing_catalog();
    init_stripe_config();
    InsufficientCreditsError = class extends Error {
      constructor(required, available) {
        super(`Insufficient credits: need ${required}, have ${available}`);
        this.name = "InsufficientCreditsError";
      }
    };
  }
});

// src/features/credits/credits_service.ts
function assertPositiveAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer");
  }
}
async function spendCredits(input) {
  assertPositiveAmount(input.amount);
  const billingUserId = await resolveBillingUserId(input.userId);
  const existing = await prisma_default.creditTransaction.findUnique({ where: { idempotency_key: input.idempotencyKey } });
  if (existing) return existing;
  const transaction = await prisma_default.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({
      where: { id: billingUserId, credits_balance: { gte: input.amount } },
      data: { credits_balance: { decrement: input.amount } }
    });
    if (debited.count === 0) {
      const user = await tx.user.findUnique({ where: { id: billingUserId }, select: { credits_balance: true } });
      throw new InsufficientCreditsError(input.amount, user?.credits_balance ?? 0);
    }
    const buckets = await tx.creditBucket.findMany({ where: { user_id: billingUserId, amount_remaining: { gt: 0 } }, orderBy: { created_at: "asc" } });
    let remaining2 = input.amount;
    for (const bucket of buckets.sort((a, b) => Number(a.expires_at === null) - Number(b.expires_at === null))) {
      if (remaining2 <= 0) break;
      const used = Math.min(bucket.amount_remaining, remaining2);
      await tx.creditBucket.update({ where: { id: bucket.id }, data: { amount_remaining: { decrement: used } } });
      remaining2 -= used;
    }
    return tx.creditTransaction.create({ data: { user_id: billingUserId, idempotency_key: input.idempotencyKey, amount: -input.amount, action: input.action, description: input.description ?? input.action, metadata: { idempotency_key: input.idempotencyKey, actor_user_id: input.userId, ...input.metadata ?? {} } } });
  });
  return transaction;
}
async function refundCredits(input) {
  assertPositiveAmount(input.amount);
  const billingUserId = await resolveBillingUserId(input.userId);
  const refundKey = `refund:${input.idempotencyKey}`;
  const existing = await prisma_default.creditTransaction.findUnique({ where: { idempotency_key: refundKey } });
  if (existing) return existing;
  const [, transaction] = await prisma_default.$transaction([
    prisma_default.user.update({
      where: { id: billingUserId },
      data: { credits_balance: { increment: input.amount } }
    }),
    prisma_default.creditTransaction.create({
      data: {
        user_id: billingUserId,
        idempotency_key: refundKey,
        amount: +input.amount,
        action: `REFUND_${input.action}`,
        description: input.description ?? `Refund: ${input.action}`,
        metadata: { idempotency_key: refundKey, original_key: input.idempotencyKey, actor_user_id: input.userId, ...input.metadata ?? {} }
      }
    })
  ]);
  await prisma_default.creditBucket.create({ data: { user_id: billingUserId, amount_remaining: input.amount, source: `REFUND_${input.action}`, expires_at: null } });
  return transaction;
}
async function getCreditBalance2(userId) {
  const billingUserId = await resolveBillingUserId(userId);
  const user = await prisma_default.user.findUnique({ where: { id: billingUserId }, select: { credits_balance: true, plan: true } });
  const balance = user?.credits_balance ?? 0;
  return {
    plan: user?.plan ?? "FREE",
    effective_plan: user?.plan ?? "FREE",
    monthly_credits: balance,
    // expose balance as "monthly_credits" for backward compat
    used: 0,
    // legacy field - not tracked anymore
    remaining: balance,
    period_start: null,
    period_end: null
  };
}
var init_credits_service2 = __esm({
  "src/features/credits/credits_service.ts"() {
    init_prisma();
    init_credits_service();
  }
});

// src/features/refresh/refresh_window.ts
function readTimeZone() {
  return process.env.REFRESH_TIMEZONE?.trim() || process.env.SCHEDULER_TIMEZONE?.trim() || DEFAULT_REFRESH_TIMEZONE;
}
function datePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day")
  };
}
function offsetMsAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  const zonedAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second")
  );
  return zonedAsUtc - date.getTime();
}
function zonedStartOfDayUtc(date, timeZone) {
  const parts = datePartsInTimeZone(date, timeZone);
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  const offset = offsetMsAt(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}
function getRefreshTimezone() {
  return readTimeZone();
}
function getRefreshWindowStart(now = /* @__PURE__ */ new Date()) {
  return zonedStartOfDayUtc(now, getRefreshTimezone());
}
var DEFAULT_REFRESH_TIMEZONE;
var init_refresh_window = __esm({
  "src/features/refresh/refresh_window.ts"() {
    DEFAULT_REFRESH_TIMEZONE = "Asia/Kolkata";
  }
});

// src/features/subscription/subscription_service.ts
function assertPaidPlan(plan) {
  if (plan !== import_client6.Plan.STARTER && plan !== import_client6.Plan.GROWTH && plan !== import_client6.Plan.PRO) {
    throw new Error("Invalid subscription plan");
  }
}
function mapStripeStatus(status) {
  if (status === "trialing") return import_client6.SubscriptionStatus.TRIALING;
  if (status === "active") return import_client6.SubscriptionStatus.ACTIVE;
  if (status === "past_due" || status === "unpaid") return import_client6.SubscriptionStatus.PAST_DUE;
  if (status === "canceled") return import_client6.SubscriptionStatus.CANCELED;
  return import_client6.SubscriptionStatus.INCOMPLETE;
}
function unixToDate(value) {
  return value ? new Date(value * 1e3) : null;
}
function toPaidPlan(plan) {
  assertPaidPlan(plan);
  return plan;
}
function buildCheck(feature, plan, limit, used, allowed, reason) {
  return { feature, plan, limit, used, allowed, reason };
}
function remaining(limit, used) {
  if (limit === "unlimited") return "unlimited";
  return Math.max(0, limit - used);
}
async function getLiveUsageCounts(userId) {
  const [projectCount, promptCount, competitorCount] = await Promise.all([
    prisma_default.project.count({ where: { user_id: userId } }),
    prisma_default.prompt.count({
      where: {
        project: { user_id: userId },
        is_active: true,
        status: "ACTIVE"
      }
    }),
    prisma_default.competitor.count({ where: { project: { user_id: userId } } })
  ]);
  return {
    project_count: projectCount,
    prompt_count: promptCount,
    competitor_count: competitorCount
  };
}
async function getCurrentPeriod(userId) {
  return getAccessPeriod(userId);
}
async function createSubscription(input) {
  assertPaidPlan(input.plan);
  if (input.billing_interval !== "monthly" && input.billing_interval !== "annual") throw new Error("Invalid billing interval");
  const stripe = getStripeClient();
  const stripePrice = getStripePrice(input.plan, input.billing_interval);
  const user = await prisma_default.user.findUnique({
    where: { id: input.user_id },
    select: { id: true, email: true }
  });
  if (!user) {
    throw new Error("User not found");
  }
  const activeSubscription = await prisma_default.subscription.findFirst({
    where: {
      user_id: user.id,
      stripe_subscription_id: { not: null },
      status: {
        in: ACCESS_STATUSES
      }
    },
    orderBy: { created_at: "desc" }
  });
  if (activeSubscription) {
    throw new Error("User already has an active subscription");
  }
  const existingSubscription = await prisma_default.subscription.findFirst({
    where: {
      user_id: user.id,
      stripe_customer_id: { not: null }
    },
    orderBy: { created_at: "desc" },
    select: { stripe_customer_id: true }
  });
  const customerId = existingSubscription?.stripe_customer_id ?? (await stripe.customers.create({
    email: user.email,
    metadata: {
      user_id: user.id
    }
  })).id;
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const automaticTax = process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [
      {
        price: stripePrice.price_id,
        quantity: 1
      }
    ],
    success_url: process.env.STRIPE_CHECKOUT_SUCCESS_URL ?? `${frontendUrl}/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: process.env.STRIPE_CHECKOUT_CANCEL_URL ?? `${frontendUrl}/subscription?checkout=cancelled`,
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: automaticTax },
    metadata: {
      user_id: user.id,
      plan: input.plan,
      billing_interval: input.billing_interval
    },
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        user_id: user.id,
        plan: input.plan,
        billing_interval: input.billing_interval
      }
    },
    allow_promotion_codes: true
  }, input.request_id ? { idempotencyKey: `checkout:${user.id}:${input.request_id}` } : void 0);
  await prisma_default.subscription.create({
    data: {
      user_id: user.id,
      plan: input.plan,
      status: import_client6.SubscriptionStatus.INCOMPLETE,
      amount_cents: stripePrice.amount_cents,
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      billing_interval: input.billing_interval
    }
  });
  if (!session.url) {
    throw new Error("Stripe checkout session URL was not created");
  }
  return {
    checkout_session_id: session.id,
    checkout_url: session.url,
    plan: input.plan,
    billing_interval: input.billing_interval
  };
}
async function syncSubscriptionFromStripe(stripeSubscription) {
  const subscriptionWithPeriod = stripeSubscription;
  const stripeSubscriptionId = stripeSubscription.id;
  const stripeCustomerId = getStripeId(stripeSubscription.customer);
  const status = mapStripeStatus(stripeSubscription.status);
  const plan = toPaidPlan(stripeSubscription.metadata?.plan);
  const billingInterval = stripeSubscription.metadata?.billing_interval === "annual" ? "annual" : "monthly";
  const stripePrice = getStripePrice(plan, billingInterval);
  const metadataUserId = stripeSubscription.metadata?.user_id;
  const existingSubscription = await prisma_default.subscription.findFirst({
    where: {
      OR: [
        { stripe_subscription_id: stripeSubscriptionId },
        ...stripeCustomerId ? [{ stripe_customer_id: stripeCustomerId }] : []
      ]
    },
    orderBy: { created_at: "desc" },
    select: { id: true, user_id: true, status: true }
  });
  const userId = metadataUserId ?? existingSubscription?.user_id;
  if (!userId) {
    throw new Error("Stripe subscription is missing user_id metadata");
  }
  const subscription = existingSubscription ? await prisma_default.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      plan,
      status,
      amount_cents: stripePrice.amount_cents,
      currency: "eur",
      billing_interval: billingInterval,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_start: unixToDate(subscriptionWithPeriod.current_period_start),
      current_period_end: unixToDate(subscriptionWithPeriod.current_period_end),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end ?? false,
      trial_starts_at: unixToDate(subscriptionWithPeriod.trial_start) ?? void 0,
      trial_ends_at: unixToDate(stripeSubscription.trial_end)
    }
  }) : await prisma_default.subscription.create({
    data: {
      user_id: userId,
      plan,
      status,
      amount_cents: stripePrice.amount_cents,
      currency: "eur",
      billing_interval: billingInterval,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_start: unixToDate(subscriptionWithPeriod.current_period_start),
      current_period_end: unixToDate(subscriptionWithPeriod.current_period_end),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end ?? false,
      trial_starts_at: unixToDate(subscriptionWithPeriod.trial_start) ?? /* @__PURE__ */ new Date(),
      trial_ends_at: unixToDate(stripeSubscription.trial_end)
    }
  });
  await prisma_default.user.update({
    where: { id: userId },
    data: {
      plan: ACCESS_STATUSES.includes(status) ? plan : import_client6.Plan.FREE
    }
  });
  const wasActive = existingSubscription ? ACCESS_STATUSES.includes(existingSubscription.status) : false;
  if (!wasActive && ACCESS_STATUSES.includes(status)) {
    await grantSubscriptionCredits(subscription.id, `stripe-sub-activated:${stripeSubscriptionId}`, /* @__PURE__ */ new Date());
  }
  return subscription;
}
async function createBillingPortalSession(userId) {
  const subscription = await prisma_default.subscription.findFirst({ where: { user_id: userId, stripe_customer_id: { not: null } }, orderBy: { created_at: "desc" } });
  if (!subscription?.stripe_customer_id) throw new Error("No Stripe billing account found");
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const session = await getStripeClient().billingPortal.sessions.create({ customer: subscription.stripe_customer_id, return_url: `${frontendUrl}/subscription` });
  return { url: session.url };
}
async function verifyCheckoutSession(userId, sessionId) {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== userId && session.metadata?.user_id !== userId) throw new Error("Checkout session not found");
  const subscriptionId = getStripeId(session.subscription);
  if (subscriptionId) await syncSubscriptionFromStripe(await getStripeClient().subscriptions.retrieve(subscriptionId));
  return {
    status: session.status,
    payment_status: session.payment_status,
    plan: session.metadata?.plan ?? null,
    billing_interval: session.metadata?.billing_interval ?? null
  };
}
async function getUserPlan(userId) {
  return (await getEffectivePlanAccess(userId)).effective_plan;
}
async function getPlanLimits(userId) {
  return (await getEffectivePlanAccess(userId)).limits;
}
async function getPlanQuota(userId) {
  const access = await getEffectivePlanAccess(userId);
  const plan = access.plan;
  const limits = access.limits;
  const usage = await getLiveUsageCounts(userId);
  return {
    plan,
    limits,
    usage,
    remaining: {
      projects: remaining(limits.projects, usage.project_count),
      prompts: remaining(limits.prompts, usage.prompt_count),
      competitors: remaining(limits.competitors, usage.competitor_count)
    }
  };
}
async function assertCanCreateProjectWithPrompts(userId, promptCount) {
  const access = await getEffectivePlanAccess(userId);
  const credits = await getCreditBalance2(userId);
  if (access.trial.expired && access.effective_plan === import_client6.Plan.FREE && credits.remaining <= 0) {
    throw new Error("Your free trial has ended. Please upgrade or add credits to create new brand workspaces.");
  }
  if (access.trial.active) {
    const projectCount = await prisma_default.project.count({ where: { user_id: userId } });
    if (projectCount >= 1) {
      throw new Error("Your Free Trial includes 1 Brand Workspace. Upgrade or add credits to manage multiple brands.");
    }
    const used = await prisma_default.prompt.count({ where: { project: { user_id: userId }, is_active: true, status: "ACTIVE" } });
    if (used + promptCount > 10) throw new Error("Your free trial includes up to 10 prompts. Add a plan or credits to continue.");
  }
  return { allowed: true };
}
async function assertCanCreatePrompts(userId, promptCount = 1) {
  const access = await getEffectivePlanAccess(userId);
  const credits = await getCreditBalance2(userId);
  if (access.trial.expired && access.effective_plan === import_client6.Plan.FREE && credits.remaining <= 0) {
    throw new Error("Your free trial has ended. Please upgrade or add credits to add more prompts.");
  }
  if (access.trial.active) {
    const used = await prisma_default.prompt.count({ where: { project: { user_id: userId }, is_active: true, status: "ACTIVE" } });
    if (used + promptCount > 10) throw new Error("Your free trial includes up to 10 prompts. Add a plan or credits to continue.");
  }
  return { allowed: true };
}
async function getMyPlan(userId) {
  const access = await getEffectivePlanAccess(userId);
  const { start, end } = await getCurrentPeriod(userId);
  const [liveUsage, monthlyRunsUsed, credits] = await Promise.all([
    getLiveUsageCounts(userId),
    prisma_default.run.count({
      where: {
        project: { user_id: userId },
        ran_at: { gte: start, lt: end }
      }
    }),
    getCreditBalance2(userId)
  ]);
  return {
    plan: access.plan,
    effective_plan: access.effective_plan,
    status: access.status,
    subscription: access.subscription,
    trial: access.trial,
    limits: access.limits,
    usage: {
      prompt_count: liveUsage.prompt_count,
      project_count: liveUsage.project_count,
      competitor_count: liveUsage.competitor_count,
      monthly_runs_used: monthlyRunsUsed,
      credits_used: credits.used,
      credits_remaining: credits.remaining,
      period_start: start,
      period_end: end
    }
  };
}
async function canCreateProject(userId) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return buildCheck("project", user?.plan ?? "FREE", "unlimited", 0, true);
}
async function canCreatePrompt(userId) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return buildCheck("prompt", user?.plan ?? "FREE", "unlimited", 0, true);
}
async function canAddCompetitor(userId) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return buildCheck("competitor", user?.plan ?? "FREE", "unlimited", 0, true);
}
async function assertCanAddCompetitor(_userId) {
  return { allowed: true, feature: "competitor", plan: "FREE", limit: "unlimited", used: 0 };
}
async function assertCanAddCompetitors(_userId, _count) {
  return { allowed: true };
}
async function canRunRefresh(userId, projectId) {
  const access = await getEffectivePlanAccess(userId);
  const credits = await getCreditBalance2(userId);
  if ((access.trial.expired || !access.trial.active && access.effective_plan === import_client6.Plan.FREE) && credits.remaining <= 0) {
    return buildCheck(
      "refresh",
      import_client6.Plan.FREE,
      "daily",
      0,
      false,
      "Your free trial has ended. Please upgrade or add credits to continue automated prompt runs."
    );
  }
  if (projectId) {
    const used = await prisma_default.run.count({
      where: {
        project_id: projectId,
        project: { user_id: userId },
        ran_at: { gte: getRefreshWindowStart() }
      }
    });
    const allowed = used < 1;
    return buildCheck("refresh", access.effective_plan, "daily", used, allowed, allowed ? void 0 : "This project already refreshed today.");
  }
  return buildCheck("refresh", access.effective_plan, "daily", 0, true);
}
async function canExport(userId) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return buildCheck("export", user?.plan ?? "FREE", "full", 0, true);
}
async function refreshPlanUsage(userId) {
  const { start, end } = await getCurrentPeriod(userId);
  const [projectCount, promptCount, competitorCount, monthlyRunsUsed] = await Promise.all([
    prisma_default.project.count({ where: { user_id: userId } }),
    prisma_default.prompt.count({ where: { project: { user_id: userId } } }),
    prisma_default.competitor.count({ where: { project: { user_id: userId } } }),
    prisma_default.run.count({
      where: {
        project: { user_id: userId },
        ran_at: { gte: start, lt: end }
      }
    })
  ]);
  return prisma_default.planUsage.upsert({
    where: {
      user_id_period_start_period_end: {
        user_id: userId,
        period_start: start,
        period_end: end
      }
    },
    create: {
      user_id: userId,
      project_count: projectCount,
      prompt_count: promptCount,
      competitor_count: competitorCount,
      monthly_runs_used: monthlyRunsUsed,
      period_start: start,
      period_end: end
    },
    update: {
      project_count: projectCount,
      prompt_count: promptCount,
      competitor_count: competitorCount,
      monthly_runs_used: monthlyRunsUsed
    }
  });
}
var import_client6, ACCESS_STATUSES;
var init_subscription_service = __esm({
  "src/features/subscription/subscription_service.ts"() {
    import_client6 = require("@prisma/client");
    init_prisma();
    init_entitlements();
    init_credits_service2();
    init_credits_service();
    init_refresh_window();
    init_stripe_config();
    ACCESS_STATUSES = [
      import_client6.SubscriptionStatus.ACTIVE,
      import_client6.SubscriptionStatus.TRIALING,
      import_client6.SubscriptionStatus.PAST_DUE
    ];
  }
});

// src/features/geo/countries.ts
function getGeoCountryByName(name) {
  const normalized = name?.trim().toLowerCase();
  return GEO_COUNTRIES.find((country) => country.name.toLowerCase() === normalized) ?? null;
}
var GEO_COUNTRIES;
var init_countries = __esm({
  "src/features/geo/countries.ts"() {
    GEO_COUNTRIES = [
      { code: "AF", name: "Afghanistan" },
      { code: "AX", name: "Aland Islands" },
      { code: "AL", name: "Albania" },
      { code: "DZ", name: "Algeria" },
      { code: "AS", name: "American Samoa" },
      { code: "AD", name: "Andorra" },
      { code: "AO", name: "Angola" },
      { code: "AI", name: "Anguilla" },
      { code: "AQ", name: "Antarctica" },
      { code: "AG", name: "Antigua and Barbuda" },
      { code: "AR", name: "Argentina" },
      { code: "AM", name: "Armenia" },
      { code: "AW", name: "Aruba" },
      { code: "AU", name: "Australia" },
      { code: "AT", name: "Austria" },
      { code: "AZ", name: "Azerbaijan" },
      { code: "BS", name: "Bahamas" },
      { code: "BH", name: "Bahrain" },
      { code: "BD", name: "Bangladesh" },
      { code: "BB", name: "Barbados" },
      { code: "BY", name: "Belarus" },
      { code: "BE", name: "Belgium" },
      { code: "BZ", name: "Belize" },
      { code: "BJ", name: "Benin" },
      { code: "BM", name: "Bermuda" },
      { code: "BT", name: "Bhutan" },
      { code: "BO", name: "Bolivia" },
      { code: "BQ", name: "Bonaire, Sint Eustatius and Saba" },
      { code: "BA", name: "Bosnia and Herzegovina" },
      { code: "BW", name: "Botswana" },
      { code: "BV", name: "Bouvet Island" },
      { code: "BR", name: "Brazil" },
      { code: "IO", name: "British Indian Ocean Territory" },
      { code: "BN", name: "Brunei" },
      { code: "BG", name: "Bulgaria" },
      { code: "BF", name: "Burkina Faso" },
      { code: "BI", name: "Burundi" },
      { code: "KH", name: "Cambodia" },
      { code: "CM", name: "Cameroon" },
      { code: "CA", name: "Canada" },
      { code: "CV", name: "Cape Verde" },
      { code: "KY", name: "Cayman Islands" },
      { code: "CF", name: "Central African Republic" },
      { code: "TD", name: "Chad" },
      { code: "CL", name: "Chile" },
      { code: "CN", name: "China" },
      { code: "CX", name: "Christmas Island" },
      { code: "CC", name: "Cocos Islands" },
      { code: "CO", name: "Colombia" },
      { code: "KM", name: "Comoros" },
      { code: "CG", name: "Congo" },
      { code: "CD", name: "Congo, Democratic Republic" },
      { code: "CK", name: "Cook Islands" },
      { code: "CR", name: "Costa Rica" },
      { code: "CI", name: "Cote d'Ivoire" },
      { code: "HR", name: "Croatia" },
      { code: "CU", name: "Cuba" },
      { code: "CW", name: "Curacao" },
      { code: "CY", name: "Cyprus" },
      { code: "CZ", name: "Czech Republic" },
      { code: "DK", name: "Denmark" },
      { code: "DJ", name: "Djibouti" },
      { code: "DM", name: "Dominica" },
      { code: "DO", name: "Dominican Republic" },
      { code: "EC", name: "Ecuador" },
      { code: "EG", name: "Egypt" },
      { code: "SV", name: "El Salvador" },
      { code: "GQ", name: "Equatorial Guinea" },
      { code: "ER", name: "Eritrea" },
      { code: "EE", name: "Estonia" },
      { code: "SZ", name: "Eswatini" },
      { code: "ET", name: "Ethiopia" },
      { code: "FK", name: "Falkland Islands" },
      { code: "FO", name: "Faroe Islands" },
      { code: "FJ", name: "Fiji" },
      { code: "FI", name: "Finland" },
      { code: "FR", name: "France" },
      { code: "GF", name: "French Guiana" },
      { code: "PF", name: "French Polynesia" },
      { code: "TF", name: "French Southern Territories" },
      { code: "GA", name: "Gabon" },
      { code: "GM", name: "Gambia" },
      { code: "GE", name: "Georgia" },
      { code: "DE", name: "Germany" },
      { code: "GH", name: "Ghana" },
      { code: "GI", name: "Gibraltar" },
      { code: "GR", name: "Greece" },
      { code: "GL", name: "Greenland" },
      { code: "GD", name: "Grenada" },
      { code: "GP", name: "Guadeloupe" },
      { code: "GU", name: "Guam" },
      { code: "GT", name: "Guatemala" },
      { code: "GG", name: "Guernsey" },
      { code: "GN", name: "Guinea" },
      { code: "GW", name: "Guinea-Bissau" },
      { code: "GY", name: "Guyana" },
      { code: "HT", name: "Haiti" },
      { code: "HM", name: "Heard Island and McDonald Islands" },
      { code: "VA", name: "Holy See" },
      { code: "HN", name: "Honduras" },
      { code: "HK", name: "Hong Kong" },
      { code: "HU", name: "Hungary" },
      { code: "IS", name: "Iceland" },
      { code: "IN", name: "India" },
      { code: "ID", name: "Indonesia" },
      { code: "IR", name: "Iran" },
      { code: "IQ", name: "Iraq" },
      { code: "IE", name: "Ireland" },
      { code: "IM", name: "Isle of Man" },
      { code: "IL", name: "Israel" },
      { code: "IT", name: "Italy" },
      { code: "JM", name: "Jamaica" },
      { code: "JP", name: "Japan" },
      { code: "JE", name: "Jersey" },
      { code: "JO", name: "Jordan" },
      { code: "KZ", name: "Kazakhstan" },
      { code: "KE", name: "Kenya" },
      { code: "KI", name: "Kiribati" },
      { code: "KP", name: "North Korea" },
      { code: "KR", name: "South Korea" },
      { code: "KW", name: "Kuwait" },
      { code: "KG", name: "Kyrgyzstan" },
      { code: "LA", name: "Laos" },
      { code: "LV", name: "Latvia" },
      { code: "LB", name: "Lebanon" },
      { code: "LS", name: "Lesotho" },
      { code: "LR", name: "Liberia" },
      { code: "LY", name: "Libya" },
      { code: "LI", name: "Liechtenstein" },
      { code: "LT", name: "Lithuania" },
      { code: "LU", name: "Luxembourg" },
      { code: "MO", name: "Macao" },
      { code: "MG", name: "Madagascar" },
      { code: "MW", name: "Malawi" },
      { code: "MY", name: "Malaysia" },
      { code: "MV", name: "Maldives" },
      { code: "ML", name: "Mali" },
      { code: "MT", name: "Malta" },
      { code: "MH", name: "Marshall Islands" },
      { code: "MQ", name: "Martinique" },
      { code: "MR", name: "Mauritania" },
      { code: "MU", name: "Mauritius" },
      { code: "YT", name: "Mayotte" },
      { code: "MX", name: "Mexico" },
      { code: "FM", name: "Micronesia" },
      { code: "MD", name: "Moldova" },
      { code: "MC", name: "Monaco" },
      { code: "MN", name: "Mongolia" },
      { code: "ME", name: "Montenegro" },
      { code: "MS", name: "Montserrat" },
      { code: "MA", name: "Morocco" },
      { code: "MZ", name: "Mozambique" },
      { code: "MM", name: "Myanmar" },
      { code: "NA", name: "Namibia" },
      { code: "NR", name: "Nauru" },
      { code: "NP", name: "Nepal" },
      { code: "NL", name: "Netherlands" },
      { code: "NC", name: "New Caledonia" },
      { code: "NZ", name: "New Zealand" },
      { code: "NI", name: "Nicaragua" },
      { code: "NE", name: "Niger" },
      { code: "NG", name: "Nigeria" },
      { code: "NU", name: "Niue" },
      { code: "NF", name: "Norfolk Island" },
      { code: "MK", name: "North Macedonia" },
      { code: "MP", name: "Northern Mariana Islands" },
      { code: "NO", name: "Norway" },
      { code: "OM", name: "Oman" },
      { code: "PK", name: "Pakistan" },
      { code: "PW", name: "Palau" },
      { code: "PS", name: "Palestine" },
      { code: "PA", name: "Panama" },
      { code: "PG", name: "Papua New Guinea" },
      { code: "PY", name: "Paraguay" },
      { code: "PE", name: "Peru" },
      { code: "PH", name: "Philippines" },
      { code: "PN", name: "Pitcairn" },
      { code: "PL", name: "Poland" },
      { code: "PT", name: "Portugal" },
      { code: "PR", name: "Puerto Rico" },
      { code: "QA", name: "Qatar" },
      { code: "RE", name: "Reunion" },
      { code: "RO", name: "Romania" },
      { code: "RU", name: "Russia" },
      { code: "RW", name: "Rwanda" },
      { code: "BL", name: "Saint Barthelemy" },
      { code: "SH", name: "Saint Helena" },
      { code: "KN", name: "Saint Kitts and Nevis" },
      { code: "LC", name: "Saint Lucia" },
      { code: "MF", name: "Saint Martin" },
      { code: "PM", name: "Saint Pierre and Miquelon" },
      { code: "VC", name: "Saint Vincent and the Grenadines" },
      { code: "WS", name: "Samoa" },
      { code: "SM", name: "San Marino" },
      { code: "ST", name: "Sao Tome and Principe" },
      { code: "SA", name: "Saudi Arabia" },
      { code: "SN", name: "Senegal" },
      { code: "RS", name: "Serbia" },
      { code: "SC", name: "Seychelles" },
      { code: "SL", name: "Sierra Leone" },
      { code: "SG", name: "Singapore" },
      { code: "SX", name: "Sint Maarten" },
      { code: "SK", name: "Slovakia" },
      { code: "SI", name: "Slovenia" },
      { code: "SB", name: "Solomon Islands" },
      { code: "SO", name: "Somalia" },
      { code: "ZA", name: "South Africa" },
      { code: "GS", name: "South Georgia and the South Sandwich Islands" },
      { code: "SS", name: "South Sudan" },
      { code: "ES", name: "Spain" },
      { code: "LK", name: "Sri Lanka" },
      { code: "SD", name: "Sudan" },
      { code: "SR", name: "Suriname" },
      { code: "SJ", name: "Svalbard and Jan Mayen" },
      { code: "SE", name: "Sweden" },
      { code: "CH", name: "Switzerland" },
      { code: "SY", name: "Syria" },
      { code: "TW", name: "Taiwan" },
      { code: "TJ", name: "Tajikistan" },
      { code: "TZ", name: "Tanzania" },
      { code: "TH", name: "Thailand" },
      { code: "TL", name: "Timor-Leste" },
      { code: "TG", name: "Togo" },
      { code: "TK", name: "Tokelau" },
      { code: "TO", name: "Tonga" },
      { code: "TT", name: "Trinidad and Tobago" },
      { code: "TN", name: "Tunisia" },
      { code: "TR", name: "Turkey" },
      { code: "TM", name: "Turkmenistan" },
      { code: "TC", name: "Turks and Caicos Islands" },
      { code: "TV", name: "Tuvalu" },
      { code: "UG", name: "Uganda" },
      { code: "UA", name: "Ukraine" },
      { code: "AE", name: "United Arab Emirates" },
      { code: "GB", name: "United Kingdom" },
      { code: "US", name: "United States" },
      { code: "UM", name: "United States Minor Outlying Islands" },
      { code: "UY", name: "Uruguay" },
      { code: "UZ", name: "Uzbekistan" },
      { code: "VU", name: "Vanuatu" },
      { code: "VE", name: "Venezuela" },
      { code: "VN", name: "Vietnam" },
      { code: "VG", name: "British Virgin Islands" },
      { code: "VI", name: "U.S. Virgin Islands" },
      { code: "WF", name: "Wallis and Futuna" },
      { code: "EH", name: "Western Sahara" },
      { code: "YE", name: "Yemen" },
      { code: "ZM", name: "Zambia" },
      { code: "ZW", name: "Zimbabwe" }
    ];
  }
});

// src/lib/agency_access.ts
function notFound(code) {
  return Object.assign(new Error(code), { status: 404, code: code.toLowerCase() });
}
async function getAccessibleUserIds(user_id) {
  const links = await prisma_default.agencyClientLink.findMany({
    where: { agency_user_id: user_id, status: "ACTIVE" },
    select: { client_user_id: true }
  });
  const clientIds = links.map((l) => l.client_user_id);
  const memberships = await prisma_default.agencyMembership.findMany({
    where: { member_user_id: user_id, status: "ACTIVE" },
    select: { agency_user_id: true }
  });
  const staffAgencyIds = memberships.map((m) => m.agency_user_id);
  const staffClientLinks = staffAgencyIds.length ? await prisma_default.agencyClientLink.findMany({
    where: { agency_user_id: { in: staffAgencyIds }, status: "ACTIVE" },
    select: { client_user_id: true }
  }) : [];
  return [.../* @__PURE__ */ new Set([
    user_id,
    ...clientIds,
    ...staffAgencyIds,
    ...staffClientLinks.map((l) => l.client_user_id)
  ])];
}
async function getAssignedProjectIds(client_user_id) {
  const links = await prisma_default.agencyClientLink.findMany({
    where: { client_user_id, status: "ACTIVE" },
    select: { assigned_project_ids: true }
  });
  return [...new Set(links.flatMap((l) => l.assigned_project_ids || []))];
}
async function assertAgencyProjectAccess(project_id, user_id) {
  const accessibleUserIds = await getAccessibleUserIds(user_id);
  const assignedProjectIds = await getAssignedProjectIds(user_id);
  const project = await prisma_default.project.findFirst({
    where: {
      id: project_id,
      OR: [
        { user_id: { in: accessibleUserIds } },
        { id: { in: assignedProjectIds } }
      ]
    },
    select: {
      id: true,
      brand_name: true,
      brand_url: true,
      brand_location: true,
      user_id: true,
      created_at: true,
      updated_at: true
    }
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND");
  return project;
}
async function assertAgencyCompetitorAccess(competitor_id, user_id) {
  const accessibleUserIds = await getAccessibleUserIds(user_id);
  const assignedProjectIds = await getAssignedProjectIds(user_id);
  const competitor = await prisma_default.competitor.findFirst({
    where: {
      id: competitor_id,
      project: {
        OR: [
          { user_id: { in: accessibleUserIds } },
          { id: { in: assignedProjectIds } }
        ]
      }
    }
  });
  if (!competitor) throw notFound("COMPETITOR_NOT_FOUND");
  return competitor;
}
async function assertAgencyRunAccess(run_id, user_id) {
  const accessibleUserIds = await getAccessibleUserIds(user_id);
  const assignedProjectIds = await getAssignedProjectIds(user_id);
  const run = await prisma_default.run.findFirst({
    where: {
      id: run_id,
      project: {
        OR: [
          { user_id: { in: accessibleUserIds } },
          { id: { in: assignedProjectIds } }
        ]
      }
    }
  });
  if (!run) throw notFound("RUN_NOT_FOUND");
  return run;
}
async function assertAgencyPromptAccess(prompt_id, user_id) {
  const accessibleUserIds = await getAccessibleUserIds(user_id);
  const assignedProjectIds = await getAssignedProjectIds(user_id);
  const prompt = await prisma_default.prompt.findFirst({
    where: {
      id: prompt_id,
      project: {
        OR: [
          { user_id: { in: accessibleUserIds } },
          { id: { in: assignedProjectIds } }
        ]
      }
    }
  });
  if (!prompt) throw notFound("PROMPT_NOT_FOUND");
  return prompt;
}
var init_agency_access = __esm({
  "src/lib/agency_access.ts"() {
    init_prisma();
  }
});

// src/features/projects/project_access.ts
async function assertProjectAccess(project_id, user_id) {
  const project = await assertAgencyProjectAccess(project_id, user_id);
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }
  return project;
}
async function assertProjectMutationAccess(project_id, user_id) {
  const project = await assertProjectAccess(project_id, user_id);
  if (project.user_id !== user_id) {
    const prismaClient = (await Promise.resolve().then(() => (init_prisma(), prisma_exports))).default;
    const link = await prismaClient.agencyClientLink.findFirst({
      where: {
        agency_user_id: project.user_id,
        client_user_id: user_id,
        status: "ACTIVE"
      },
      select: { role: true }
    });
    if (link?.role === "CLIENT_VIEWER") {
      throw Object.assign(new Error("Read-only access: Client viewers cannot modify projects or prompts."), { status: 403 });
    }
  }
  return project;
}
async function assertCompetitorAccess(competitor_id, user_id) {
  const competitor = await assertAgencyCompetitorAccess(competitor_id, user_id);
  if (!competitor) {
    throw new Error("COMPETITOR_NOT_FOUND");
  }
  return competitor;
}
async function assertCompetitorMutationAccess(competitor_id, user_id) {
  const competitor = await assertCompetitorAccess(competitor_id, user_id);
  const prismaClient = (await Promise.resolve().then(() => (init_prisma(), prisma_exports))).default;
  const project = await prismaClient.project.findUnique({ where: { id: competitor.project_id } });
  if (project) await assertProjectMutationAccess(project.id, user_id);
  return competitor;
}
async function assertRunAccess(run_id, user_id) {
  const run = await assertAgencyRunAccess(run_id, user_id);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }
  return run;
}
async function assertPromptAccess(prompt_id, user_id) {
  const prompt = await assertAgencyPromptAccess(prompt_id, user_id);
  if (!prompt) {
    throw new Error("PROMPT_NOT_FOUND");
  }
  return prompt;
}
var init_project_access = __esm({
  "src/features/projects/project_access.ts"() {
    init_agency_access();
  }
});

// src/features/project_engines/project_engine_policy.ts
function isSelectableProjectEngine(engine) {
  return selectableSet.has(engine);
}
function getEngineLimitForPlan(_plan) {
  return SELECTABLE_PROJECT_ENGINES.length;
}
function normalizeProjectEngines(input) {
  if (!Array.isArray(input)) return [...DEFAULT_PROJECT_ENGINES];
  const engines = input.map((value) => String(value).trim().toUpperCase()).filter((value) => value in import_client7.Engine).filter(isSelectableProjectEngine);
  return [...new Set(engines)];
}
var import_client7, SELECTABLE_PROJECT_ENGINES, DEFAULT_PROJECT_ENGINES, selectableSet;
var init_project_engine_policy = __esm({
  "src/features/project_engines/project_engine_policy.ts"() {
    import_client7 = require("@prisma/client");
    SELECTABLE_PROJECT_ENGINES = [
      import_client7.Engine.CHATGPT,
      import_client7.Engine.GEMINI,
      import_client7.Engine.PERPLEXITY,
      import_client7.Engine.GOOGLE_AI_MODE,
      import_client7.Engine.COPILOT
    ];
    DEFAULT_PROJECT_ENGINES = [
      import_client7.Engine.CHATGPT,
      import_client7.Engine.GEMINI,
      import_client7.Engine.PERPLEXITY
    ];
    selectableSet = new Set(SELECTABLE_PROJECT_ENGINES);
  }
});

// src/features/project_engines/project_engines_service.ts
async function assertCanUseProjectEngines(userId, rawEngines) {
  const engines = normalizeProjectEngines(rawEngines);
  if (engines.length === 0) {
    throw new Error("Select at least one AI engine.");
  }
  const access = await getEffectivePlanAccess(userId);
  if (access.trial.active && engines.length > 3) {
    throw new Error("Your free trial includes 3 AI engines. Add a plan or credits to unlock all engines.");
  }
  return engines;
}
async function setProjectEngines(projectId, userId, rawEngines) {
  await assertProjectAccess(projectId, userId);
  const engines = await assertCanUseProjectEngines(userId, rawEngines);
  await prisma_default.$transaction(async (tx) => {
    await tx.projectEnginePreference.upsert({
      where: { project_id_engine: { project_id: projectId, engine: import_client8.Engine.CHATGPT } },
      create: { project_id: projectId, engine: import_client8.Engine.CHATGPT, is_active: engines.includes(import_client8.Engine.CHATGPT) },
      update: { is_active: engines.includes(import_client8.Engine.CHATGPT) }
    });
    await tx.projectEnginePreference.upsert({
      where: { project_id_engine: { project_id: projectId, engine: import_client8.Engine.GEMINI } },
      create: { project_id: projectId, engine: import_client8.Engine.GEMINI, is_active: engines.includes(import_client8.Engine.GEMINI) },
      update: { is_active: engines.includes(import_client8.Engine.GEMINI) }
    });
    await tx.projectEnginePreference.upsert({
      where: { project_id_engine: { project_id: projectId, engine: import_client8.Engine.PERPLEXITY } },
      create: { project_id: projectId, engine: import_client8.Engine.PERPLEXITY, is_active: engines.includes(import_client8.Engine.PERPLEXITY) },
      update: { is_active: engines.includes(import_client8.Engine.PERPLEXITY) }
    });
    await tx.projectEnginePreference.upsert({
      where: { project_id_engine: { project_id: projectId, engine: import_client8.Engine.GOOGLE_AI_MODE } },
      create: { project_id: projectId, engine: import_client8.Engine.GOOGLE_AI_MODE, is_active: engines.includes(import_client8.Engine.GOOGLE_AI_MODE) },
      update: { is_active: engines.includes(import_client8.Engine.GOOGLE_AI_MODE) }
    });
    await tx.projectEnginePreference.upsert({
      where: { project_id_engine: { project_id: projectId, engine: import_client8.Engine.COPILOT } },
      create: { project_id: projectId, engine: import_client8.Engine.COPILOT, is_active: engines.includes(import_client8.Engine.COPILOT) },
      update: { is_active: engines.includes(import_client8.Engine.COPILOT) }
    });
  });
  return getProjectEngines(projectId);
}
async function createDefaultProjectEngines(projectId, engines = [...DEFAULT_PROJECT_ENGINES]) {
  const selected = new Set(engines);
  await prisma_default.projectEnginePreference.createMany({
    data: SELECTABLE_PROJECT_ENGINES.map((engine) => ({
      project_id: projectId,
      engine,
      is_active: selected.has(engine)
    })),
    skipDuplicates: true
  });
}
async function getProjectEngines(projectId) {
  const rows = await prisma_default.projectEnginePreference.findMany({
    where: {
      project_id: projectId,
      is_active: true,
      engine: { in: [...SELECTABLE_PROJECT_ENGINES] }
    },
    select: { engine: true },
    orderBy: { created_at: "asc" }
  });
  if (rows.length) return rows.map((row) => row.engine);
  await createDefaultProjectEngines(projectId);
  return [...DEFAULT_PROJECT_ENGINES];
}
var import_client8;
var init_project_engines_service = __esm({
  "src/features/project_engines/project_engines_service.ts"() {
    import_client8 = require("@prisma/client");
    init_prisma();
    init_entitlements();
    init_project_access();
    init_project_engine_policy();
  }
});

// src/lib/redis.ts
function getRedisTlsOptions(enabled) {
  if (!enabled) return void 0;
  return {
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false"
  };
}
function getRedisConnectionOptions() {
  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      username: process.env.REDIS_USERNAME || void 0,
      password: process.env.REDIS_PASSWORD || void 0,
      tls: getRedisTlsOptions(process.env.REDIS_TLS === "true"),
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    };
  }
  const url = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || void 0,
    password: url.password || void 0,
    tls: getRedisTlsOptions(url.protocol === "rediss:"),
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}
var import_ioredis;
var init_redis = __esm({
  "src/lib/redis.ts"() {
    import_ioredis = __toESM(require("ioredis"), 1);
  }
});

// src/queues/scrape_queue.ts
function getScrapeQueue() {
  if (scrapeQueue) return scrapeQueue;
  scrapeQueue = new import_bullmq2.Queue(SCRAPE_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: Number(process.env.SCRAPE_QUEUE_ATTEMPTS ?? 3),
      backoff: {
        type: "exponential",
        delay: Number(process.env.SCRAPE_QUEUE_RETRY_DELAY_MS ?? 6e4)
      },
      removeOnComplete: {
        age: 86400,
        count: 1e3
      },
      removeOnFail: {
        age: 604800,
        count: 5e3
      }
    }
  });
  scrapeQueue.on("error", (error) => {
    console.error(`Scrape queue Redis error: ${error.message}`);
  });
  return scrapeQueue;
}
async function enqueueScrapeJob(scrape_job_id, delay = 0) {
  try {
    return await getScrapeQueue().add(
      "scrape",
      { scrape_job_id },
      {
        jobId: scrape_job_id,
        delay
      }
    );
  } catch (error) {
    throw new Error(`Could not enqueue scrape job. Is Redis running at ${process.env.REDIS_URL ?? "redis://127.0.0.1:6379"}? ${error instanceof Error ? error.message : ""}`);
  }
}
var import_bullmq2, SCRAPE_QUEUE_NAME, scrapeQueue;
var init_scrape_queue = __esm({
  "src/queues/scrape_queue.ts"() {
    import_bullmq2 = require("bullmq");
    init_redis();
    SCRAPE_QUEUE_NAME = "ai-visibility-scrape";
    scrapeQueue = null;
  }
});

// src/features/scraping/scrape_engine_policy.ts
function isActiveScrapeEngine(engine) {
  return activeEngineSet.has(engine);
}
function activeConfiguredEngines() {
  return ACTIVE_SCRAPE_ENGINES.filter((engine) => engine !== import_client10.Engine.COPILOT || Boolean(process.env.BRIGHT_DATA_COPILOT_SCRAPER_ID?.trim()));
}
var import_client10, ACTIVE_SCRAPE_ENGINES, activeEngineSet;
var init_scrape_engine_policy = __esm({
  "src/features/scraping/scrape_engine_policy.ts"() {
    import_client10 = require("@prisma/client");
    ACTIVE_SCRAPE_ENGINES = [
      import_client10.Engine.CHATGPT,
      import_client10.Engine.GEMINI,
      import_client10.Engine.PERPLEXITY,
      import_client10.Engine.GOOGLE_AI_MODE,
      import_client10.Engine.COPILOT
    ];
    activeEngineSet = new Set(ACTIVE_SCRAPE_ENGINES);
  }
});

// src/features/scraping/scrape_gate.ts
function isScrapingDisabled() {
  return process.env.SCRAPING_DISABLED === "true";
}
function assertScrapingEnabled() {
  if (isScrapingDisabled()) {
    throw new Error(SCRAPING_DISABLED_ERROR);
  }
}
var SCRAPING_DISABLED_ERROR;
var init_scrape_gate = __esm({
  "src/features/scraping/scrape_gate.ts"() {
    SCRAPING_DISABLED_ERROR = "SCRAPING_DISABLED";
  }
});

// src/features/scraping/scrape_orchestration_service.ts
async function enqueueProjectRun(input) {
  assertScrapingEnabled();
  const configuredEngineSet = new Set(activeConfiguredEngines());
  const requestedEngines = input.engines?.length ? input.engines : await getProjectEngines(input.project_id);
  const engines = [...new Set(requestedEngines.filter((engine) => isActiveScrapeEngine(engine) && configuredEngineSet.has(engine)))];
  if (engines.length === 0) {
    throw new Error("No supported scrape engines were selected");
  }
  const [project, prompts] = await Promise.all([
    prisma_default.project.findUniqueOrThrow({
      where: { id: input.project_id },
      select: { brand_location: true }
    }),
    prisma_default.prompt.findMany({
      where: {
        project_id: input.project_id,
        is_active: true,
        status: "ACTIVE",
        ...input.prompt_ids?.length ? { id: { in: input.prompt_ids } } : {}
      },
      include: {
        geo_variants: {
          where: { is_active: true }
        }
      },
      orderBy: { created_at: "asc" }
    })
  ]);
  const projectCountry = getGeoCountryByName(project.brand_location);
  if (prompts.length === 0) {
    throw new Error("No active prompts found for this project");
  }
  const run = await prisma_default.run.create({
    data: {
      project_id: input.project_id,
      status: import_client11.VisibilityRunStatus.QUEUED,
      scheduled_for: input.scheduled_for
    }
  });
  const rows = [];
  for (const prompt of prompts) {
    for (const engine of engines) {
      rows.push({
        run_id: run.id,
        project_id: input.project_id,
        prompt_id: prompt.id,
        geo_country_code: projectCountry?.code,
        geo_country_name: projectCountry?.name,
        engine,
        status: import_client11.ScrapeJobStatus.QUEUED,
        profile: input.profile,
        scheduled_for: input.scheduled_for
      });
      if (prompt.geo_enabled && prompt.geo_variants.length > 0) {
        for (const variant of prompt.geo_variants) {
          rows.push({
            run_id: run.id,
            project_id: input.project_id,
            prompt_id: prompt.id,
            geo_variant_id: variant.id,
            geo_country_code: variant.country_code,
            geo_country_name: variant.country_name,
            geo_city: variant.city,
            engine,
            status: import_client11.ScrapeJobStatus.QUEUED,
            profile: input.profile,
            scheduled_for: input.scheduled_for
          });
        }
      }
    }
  }
  await prisma_default.scrapeJob.createMany({ data: rows });
  const jobs = await prisma_default.scrapeJob.findMany({
    where: { run_id: run.id },
    orderBy: { created_at: "asc" }
  });
  const baseDelayMs = Math.max(0, input.scheduled_for ? input.scheduled_for.getTime() - Date.now() : 0);
  const spacingMs = Number(process.env.SCRAPE_QUEUE_SPACING_MS ?? 45e3);
  if (input.enqueue_jobs !== false) {
    await Promise.all(jobs.map((job, index) => enqueueScrapeJob(job.id, baseDelayMs + index * spacingMs)));
  }
  return {
    run,
    jobs
  };
}
async function enqueueDailyRuns(options = {}) {
  const projects = await prisma_default.project.findMany({
    where: {
      prompts: {
        some: {
          is_active: true,
          status: "ACTIVE"
        }
      }
    },
    orderBy: { created_at: "asc" }
  });
  const results = [];
  const spacingMs = options.enqueue_jobs === false ? 0 : Number(process.env.PROJECT_DAILY_QUEUE_SPACING_MS ?? 9e5);
  for (let index = 0; index < projects.length; index += 1) {
    const existingTodayRun = await prisma_default.run.findFirst({
      where: {
        project_id: projects[index].id,
        ran_at: { gte: getRefreshWindowStart() }
      },
      orderBy: { ran_at: "desc" }
    });
    if (existingTodayRun) {
      continue;
    }
    const refreshCheck = await canRunRefresh(projects[index].user_id, projects[index].id);
    if (!refreshCheck.allowed) {
      continue;
    }
    const scheduled_for = new Date(Date.now() + index * spacingMs);
    results.push(await enqueueProjectRun({
      project_id: projects[index].id,
      scheduled_for,
      enqueue_jobs: options.enqueue_jobs
    }));
  }
  return results;
}
async function getScrapeRun(run_id) {
  return prisma_default.run.findUnique({
    where: { id: run_id },
    include: {
      scrape_jobs: {
        include: {
          prompt: true,
          chat: {
            include: {
              sources: true,
              brand_mentions: true
            }
          }
        },
        orderBy: { created_at: "asc" }
      }
    }
  });
}
var import_client11;
var init_scrape_orchestration_service = __esm({
  "src/features/scraping/scrape_orchestration_service.ts"() {
    import_client11 = require("@prisma/client");
    init_prisma();
    init_scrape_queue();
    init_countries();
    init_subscription_service();
    init_refresh_window();
    init_scrape_engine_policy();
    init_project_engines_service();
    init_scrape_gate();
  }
});

// src/features/agency/agency_service.ts
var agency_service_exports = {};
__export(agency_service_exports, {
  acceptAgencyInvitation: () => acceptAgencyInvitation,
  addAgencyClient: () => addAgencyClient,
  assertAgencyManager: () => assertAgencyManager,
  createAgencyInvitation: () => createAgencyInvitation,
  getAgencyContext: () => getAgencyContext,
  getAgencyPortfolio: () => getAgencyPortfolio,
  getClientProjects: () => getClientProjects,
  listAgencyClients: () => listAgencyClients,
  listAgencyDeliverables: () => listAgencyDeliverables,
  listAgencyMembers: () => listAgencyMembers,
  removeAgencyClient: () => removeAgencyClient,
  updateClientLinkStatus: () => updateClientLinkStatus,
  updateClientSettings: () => updateClientSettings
});
function agencyRoleCanManage(role) {
  return role === import_client14.AgencyMembershipRole.OWNER || role === import_client14.AgencyMembershipRole.ADMIN;
}
async function requireAgencyOwner(agencyUserId) {
  const user = await prisma_default.user.findUnique({ where: { id: agencyUserId }, select: { id: true, email: true, account_type: true, credits_balance: true } });
  if (!user || user.account_type !== "AGENCY") throw Object.assign(new Error("Agency account required"), { status: 403 });
  return user;
}
async function getAgencyContext(userId) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { id: true, email: true, account_type: true } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (user.account_type === "AGENCY") return { agency_user_id: user.id, role: import_client14.AgencyMembershipRole.OWNER };
  const membership = await prisma_default.agencyMembership.findFirst({
    where: { member_user_id: userId, status: import_client14.AgencyMembershipStatus.ACTIVE },
    select: { agency_user_id: true, role: true }
  });
  if (membership) return membership;
  const clientLink = await prisma_default.agencyClientLink.findFirst({
    where: { client_user_id: userId, status: "ACTIVE" },
    select: { agency_user_id: true, role: true }
  });
  return clientLink ? { agency_user_id: clientLink.agency_user_id, role: clientLink.role } : null;
}
async function assertAgencyManager(userId) {
  const context = await getAgencyContext(userId);
  if (!context || !agencyRoleCanManage(context.role)) throw Object.assign(new Error("Agency admin access required"), { status: 403 });
  await requireAgencyOwner(context.agency_user_id);
  return context;
}
async function listAgencyClients(agencyUserId) {
  const owner = await requireAgencyOwner(agencyUserId);
  const directProjects = await prisma_default.project.findMany({
    where: { user_id: agencyUserId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      brand_name: true,
      brand_url: true,
      brand_location: true,
      created_at: true,
      _count: { select: { prompts: true, runs: true, competitors: true } }
    }
  });
  const links = await prisma_default.agencyClientLink.findMany({
    where: { agency_user_id: agencyUserId },
    orderBy: { created_at: "desc" },
    include: {
      client: {
        select: {
          id: true,
          email: true,
          projects: {
            select: {
              id: true,
              brand_name: true,
              brand_url: true,
              brand_location: true,
              created_at: true,
              _count: { select: { prompts: true, runs: true, competitors: true } }
            }
          },
          _count: { select: { projects: true } }
        }
      }
    }
  });
  const allProjectIds = [
    ...directProjects.map((p) => p.id),
    ...links.flatMap((l) => l.client.projects.map((p) => p.id))
  ];
  const scoreMap = /* @__PURE__ */ new Map();
  if (allProjectIds.length > 0) {
    const chatAgg = await prisma_default.chat.groupBy({
      by: ["prompt_id"],
      where: {
        prompt: { project_id: { in: allProjectIds } }
      },
      _count: { id: true },
      _sum: { brand_mentioned: true }
    }).catch(() => []);
    const projectChats = await prisma_default.chat.findMany({
      where: {
        prompt: { project_id: { in: allProjectIds } }
      },
      select: {
        brand_mentioned: true,
        prompt: { select: { project_id: true } }
      }
    }).catch(() => []);
    const totals = /* @__PURE__ */ new Map();
    for (const chat of projectChats) {
      const pid = chat.prompt.project_id;
      const entry = totals.get(pid) ?? { total: 0, mentioned: 0 };
      entry.total++;
      if (chat.brand_mentioned) entry.mentioned++;
      totals.set(pid, entry);
    }
    for (const [pid, { total, mentioned }] of totals.entries()) {
      if (total > 0) scoreMap.set(pid, Math.round(mentioned / total * 100));
    }
  }
  const results = [];
  if (directProjects.length > 0) {
    results.push({
      link_id: `agency-direct-${owner.id}`,
      client_user_id: owner.id,
      client_email: owner.email,
      role: "OWNER",
      status: "ACTIVE",
      category: "Agency Direct",
      monthly_credit_cap: owner.credits_balance,
      assigned_manager_id: null,
      linked_at: /* @__PURE__ */ new Date(),
      project_count: directProjects.length,
      projects: directProjects.map((p) => ({
        id: p.id,
        brand_name: p.brand_name,
        brand_url: p.brand_url,
        brand_location: p.brand_location,
        created_at: p.created_at,
        ai_visibility_score: scoreMap.get(p.id),
        prompts_count: p._count.prompts,
        runs_count: p._count.runs,
        competitors_count: p._count.competitors
      }))
    });
  }
  for (const link of links) {
    results.push({
      link_id: link.id,
      client_user_id: link.client_user_id,
      client_email: link.client.email,
      role: link.role,
      status: link.status,
      category: link.category ?? "Client Workspace",
      monthly_credit_cap: link.monthly_credit_cap ?? 1e4,
      assigned_manager_id: link.assigned_manager_id ?? null,
      linked_at: link.created_at,
      project_count: link.client._count.projects,
      projects: link.client.projects.map((p) => ({
        id: p.id,
        brand_name: p.brand_name,
        brand_url: p.brand_url,
        brand_location: p.brand_location,
        created_at: p.created_at,
        ai_visibility_score: scoreMap.get(p.id),
        prompts_count: p._count.prompts,
        runs_count: p._count.runs,
        competitors_count: p._count.competitors
      }))
    });
  }
  return results;
}
async function getAgencyPortfolio(agencyUserId) {
  const owner = await requireAgencyOwner(agencyUserId);
  const [clients, members, branding] = await Promise.all([
    listAgencyClients(agencyUserId),
    listAgencyMembers(agencyUserId),
    prisma_default.agencyBranding.findUnique({ where: { agency_user_id: agencyUserId } })
  ]);
  const totalProjects = clients.reduce((sum, c) => sum + (c.project_count || c.projects.length), 0);
  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
  const allScores = clients.flatMap((c) => c.projects.map((p) => p.ai_visibility_score).filter((s) => typeof s === "number"));
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  return {
    agency_id: owner.id,
    agency_email: owner.email,
    credits_balance: owner.credits_balance,
    total_clients: clients.length,
    active_clients: activeClients,
    total_projects: totalProjects,
    total_team_members: members.length,
    avg_ai_visibility_score: avgScore,
    white_label_enabled: branding?.enable_white_label ?? false,
    branding: branding ?? {
      brand_name: "Agency Portal",
      primary_color: "#2563eb",
      accent_color: "#0f172a",
      portal_title: "Client Intelligence Portal",
      enable_white_label: false
    },
    clients,
    team_members: members
  };
}
async function listAgencyDeliverables(agencyUserId, projectId) {
  const context = await getAgencyContext(agencyUserId);
  if (!context) throw Object.assign(new Error("Agency access required"), { status: 403 });
  const clients = await listAgencyClients(context.agency_user_id);
  const allProjects = clients.flatMap((c) => c.projects);
  const targetProjectIds = projectId ? allProjects.filter((p) => p.id === projectId).map((p) => p.id) : allProjects.map((p) => p.id);
  if (targetProjectIds.length === 0) return [];
  const [briefs, aiReports, seoAudits] = await Promise.all([
    prisma_default.contentBrief.findMany({
      where: { project_id: { in: targetProjectIds } },
      orderBy: { created_at: "desc" },
      take: 20,
      include: { project: { select: { id: true, brand_name: true } } }
    }),
    prisma_default.aIReport.findMany({
      where: { project_id: { in: targetProjectIds } },
      orderBy: { created_at: "desc" },
      take: 20,
      include: { project: { select: { id: true, brand_name: true } } }
    }),
    prisma_default.seoAudit.findMany({
      where: { project_id: { in: targetProjectIds } },
      orderBy: { created_at: "desc" },
      take: 20,
      include: { project: { select: { id: true, brand_name: true } } }
    })
  ]);
  const deliverables = [];
  for (const b of briefs) {
    deliverables.push({
      id: b.id,
      title: b.title || `Content Brief: ${b.primary_keyword}`,
      type: "BRIEF",
      clientName: b.project.brand_name,
      projectId: b.project.id,
      targetKeyword: b.primary_keyword,
      status: b.status || "READY",
      date: new Date(b.created_at).toLocaleDateString(),
      createdAt: b.created_at
    });
  }
  for (const r of aiReports) {
    deliverables.push({
      id: r.id,
      title: r.title || `${r.project.brand_name} AI Visibility Intelligence Report`,
      type: "AI_REPORT",
      clientName: r.project.brand_name,
      projectId: r.project.id,
      status: r.status || "COMPLETED",
      date: new Date(r.created_at).toLocaleDateString(),
      createdAt: r.created_at
    });
  }
  for (const a of seoAudits) {
    deliverables.push({
      id: a.id,
      title: `SEO Technical & AI Readiness Audit (Score: ${a.overall_score}%)`,
      type: "SEO_AUDIT",
      clientName: a.project.brand_name,
      projectId: a.project.id,
      status: a.status || "COMPLETED",
      date: new Date(a.created_at).toLocaleDateString(),
      createdAt: a.created_at
    });
  }
  deliverables.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return deliverables;
}
async function updateClientSettings(agencyUserId, clientUserId, input) {
  await assertAgencyManager(agencyUserId);
  const updated = await prisma_default.agencyClientLink.updateMany({
    where: { agency_user_id: agencyUserId, client_user_id: clientUserId },
    data: {
      category: input.category !== void 0 ? input.category.trim() : void 0,
      monthly_credit_cap: input.monthly_credit_cap !== void 0 ? input.monthly_credit_cap : void 0,
      assigned_manager_id: input.assigned_manager_id !== void 0 ? input.assigned_manager_id : void 0,
      role: input.role !== void 0 ? input.role : void 0
    }
  });
  if (!updated.count) throw Object.assign(new Error("Client link not found"), { status: 404 });
  return { agency_user_id: agencyUserId, client_user_id: clientUserId, ...input };
}
async function listAgencyMembers(agencyUserId) {
  await requireAgencyOwner(agencyUserId);
  const owner = await prisma_default.user.findUniqueOrThrow({ where: { id: agencyUserId }, select: { id: true, email: true } });
  const members = await prisma_default.agencyMembership.findMany({
    where: { agency_user_id: agencyUserId },
    orderBy: { created_at: "asc" },
    include: { member: { select: { id: true, email: true, is_verified: true } } }
  });
  return [{ id: owner.id, email: owner.email, role: import_client14.AgencyMembershipRole.OWNER, status: "ACTIVE" }, ...members.map((m) => ({ id: m.member_user_id, email: m.member.email, role: m.role, status: m.status }))];
}
async function createAgencyInvitation(input) {
  const context = await assertAgencyManager(input.actorUserId);
  if (input.type === import_client14.AgencyInvitationType.TEAM_MEMBER && !STAFF_ROLES.has(input.role)) throw Object.assign(new Error("Invalid team role"), { status: 400 });
  if (input.type === import_client14.AgencyInvitationType.CLIENT_USER && input.role !== import_client14.AgencyMembershipRole.CLIENT_ADMIN && input.role !== import_client14.AgencyMembershipRole.CLIENT_VIEWER) throw Object.assign(new Error("Invalid client role"), { status: 400 });
  const email = input.email.trim().toLowerCase();
  const existing = await prisma_default.user.findUnique({ where: { email }, select: { id: true, account_type: true } });
  if (existing?.id === context.agency_user_id) throw Object.assign(new Error("You cannot invite yourself"), { status: 400 });
  if (input.type === import_client14.AgencyInvitationType.TEAM_MEMBER && existing?.account_type === "AGENCY") throw Object.assign(new Error("Agency accounts cannot join another agency"), { status: 400 });
  await prisma_default.agencyInvitation.updateMany({ where: { agency_user_id: context.agency_user_id, email, status: import_client14.AgencyInvitationStatus.PENDING }, data: { status: import_client14.AgencyInvitationStatus.REVOKED } });
  const token = import_crypto4.default.randomBytes(32).toString("hex");
  const invitation = await prisma_default.agencyInvitation.create({
    data: { agency_user_id: context.agency_user_id, invitee_user_id: existing?.id, email, type: input.type, role: input.role, token, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3), assigned_project_ids: input.assignedProjectIds ?? [] },
    include: { agency: { select: { email: true } } }
  });
  const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  try {
    await sendAgencyInvitationEmail(email, invitation.agency.email, `${appUrl}/agency/invitations/${token}`);
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    console.warn(`[DEV AGENCY INVITE] ${appUrl}/agency/invitations/${token}`);
  }
  return { id: invitation.id, email, type: input.type, role: input.role, expires_at: invitation.expires_at, invite_url: `${appUrl}/agency/invitations/${token}` };
}
async function acceptAgencyInvitation(token, password) {
  const invitation = await prisma_default.agencyInvitation.findUnique({ where: { token }, include: { agency: { select: { id: true, account_type: true } } } });
  if (!invitation || invitation.status !== import_client14.AgencyInvitationStatus.PENDING || invitation.expires_at < /* @__PURE__ */ new Date()) throw Object.assign(new Error("Invitation is invalid or expired"), { status: 400 });
  let user = invitation.invitee_user_id ? await prisma_default.user.findUnique({ where: { id: invitation.invitee_user_id } }) : await prisma_default.user.findUnique({ where: { email: invitation.email } });
  if (user?.account_type === "AGENCY") throw Object.assign(new Error("Agency accounts cannot be invited into another agency"), { status: 400 });
  if (!user) {
    if (!password || password.length < 8) throw Object.assign(new Error("A password of at least 8 characters is required"), { status: 400 });
    user = await prisma_default.user.create({ data: { email: invitation.email, password: await import_bcryptjs2.default.hash(password, 10), account_type: "SINGLE", is_verified: true, product_tour_completed: true } });
  }
  if (invitation.type === import_client14.AgencyInvitationType.TEAM_MEMBER) {
    await prisma_default.agencyMembership.upsert({ where: { agency_user_id_member_user_id: { agency_user_id: invitation.agency_user_id, member_user_id: user.id } }, create: { agency_user_id: invitation.agency_user_id, member_user_id: user.id, role: invitation.role, status: import_client14.AgencyMembershipStatus.ACTIVE }, update: { role: invitation.role, status: import_client14.AgencyMembershipStatus.ACTIVE } });
  } else {
    await prisma_default.agencyClientLink.upsert({ where: { agency_user_id_client_user_id: { agency_user_id: invitation.agency_user_id, client_user_id: user.id } }, create: { agency_user_id: invitation.agency_user_id, client_user_id: user.id, role: invitation.role === import_client14.AgencyMembershipRole.CLIENT_VIEWER ? "CLIENT_VIEWER" : "CLIENT_ADMIN", status: "ACTIVE", assigned_project_ids: invitation.assigned_project_ids }, update: { role: invitation.role === import_client14.AgencyMembershipRole.CLIENT_VIEWER ? "CLIENT_VIEWER" : "CLIENT_ADMIN", status: "ACTIVE", assigned_project_ids: invitation.assigned_project_ids } });
  }
  await prisma_default.agencyInvitation.update({ where: { id: invitation.id }, data: { status: import_client14.AgencyInvitationStatus.ACCEPTED, invitee_user_id: user.id } });
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  return {
    user_id: user.id,
    email: user.email,
    type: invitation.type,
    role: invitation.role,
    agency_user_id: invitation.agency_user_id,
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      email: user.email,
      account_type: user.account_type,
      role: user.role,
      plan: user.plan,
      is_verified: user.is_verified,
      credits_balance: user.credits_balance
    }
  };
}
async function addAgencyClient(agencyUserId, clientEmail) {
  const existing = await prisma_default.user.findUnique({ where: { email: clientEmail.trim().toLowerCase() }, select: { id: true, is_verified: true, account_type: true } });
  if (existing) {
    await assertAgencyManager(agencyUserId);
    if (!existing.is_verified) throw Object.assign(new Error("That user has not verified their email yet"), { status: 400 });
    if (existing.account_type === "AGENCY") throw Object.assign(new Error("Cannot link another agency account"), { status: 400 });
    return prisma_default.agencyClientLink.upsert({ where: { agency_user_id_client_user_id: { agency_user_id: agencyUserId, client_user_id: existing.id } }, create: { agency_user_id: agencyUserId, client_user_id: existing.id }, update: { status: "ACTIVE" } });
  }
  return createAgencyInvitation({ actorUserId: agencyUserId, email: clientEmail, type: import_client14.AgencyInvitationType.CLIENT_USER, role: import_client14.AgencyMembershipRole.CLIENT_ADMIN });
}
async function updateClientLinkStatus(agencyUserId, clientUserId, status) {
  await assertAgencyManager(agencyUserId);
  const updated = await prisma_default.agencyClientLink.updateMany({ where: { agency_user_id: agencyUserId, client_user_id: clientUserId }, data: { status } });
  if (!updated.count) throw Object.assign(new Error("Client link not found"), { status: 404 });
  return { agency_user_id: agencyUserId, client_user_id: clientUserId, status };
}
async function removeAgencyClient(agencyUserId, clientUserId) {
  await assertAgencyManager(agencyUserId);
  await prisma_default.agencyClientLink.deleteMany({ where: { agency_user_id: agencyUserId, client_user_id: clientUserId } });
  return { removed: true };
}
async function getClientProjects(agencyUserId, clientUserId) {
  const context = await getAgencyContext(agencyUserId);
  if (!context || context.agency_user_id !== agencyUserId) throw Object.assign(new Error("Agency access required"), { status: 403 });
  const link = await prisma_default.agencyClientLink.findUnique({ where: { agency_user_id_client_user_id: { agency_user_id: agencyUserId, client_user_id: clientUserId } } });
  if (!link || link.status !== "ACTIVE") throw Object.assign(new Error("No active client link found"), { status: 404 });
  return prisma_default.project.findMany({ where: { user_id: clientUserId }, orderBy: { created_at: "asc" }, select: { id: true, brand_name: true, brand_url: true, brand_location: true, created_at: true, updated_at: true, _count: { select: { prompts: true, competitors: true, runs: true } } } });
}
var import_bcryptjs2, import_crypto4, import_client14, STAFF_ROLES;
var init_agency_service = __esm({
  "src/features/agency/agency_service.ts"() {
    import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
    import_crypto4 = __toESM(require("crypto"), 1);
    import_client14 = require("@prisma/client");
    init_prisma();
    init_email_service();
    init_jwt();
    STAFF_ROLES = /* @__PURE__ */ new Set([import_client14.AgencyMembershipRole.ADMIN, import_client14.AgencyMembershipRole.MANAGER, import_client14.AgencyMembershipRole.ANALYST]);
  }
});

// src/features/scraping/article_cleanup_service.ts
async function cleanupOldArticleContents() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  try {
    const result = await prisma_default.sourceUrlContent.deleteMany({
      where: {
        updated_at: {
          lt: twentyFourHoursAgo
        }
      }
    });
    console.log(`[cleanupOldArticleContents] Deleted ${result.count} old article records (older than 24h).`);
    return result.count;
  } catch (error) {
    console.error("[cleanupOldArticleContents] Failed to clean up old articles:", error);
    throw error;
  }
}
var init_article_cleanup_service = __esm({
  "src/features/scraping/article_cleanup_service.ts"() {
    init_prisma();
  }
});

// src/scheduler/daily_scheduler.ts
var daily_scheduler_exports = {};
var import_config, import_node_cron, expression, timezone;
var init_daily_scheduler = __esm({
  "src/scheduler/daily_scheduler.ts"() {
    import_config = require("dotenv/config");
    import_node_cron = __toESM(require("node-cron"), 1);
    init_scrape_orchestration_service();
    init_article_cleanup_service();
    init_scrape_gate();
    expression = process.env.DAILY_SCRAPE_CRON ?? "0 0 * * *";
    timezone = process.env.DAILY_SCRAPE_TIMEZONE ?? "Asia/Kolkata";
    import_node_cron.default.schedule(expression, async () => {
      if (isScrapingDisabled()) {
        console.log("Daily scrape scheduler skipped: scraping is disabled for all projects");
        return;
      }
      try {
        const runs = await enqueueDailyRuns();
        console.log(`Daily scrape scheduler enqueued ${runs.length} project runs`);
        await cleanupOldArticleContents();
      } catch (error) {
        console.error("Daily scrape scheduler failed", error);
      }
    }, { timezone });
    console.log(`Daily scrape scheduler active: ${expression} ${timezone}; scraping disabled=${isScrapingDisabled()}`);
  }
});

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);

// src/lib/env.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_url = require("url");
var __filename = (0, import_url.fileURLToPath)(__importMetaUrl);
var __dirname = import_path.default.dirname(__filename);
var candidatePaths = [
  import_path.default.resolve(process.cwd(), ".env"),
  import_path.default.resolve(__dirname, "../../../.env"),
  import_path.default.resolve(__dirname, "../../../agents/.env"),
  import_path.default.resolve(__dirname, "../../.env")
];
for (const envPath of candidatePaths) {
  if (import_fs.default.existsSync(envPath)) {
    import_dotenv.default.config({ path: envPath, override: false });
  }
}

// server.ts
var import_express29 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_helmet = __toESM(require("helmet"), 1);

// src/features/auth/auth_routes.ts
var import_express = require("express");

// src/features/auth/auth_controller.ts
var import_zod = require("zod");

// src/features/auth/auth_service.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);
init_prisma();

// src/utils/email.ts
var import_crypto = __toESM(require("crypto"), 1);
var BLOCKED_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "gmx.com",
  "mail.com"
];
function isWorkEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !BLOCKED_DOMAINS.includes(domain);
}
function generateOtp() {
  return import_crypto.default.randomInt(1e5, 1e6).toString();
}

// src/features/auth/auth_service.ts
init_jwt();
init_email_service();
init_entitlements();
init_credits_service();
init_credits_config();
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);
var TIMING_EQUALISER_HASH = "$2b$10$tH3e8THL4wq4Kb2zqHJ2ouiz8eA6FPwidbQMy89YYe29wBRSL5t4G";
function getOtpHashSecret() {
  const secret = process.env.OTP_HASH_SECRET?.trim();
  if (!secret) {
    throw new Error("OTP_HASH_SECRET is not configured; refusing to hash OTPs without a key.");
  }
  return secret;
}
function hashOtp(otp) {
  return import_crypto2.default.createHmac("sha256", getOtpHashSecret()).update(otp, "utf8").digest("hex");
}
function otpMatches(storedHash, otp) {
  if (!storedHash) return false;
  const stored = Buffer.from(storedHash, "utf8");
  const candidate = Buffer.from(hashOtp(otp), "utf8");
  if (stored.length !== candidate.length) return false;
  return import_crypto2.default.timingSafeEqual(stored, candidate);
}
var DEV_OTP_FALLBACK_ENVS = /* @__PURE__ */ new Set(["development", "test"]);
function isDevOtpFallbackAllowed() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  if (!nodeEnv || !DEV_OTP_FALLBACK_ENVS.has(nodeEnv)) return false;
  return process.env.EMAIL_DEV_OTP_FALLBACK === "true";
}
async function verifyUserOtp(email, otp) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma_default.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new Error("User not found");
  }
  if (user.is_verified) {
    throw new Error("User is already verified");
  }
  if (!otpMatches(user.otp, otp)) {
    throw new Error("Invalid OTP");
  }
  if (!user.otp_expires_at || user.otp_expires_at < /* @__PURE__ */ new Date()) {
    throw new Error("OTP has expired");
  }
  const updatedUser = await prisma_default.user.update({
    where: { id: user.id },
    data: {
      is_verified: true,
      otp: null,
      otp_expires_at: null
    },
    select: {
      id: true,
      email: true,
      account_type: true,
      role: true,
      plan: true,
      is_verified: true
    }
  });
  await ensureFreeTrialSubscription(updatedUser.id);
  const currentUser = await prisma_default.user.findUnique({ where: { id: updatedUser.id }, select: { credits_balance: true } });
  const signupBonus = signupBonusFor(updatedUser.account_type);
  if ((currentUser?.credits_balance ?? 0) === 0) {
    await awardCredits(updatedUser.id, signupBonus, "SIGNUP_BONUS", `${signupBonus} free trial credits on account verification`);
  }
  const access = await getEffectivePlanAccess(updatedUser.id);
  const finalUser = await prisma_default.user.findUnique({ where: { id: updatedUser.id }, select: { credits_balance: true } });
  const accessToken = generateAccessToken(updatedUser.id);
  const refreshToken = generateRefreshToken(updatedUser.id);
  return {
    message: "Email verified successfully",
    user: { ...updatedUser, effective_plan: access.effective_plan, credits_balance: finalUser?.credits_balance ?? signupBonus },
    access_token: accessToken,
    refresh_token: refreshToken,
    accessToken,
    refreshToken
  };
}
async function registerUser(input) {
  const email = input.email.trim().toLowerCase();
  const { password, account_type } = input;
  if (!isWorkEmail(email)) {
    throw new Error("Only work/business email addresses are allowed.");
  }
  const existing = await prisma_default.user.findUnique({ where: { email } });
  if (existing?.is_verified) {
    throw new Error("An account with this email already exists.");
  }
  const salt = await import_bcryptjs.default.genSalt(10);
  const hashedPassword = await import_bcryptjs.default.hash(password, salt);
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  const user = existing ? await prisma_default.user.update({
    where: { id: existing.id },
    data: {
      password: hashedPassword,
      account_type,
      is_verified: false,
      otp: otpHash,
      otp_expires_at: otpExpiresAt
    },
    select: {
      id: true,
      email: true,
      account_type: true,
      role: true,
      plan: true,
      is_verified: true
    }
  }) : await prisma_default.user.create({
    data: {
      email,
      password: hashedPassword,
      account_type,
      is_verified: false,
      otp: otpHash,
      otp_expires_at: otpExpiresAt
    },
    select: {
      id: true,
      email: true,
      account_type: true,
      role: true,
      plan: true,
      is_verified: true
    }
  });
  try {
    await sendVerificationOtpEmail(email, otp);
  } catch (error) {
    if (!isDevOtpFallbackAllowed()) throw error;
    console.warn(`[DEV-ONLY OTP FALLBACK \u2014 never runs in production] Could not send verification email to ${email}. Use OTP: ${otp}`);
  }
  return {
    message: "Verification code sent.",
    user
  };
}
async function login(input) {
  const email = input.email.trim().toLowerCase();
  const { password } = input;
  const user = await prisma_default.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      account_type: true,
      role: true,
      plan: true,
      credits_balance: true,
      is_verified: true
    }
  });
  const isPasswordValid = await import_bcryptjs.default.compare(password, user?.password ?? TIMING_EQUALISER_HASH);
  if (!user || !isPasswordValid) {
    throw new Error("email or password is incorrect");
  }
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  if (!user.is_verified) {
    throw new Error("please verify your email");
  }
  await ensureFreeTrialSubscription(user.id);
  const access = await getEffectivePlanAccess(user.id);
  return {
    message: "welcome back",
    user: {
      id: user.id,
      email: user.email,
      account_type: user.account_type,
      role: user.role,
      plan: user.plan,
      effective_plan: access.effective_plan,
      is_verified: user.is_verified,
      credits_balance: user.credits_balance
    },
    access_token: accessToken,
    refresh_token: refreshToken
  };
}
async function sendForgotPasswordOtp(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma_default.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, is_verified: true }
  });
  if (!user?.is_verified) {
    return { message: "If this account exists, an OTP has been sent." };
  }
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  await prisma_default.user.update({
    where: { id: user.id },
    data: {
      otp: otpHash,
      otp_expires_at: otpExpiresAt
    }
  });
  try {
    await sendVerificationOtpEmail(normalizedEmail, otp);
  } catch (error) {
    if (!isDevOtpFallbackAllowed()) throw error;
    console.warn(`[DEV-ONLY OTP FALLBACK \u2014 never runs in production] Could not send password reset OTP to ${normalizedEmail}. Use OTP: ${otp}`);
  }
  return { message: "If this account exists, an OTP has been sent." };
}
async function resetPasswordWithOtp(email, otp, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma_default.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.is_verified) {
    throw new Error("Invalid or expired OTP");
  }
  if (!otpMatches(user.otp, otp)) {
    throw new Error("Invalid or expired OTP");
  }
  if (!user.otp_expires_at || user.otp_expires_at < /* @__PURE__ */ new Date()) {
    throw new Error("Invalid or expired OTP");
  }
  const salt = await import_bcryptjs.default.genSalt(10);
  const hashedPassword = await import_bcryptjs.default.hash(password, salt);
  await prisma_default.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      otp: null,
      otp_expires_at: null
    }
  });
  return { message: "Password updated successfully" };
}
async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = import_jsonwebtoken2.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
  if (!payload.sub) throw new Error("Invalid refresh token");
  const user = await prisma_default.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, is_verified: true }
  });
  if (!user || !user.is_verified) throw new Error("Invalid refresh user");
  return {
    access_token: generateAccessToken(user.id),
    refresh_token: generateRefreshToken(user.id)
  };
}

// src/utils/auth_cookies.ts
var ACCESS_TOKEN_COOKIE = "access_token";
var REFRESH_TOKEN_COOKIE = "refresh_token";
var PRODUCTION_COOKIE_DOMAIN = ".deepmention.xyz";
var FALLBACK_ACCESS_TTL_SECONDS = 12 * 60 * 60;
var FALLBACK_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
var SECONDS_PER_UNIT = {
  ms: 1 / 1e3,
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60
};
function isProduction() {
  return process.env.NODE_ENV === "production";
}
function parseTtlSeconds(value, fallbackSeconds) {
  const raw = value?.trim();
  if (!raw) return fallbackSeconds;
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i.exec(raw);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;
  const seconds = Math.floor(amount * SECONDS_PER_UNIT[(match[2] ?? "s").toLowerCase()]);
  return seconds > 0 ? seconds : fallbackSeconds;
}
function accessTokenTtlSeconds() {
  return parseTtlSeconds(process.env.JWT_ACCESS_EXPIRES_IN, FALLBACK_ACCESS_TTL_SECONDS);
}
function refreshTokenTtlSeconds() {
  return parseTtlSeconds(process.env.JWT_REFRESH_EXPIRES_IN, FALLBACK_REFRESH_TTL_SECONDS);
}
function baseCookieOptions() {
  return {
    httpOnly: true,
    // `secure` would make the cookie unusable over plain http://localhost in development.
    secure: isProduction(),
    // 'lax' rather than 'strict': the two hosts are same-site, so XHR still carries the
    // cookie, while a top-level navigation arriving from an external link keeps the session.
    sameSite: "lax",
    path: "/",
    ...isProduction() ? { domain: PRODUCTION_COOKIE_DOMAIN } : {}
  };
}
function setAuthCookies(res, tokens2) {
  const options = baseCookieOptions();
  if (tokens2.access_token) {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens2.access_token, {
      ...options,
      maxAge: accessTokenTtlSeconds() * 1e3
    });
  }
  if (tokens2.refresh_token) {
    res.cookie(REFRESH_TOKEN_COOKIE, tokens2.refresh_token, {
      ...options,
      maxAge: refreshTokenTtlSeconds() * 1e3
    });
  }
}
function clearAuthCookies(res) {
  const options = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
}
function parseCookieHeader(header2) {
  const cookies = /* @__PURE__ */ Object.create(null);
  if (!header2) return cookies;
  for (const pair of header2.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    if (!name || Object.prototype.hasOwnProperty.call(cookies, name)) continue;
    let value = pair.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}
function readCookie(req, name) {
  const parsed = req.cookies;
  const fromParser = parsed?.[name];
  if (typeof fromParser === "string" && fromParser) return fromParser;
  const value = parseCookieHeader(req.headers.cookie)[name];
  return value ? value : void 0;
}
function readAccessTokenCookie(req) {
  return readCookie(req, ACCESS_TOKEN_COOKIE);
}
function readRefreshTokenCookie(req) {
  return readCookie(req, REFRESH_TOKEN_COOKIE);
}

// src/features/auth/auth_controller.ts
var EXPECTED_AUTH_ERRORS = /* @__PURE__ */ new Set([
  "User not found",
  "User is already verified",
  "Invalid OTP",
  "OTP has expired",
  "Only work/business email addresses are allowed.",
  "An account with this email already exists.",
  "email or password is incorrect",
  "please verify your email",
  "Invalid or expired OTP",
  "Invalid or expired refresh token",
  "Invalid refresh token",
  "Invalid refresh user"
]);
function clientMessage(err, route, fallback) {
  const message = err instanceof Error ? err.message : "";
  if (EXPECTED_AUTH_ERRORS.has(message)) return message;
  console.error(`[auth_controller:${route}]`, err);
  return fallback;
}
var registerSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email format"),
  password: import_zod.z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one number"),
  account_type: import_zod.z.enum(["SINGLE", "AGENCY"], {
    error: "account_type must be SINGLE or AGENCY"
  })
});
async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const result = await registerUser(parsed.data);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    const isEmailDeliveryError = message.includes("Brevo email send failed");
    const status = message.includes("already exists") ? 409 : message.includes("work/business") ? 422 : isEmailDeliveryError ? 502 : 500;
    if (status === 500) {
      console.error("[auth_controller:register]", err);
      res.status(500).json({ success: false, message: "Registration failed. Please try again." });
      return;
    }
    res.status(status).json({
      success: false,
      message: isEmailDeliveryError ? "We could not send your verification code right now. Please try again in a moment." : message
    });
  }
}
var verifyOtpSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email format"),
  otp: import_zod.z.string().length(6, "OTP must be exactly 6 digits")
});
async function verifyOtp(req, res) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const result = await verifyUserOtp(parsed.data.email, parsed.data.otp);
    setAuthCookies(res, result);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: clientMessage(err, "verifyOtp", "Verification failed") });
  }
}
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string()
});
var forgotPasswordOtpSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email format")
});
var resetPasswordSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email format"),
  otp: import_zod.z.string().length(6, "OTP must be exactly 6 digits"),
  password: import_zod.z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one number")
});
async function login2(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const result = await login(parsed.data);
    setAuthCookies(res, result);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    if (message.includes("Can't reach database") || message.includes("DatabaseNotReachable") || message.includes("P1001")) {
      res.status(503).json({ success: false, message: "Database is currently unreachable. Please check database connection." });
      return;
    }
    if (message.toLowerCase().includes("verify your email")) {
      res.status(403).json({ success: false, message: "Please verify your email using the verification code sent to your inbox before logging in." });
      return;
    }
    res.status(401).json({ success: false, message: clientMessage(err, "login", "Login failed") });
  }
}
async function forgotPasswordSendOtp(req, res) {
  const parsed = forgotPasswordOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const result = await sendForgotPasswordOtp(parsed.data.email);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send password reset OTP";
    const isEmailDeliveryError = message.includes("Brevo email send failed");
    if (!isEmailDeliveryError) console.error("[auth_controller:forgotPasswordSendOtp]", err);
    res.status(isEmailDeliveryError ? 502 : 500).json({
      success: false,
      message: isEmailDeliveryError ? "We could not send your password reset code right now. Please try again in a moment." : "Failed to send password reset code. Please try again."
    });
  }
}
async function forgotPasswordReset(req, res) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const result = await resetPasswordWithOtp(parsed.data.email, parsed.data.otp, parsed.data.password);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: clientMessage(err, "forgotPasswordReset", "Failed to reset password") });
  }
}
var refreshSchema = import_zod.z.object({
  refresh_token: import_zod.z.string().min(1)
});
async function refresh(req, res) {
  const parsed = refreshSchema.safeParse(req.body);
  const refreshToken = parsed.success ? parsed.data.refresh_token : readRefreshTokenCookie(req);
  if (!refreshToken) {
    res.status(401).json({ success: false, message: "Refresh token is required" });
    return;
  }
  try {
    const tokens2 = await refreshAccessToken(refreshToken);
    setAuthCookies(res, tokens2);
    res.status(200).json({ success: true, ...tokens2 });
  } catch (err) {
    res.status(401).json({ success: false, message: clientMessage(err, "refresh", "Session expired") });
  }
}
async function logout(_req, res) {
  clearAuthCookies(res);
  res.status(200).json({ success: true, message: "Logged out" });
}

// src/middleware/rate_limit.ts
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
function emailOf(req) {
  const email = req.body?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}
function ipAndEmailKey(req) {
  return `${(0, import_express_rate_limit.ipKeyGenerator)(req.ip ?? "")}|${emailOf(req)}`;
}
var TOO_MANY = { error: "Too many attempts. Please wait a few minutes and try again." };
var authAttemptLimiter = (0, import_express_rate_limit.default)({
  windowMs: 10 * 60 * 1e3,
  limit: 10,
  keyGenerator: ipAndEmailKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY
});
var otpRequestLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 60 * 1e3,
  limit: 5,
  keyGenerator: ipAndEmailKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY
});
var authRouteLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  limit: 50,
  keyGenerator: (req) => (0, import_express_rate_limit.ipKeyGenerator)(req.ip ?? ""),
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY
});

// src/features/auth/auth_routes.ts
var router = (0, import_express.Router)();
router.use(authRouteLimiter);
router.post("/register", otpRequestLimiter, register);
router.post("/verify", authAttemptLimiter, verifyOtp);
router.post("/login", authAttemptLimiter, login2);
router.post("/forgot-password/send-otp", otpRequestLimiter, forgotPasswordSendOtp);
router.post("/forgot-password/reset", authAttemptLimiter, forgotPasswordReset);
router.post("/refresh", refresh);
router.post("/logout", logout);
var auth_routes_default = router;

// src/features/onboarding/onboarding_routes.ts
var import_express2 = require("express");

// src/features/llm/parallel_service.ts
var import_parallel_web = __toESM(require("parallel-web"), 1);
async function researchBrand(brand_name, brand_url) {
  if (!process.env.PARALLEL_API_KEY) {
    throw new Error("PARALLEL_API_KEY is missing; Parallel fallback cannot run.");
  }
  const client = new import_parallel_web.default({ apiKey: process.env.PARALLEL_API_KEY });
  const taskRun = await client.taskRun.create({
    input: { brand_name, brand_url },
    processor: "base",
    task_spec: {
      input_schema: {
        type: "json",
        json_schema: {
          type: "object",
          properties: {
            brand_name: { type: "string", description: "The name of the brand to research" },
            brand_url: { type: "string", description: "The official website URL of the brand" }
          },
          required: ["brand_name", "brand_url"]
        }
      },
      output_schema: {
        type: "json",
        json_schema: {
          type: "object",
          properties: {
            tagline: { type: "string", description: "Official tagline or slogan of the brand" },
            description: { type: "string", description: "A 2-4 sentence summary of what the brand does" },
            industry: { type: "string", description: "The primary industry the brand operates in" },
            founded: { type: "string", description: "Founding year of the brand if publicly known" },
            headquarters: { type: "string", description: "City and country of the brand headquarters" },
            employee_count: {
              type: "string",
              enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"],
              description: "Approximate number of employees"
            },
            business_model: { type: "string", description: "How the brand makes money (e.g. SaaS, D2C, marketplace)" },
            target_audience: { type: "string", description: "Who the brand primarily targets or sells to" },
            key_products_services: { type: "string", description: "Main products or services offered by the brand" },
            pricing_model: { type: "string", description: "How the brand prices its offerings if publicly visible" },
            competitors: { type: "string", description: "Top 3-5 known competitors of the brand" },
            recent_news: { type: "string", description: "Any notable recent news, launches or updates" },
            social_presence: { type: "string", description: "Key social media channels and approximate follower counts" },
            tone_and_voice: { type: "string", description: "Brand tone: professional, playful, bold, minimal, etc." },
            unique_value_proposition: { type: "string", description: "What makes this brand different from competitors" }
          },
          required: [
            "description",
            "industry",
            "business_model",
            "target_audience",
            "key_products_services",
            "competitors",
            "tone_and_voice",
            "unique_value_proposition"
          ],
          additionalProperties: false
        }
      }
    }
  });
  let runResult;
  for (let i = 0; i < 144; i++) {
    try {
      runResult = await client.taskRun.result(taskRun.run_id, { timeout: 25 });
      break;
    } catch {
      if (i === 143) throw new Error("Brand research timed out");
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
  const content = runResult.output.content;
  return {
    brand_name,
    brand_url,
    run_id: taskRun.run_id,
    data: content
  };
}

// src/features/llm/gemini_service.ts
var import_generative_ai = require("@google/generative-ai");
var import_axios3 = __toESM(require("axios"), 1);
var import_https3 = __toESM(require("https"), 1);

// src/prompts/brand_prompts.ts
function buildBrandPromptGenerationSystemPrompt() {
  return `You are an expert Generative Engine Optimization strategist.

Create realistic questions buyers ask ChatGPT, Gemini, Perplexity, Copilot, and Google AI Mode. Build a balanced tracking library across the buying journey, not a list of repetitive SEO keywords.

Your prompts must reflect:
- category discovery, problem/solution, comparison, alternatives, pricing, trust, and implementation intent
- the brand's actual audience, use cases, industry vocabulary, and buying constraints
- both unbranded discovery and realistic branded evaluation
- concise topic clusters that make performance understandable in a dashboard

Never output slogans, keyword fragments, numbered placeholder topics, or formal questions that a real buyer would not ask.`;
}
function buildBrandPromptGenerationUserPrompt(brand_name, brand_url, brand_data) {
  const competitors = String(brand_data.competitors ?? "");
  const industry = String(brand_data.industry ?? "");
  const targetAudience = String(brand_data.target_audience ?? "");
  return `Generate an AI visibility prompt library for this brand.

Brand: ${brand_name}
URL: ${brand_url}
Industry: ${industry}
Target audience: ${targetAudience}
Known competitors: ${competitors}
Brand research: ${JSON.stringify(brand_data, null, 2)}

Requirements:
1. Create 5 or 6 concise buyer-topic clusters.
2. Create exactly 5 prompts per topic.
3. Make about 70% unbranded category/use-case prompts and 30% branded comparison, alternatives, pricing, review, or trust prompts.
4. Mention ${brand_name} only where a buyer would realistically evaluate it. Mention competitors only in comparison or alternatives prompts.
5. Cover category_discovery, problem_solution, buyer_shortlist, comparison, alternatives, pricing_value, reviews_trust, and implementation_risk across the full set.
6. Tailor at least half the prompts to the audience, company context, geography, or use case in the research.
7. Keep prompts conversational and varied. Do not force every prompt into lowercase.
8. Topic names must be meaningful labels such as "AI visibility monitoring" or "Agency workflows", never "Topic 1".

Return strict valid JSON only, with no markdown:
{
  "prompts": [
    { "topic": "Concise topic", "type": "category_discovery", "text": "A natural buyer question" }
  ]
}`;
}

// src/prompts/analysis_prompts.ts
function buildAnalysisSystemPrompt() {
  return `You are a precise AI response analyzer. Extract structured brand intelligence data from the final cleaned AI answer shown to the customer.

You will be given:
- The complete cleaned answer displayed in the product UI (ChatGPT, Perplexity, Gemini, Copilot, Google AI, etc.)
- The name of a tracked brand
- Page citations, when available

You must semantically classify:
1. Whether the tracked brand was mentioned
2. The position/order of the tracked brand if mentioned (1 = mentioned first)
3. A sentiment score (0-100) for the tracked brand if mentioned
4. The tracked brand and genuine competing brands/providers with official domain, position, sentiment, entity type, and a short evidence excerpt
5. Every URL and domain referenced in Page Citations or explicitly visible in the response, classified by source type

Do not summarize, rewrite, clean up, or format the displayed answer. Only return structured JSON for analytics.

Source type classification:
- YOU: The official domain of the tracked brand.
- COMPETITOR: The official domain of any other brand/company mentioned as a genuine competitor or alternative.
- EDITORIAL: News outlets, industry blogs, review articles, or content sites. Signal: domain contains words like "news", "journal", "media", "blog", "times", "review"; OR URL path contains /blog/, /news/, /article/, /best-, /vs-, /compare/, /alternatives/, /review/.
- CORPORATE: Any company or business website that is not the tracked brand and not a competitor mentioned in the response. Default for product/SaaS homepages, local business websites, clinics, and hospitals.
- UGC: User-generated content platforms (for example reddit.com, quora.com, trustpilot.com, producthunt.com).
- SOCIAL: Social media platforms (for example linkedin.com, twitter.com, x.com, youtube.com, instagram.com).
- REFERENCE: Encyclopedias, knowledge bases, or software comparison platforms (for example wikipedia.org, investopedia.com, g2.com, capterra.com).
- INSTITUTIONAL: Government or academic domains (for example .gov, .edu, .org).
- OTHER: Anything that does not clearly fit above.

Page Citations are the source of truth for cited sources. Do not replace them with guessed official domains.
For is_cited: true only if the URL/domain appears in Page Citations or is explicitly written in the raw response.
Do not invent official domains for mentioned brands inside sources[].
If a brand is mentioned without a visible URL/domain citation, include it only in brand_mentions[], not in sources[].
Put official company/product domains on brand_mentions[].domain for logos, not in sources[].

Brand identity rules:
- Use the full meaning and context of the answer, not literal string equality.
- Recognize legitimate spelling, spacing, capitalization, legal-suffix, singular/plural, and commonly used name variants when they clearly refer to the tracked organization.
- Use the tracked domain, location, service category, and surrounding answer context to disambiguate similar names.
- Set entity_type to TRACKED_BRAND only when the entity is the tracked organization.
- Set entity_type to COMPETITOR only for a genuine alternative/provider competing with the tracked brand (this explicitly includes local businesses, clinics, practices, or hospitals).
- Directories, marketplaces, review sites, publishers, search engines, social networks, insurers, and citation platforms are not competitors. Classify them as DIRECTORY, SOURCE_PLATFORM, or OTHER_ORGANIZATION and do not include them in brand_mentions[].
- brand_mentions[] must contain only TRACKED_BRAND and COMPETITOR entities.
- For TRACKED_BRAND, use the supplied tracked domain. For competitors, provide an official domain only when confident; otherwise return null. Never use a directory or citation domain as a competitor's official domain.

Special rule for forum/community platforms: If the response mentions a specific subreddit (for example "r/SaaS") or Quora topic/space, add reddit.com or quora.com to sources[] as source_type "UGC" with is_cited: true, even if no full URL was given.

Be precise. If the tracked brand is not mentioned, brand_mentioned must be false, matched_brand_name must be null, brand_position must be null, and sentiment_score must be null.`;
}
function buildAnalysisUserPrompt(raw_response, brand_name, brand_url, citations) {
  const citationBlock = citations && citations.length > 0 ? `
BrightData Sources (URLs extracted from the AI result page):
${citations.filter((c) => c.url).map((c, i) => {
    const cited = c.is_cited ?? (c.source_kind === "citation" || c.source_kind === "attached_link");
    const label = cited ? "cited" : "search-only";
    const title = c.title || c.text;
    return `${i + 1}. [${label}] ${c.url}${c.domain ? ` (${c.domain})` : ""}${title ? ` - ${title}` : ""}`;
  }).join("\n")}
` : "";
  return `Analyze this complete cleaned UI answer for brand visibility data.

Tracked Brand: ${brand_name}
Tracked Brand Domain: ${brand_url}

Final Displayed AI Answer:
---
${raw_response}
---
${citationBlock}
Instructions:
- Check if "${brand_name}" is mentioned anywhere in the response.
- For each brand mention, include its likely official domain in brand_mentions[].domain when confidently known; otherwise null.
- Find every other brand, company, or product name mentioned in the response.
- Extract all URLs and domains referenced or cited. If BrightData Sources are provided above, include all of them in sources[] exactly as provided and preserve cited vs search-only status.
- Do not add competitor official domains to sources[] unless they appear in Page Citations or are explicitly written in the raw response.
- Do not infer or hallucinate source URLs from brand names. Brand official domains belong in brand_mentions[].domain, not sources[].
- If the response mentions a subreddit or Quora topic, add reddit.com or quora.com to sources[] with source_type "UGC" and is_cited: true.
- Calculate sentiment score strictly on this scale:
  - 0-20 = Highly negative (critical, dismissive, warns against)
  - 21-40 = Negative (skeptical, unfavorable)
  - 41-59 = Neutral / informational (mentioned without clear positive or negative framing)
  - 60-79 = Positive (recommended, favorable comparison, praised)
  - 80-100 = Highly positive (strongly endorsed, top pick, best-in-class)
- Return strict valid JSON only. No markdown, no code fences, no commentary.

{
  "brand_mentioned": true or false,
  "matched_brand_name": "the name variant present in the answer or null",
  "match_confidence": number from 0 to 1,
  "brand_position": number or null,
  "sentiment_score": number (0-100) or null,
  "brand_mentions": [
    {
      "brand_name": "name as written",
      "canonical_brand_name": "canonical organization name",
      "domain": "official domain or null",
      "entity_type": "TRACKED_BRAND|COMPETITOR",
      "position": number or null,
      "sentiment_score": number or null,
      "evidence": "short exact excerpt from the answer"
    }
  ],
  "sources": [
    { "url": "string", "domain": "string", "source_type": "EDITORIAL|CORPORATE|UGC|SOCIAL|COMPETITOR|YOU|REFERENCE|INSTITUTIONAL|OTHER", "is_cited": true or false }
  ]
}`;
}

// src/prompts/research_prompts.ts
function buildBrandResearchSystemPrompt() {
  return `You are a precise brand research analyst for an AI visibility platform.

You receive crawled public website data from a brand's own website. Use only the provided crawl data. If a field is not available, return null for nullable fields or a careful best-effort phrase for required fields.

Return strict valid JSON only. No markdown, no code fences, no commentary.`;
}
function buildBrandResearchUserPrompt(brand_name, brand_url, crawl_data) {
  return `Create structured brand research from this public website crawl.

Brand Name: ${brand_name}
Brand URL: ${brand_url}

Crawl Data:
${JSON.stringify(crawl_data, null, 2)}

Return this exact JSON shape:
{
  "tagline": "string or null",
  "description": "2-4 sentence summary of what the brand does",
  "industry": "primary industry",
  "founded": "string or null",
  "headquarters": "string or null",
  "employee_count": "string or null",
  "business_model": "how the brand makes money",
  "target_audience": "who the brand sells to",
  "key_products_services": "main products or services",
  "pricing_model": "string or null",
  "competitors": "3-5 likely competitors if inferable, comma-separated",
  "recent_news_or_updates": "string or null",
  "social_presence": "social links or presence if found, string or null",
  "tone_and_brand_voice": "brand tone",
  "unique_value_proposition": "what makes the brand different"
}`;
}

// src/features/llm/bedrock_gateway_service.ts
var import_axios2 = __toESM(require("axios"), 1);
var import_https2 = __toESM(require("https"), 1);
var DEFAULT_BASE_URL = "https://bedrock-mantle.us-east-1.api.aws/v1";
var DEFAULT_MODEL = "mistral.ministral-3-3b-instruct";
function hasBedrockGateway() {
  return Boolean(getBedrockGatewayApiKey());
}
async function generateWithBedrockGateway(systemPrompt, userPrompt, options) {
  const apiKey = getBedrockGatewayApiKey();
  if (!apiKey) {
    throw new Error(
      "Bedrock gateway credential is missing. Configure AWS_BEARER_TOKEN_BEDROCK, AWS_BEDROCK_GATEWAY_API_KEY, AWS_BEDROCK_API_KEY, or BEDROCK_API_KEY."
    );
  }
  const baseUrl = process.env.AWS_BEDROCK_OPENAI_BASE_URL ?? DEFAULT_BASE_URL;
  const model2 = options?.model ?? process.env.AWS_BEDROCK_LLM_MODEL ?? DEFAULT_MODEL;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const attempts = Number(process.env.LLM_RETRY_ATTEMPTS ?? 3);
  const baseDelay = Number(process.env.LLM_RETRY_BASE_DELAY_MS ?? 1500);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const payload = {
        model: model2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 8192
      };
      if (options?.responseFormat === "json_object") {
        payload.response_format = { type: "json_object" };
      }
      const response = await import_axios2.default.post(
        url,
        payload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Project": process.env.AWS_BEDROCK_OPENAI_PROJECT ?? "default"
          },
          timeout: Number(process.env.LLM_TIMEOUT_MS ?? 6e4),
          httpsAgent: shouldAllowInsecureLocalTls() ? new import_https2.default.Agent({ rejectUnauthorized: false }) : void 0
        }
      );
      const text = response.data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("Bedrock gateway returned an empty response.");
      }
      return text;
    } catch (error) {
      lastError = normalizeBedrockError(error, url, model2);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * attempt));
      }
    }
  }
  throw lastError;
}
function getBedrockGatewayApiKey() {
  return (process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEDROCK_GATEWAY_API_KEY || process.env.AWS_BEDROCK_API_KEY || process.env.BEDROCK_API_KEY || "").trim();
}
function shouldAllowInsecureLocalTls() {
  return process.env.ALLOW_INSECURE_LOCAL_TLS === "true" || process.env.NODE_ENV !== "production";
}
function normalizeBedrockError(error, url, model2) {
  if (!import_axios2.default.isAxiosError(error)) return error;
  const axiosError = error;
  const responseData = axiosError.response?.data;
  const body = typeof responseData === "string" ? responseData : responseData ? JSON.stringify(responseData) : "";
  return new Error(
    [
      `Bedrock gateway request failed with status ${axiosError.response?.status ?? "unknown"}.`,
      `url=${url}`,
      `model=${model2}`,
      body ? `body=${body.slice(0, 500)}` : null
    ].filter(Boolean).join(" ")
  );
}

// src/features/brands/brand_entity_policy.ts
var EXCLUDED_AI_SURFACES = /* @__PURE__ */ new Set([
  "chatgpt",
  "openai",
  "gemini",
  "googleai",
  "googleaimode",
  "googleaioverview",
  "googleaioverviews",
  "googleaioverviewsmode",
  "googlesearchconsole",
  "perplexity",
  "perplexityai",
  "copilot",
  "microsoftcopilot",
  "bingcopilot",
  "claude",
  "claudeai",
  "deepseek",
  "grok",
  "metaai"
]);
var CANONICAL_BRANDS = /* @__PURE__ */ new Map([
  ["ahrefsbrandradar", "Ahrefs"],
  ["brandradar", "Ahrefs"],
  ["semrushaiseo", "Semrush"],
  ["semrushaitoolkit", "Semrush"],
  ["semrushaivisibility", "Semrush"],
  ["peecai", "Peec AI"],
  ["otterlyai", "Otterly AI"],
  ["scrunchai", "Scrunch AI"]
]);
var NON_COMPETITOR_ENTITY_KEYS = /* @__PURE__ */ new Set([
  "justdial",
  "practo",
  "sulekha",
  "indiamart",
  "yelp",
  "tripadvisor",
  "trustpilot",
  "glassdoor",
  "g2",
  "capterra",
  "clutch",
  "goodfirms",
  "wikipedia",
  "reddit",
  "linkedin",
  "youtube",
  "amazon",
  "flipkart",
  "timesofindia",
  "thetimesofindia"
]);
var NON_COMPETITOR_DOMAINS = /* @__PURE__ */ new Set([
  "justdial.com",
  "practo.com",
  "sulekha.com",
  "indiamart.com",
  "yelp.com",
  "tripadvisor.com",
  "trustpilot.com",
  "glassdoor.com",
  "g2.com",
  "capterra.com",
  "clutch.co",
  "goodfirms.co",
  "wikipedia.org",
  "reddit.com",
  "linkedin.com",
  "youtube.com",
  "amazon.com",
  "amazon.in",
  "flipkart.com",
  "timesofindia.indiatimes.com"
]);
function normalizeBrandEntityKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function sanitizeDiscoveredBrandName(value) {
  if (!value) return null;
  const cleaned = value.replace(/^[\s*_`#|:;-]+|[\s*_`#|:;-]+$/g, "").replace(/\s+(?:in|from)\s+brand\s+gaps?.*$/i, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 80 || /^https?:\/\//i.test(cleaned)) return null;
  if (!/[a-z]/i.test(cleaned) || /^(?:source evidence|brand mentions?|not mentioned|n\/a)$/i.test(cleaned)) return null;
  const key = normalizeBrandEntityKey(cleaned);
  if (!key || EXCLUDED_AI_SURFACES.has(key)) return null;
  return CANONICAL_BRANDS.get(key) ?? cleaned;
}
function normalizeEntityDomain(value) {
  if (!value) return null;
  try {
    const hostname = new URL(value.includes("://") ? value : `https://${value}`).hostname;
    return hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^www\./, "").split("/")[0] || null;
  }
}
function isEligibleCompetitorEntity(input) {
  const name = sanitizeDiscoveredBrandName(input.name);
  if (!name) return false;
  if (input.ownBrandName && sameBrandEntity(name, input.ownBrandName)) return false;
  const key = normalizeBrandEntityKey(name);
  const domain = normalizeEntityDomain(input.domain);
  const ownDomain = normalizeEntityDomain(input.ownBrandUrl);
  if (NON_COMPETITOR_ENTITY_KEYS.has(key)) return false;
  if (domain && NON_COMPETITOR_DOMAINS.has(domain)) return false;
  if (domain && ownDomain && domain === ownDomain) return false;
  return true;
}
function sameBrandEntity(left, right) {
  const leftName = sanitizeDiscoveredBrandName(left);
  const rightName = sanitizeDiscoveredBrandName(right);
  if (!leftName || !rightName) return false;
  if (normalizeBrandEntityKey(leftName) === normalizeBrandEntityKey(rightName)) return true;
  const comparable = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean).filter((token) => ![
    "hospital",
    "hospitals",
    "health",
    "healthcare",
    "clinic",
    "clinics",
    "medical",
    "centre",
    "center",
    "group",
    "limited",
    "ltd",
    "private",
    "pvt",
    "speciality",
    "specialty",
    "superspeciality",
    "superspecialty",
    "multispeciality",
    "multispecialty",
    "multi",
    "super"
  ].includes(token)).join("");
  const leftComparable = comparable(leftName);
  const rightComparable = comparable(rightName);
  if (!leftComparable || !rightComparable) return false;
  if (leftComparable === rightComparable) return true;
  const shorter = leftComparable.length <= rightComparable.length ? leftComparable : rightComparable;
  const longer = shorter === leftComparable ? rightComparable : leftComparable;
  return shorter.length >= 6 && longer.startsWith(shorter);
}

// src/features/brands/strict_brand_matcher.ts
var SAFE_TOKEN_EQUIVALENTS = {
  hospitals: "hospital"
};
function normalizeStrictBrandName(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean).map((token) => SAFE_TOKEN_EQUIVALENTS[token] ?? token).join("");
}

// src/features/llm/analysis/analysis_schema.ts
var import_zod2 = require("zod");
var nullableDomain = import_zod2.z.string().trim().min(1).nullable().catch(null);
var nullablePosition = import_zod2.z.number().int().positive().nullable().catch(null);
var nullableSentiment = import_zod2.z.number().min(0).max(100).nullable().catch(null);
var brandMentionSchema = import_zod2.z.object({
  brand_name: import_zod2.z.string().trim().min(1),
  canonical_brand_name: import_zod2.z.string().trim().min(1).nullable().optional(),
  domain: nullableDomain,
  entity_type: import_zod2.z.enum([
    "TRACKED_BRAND",
    "COMPETITOR",
    "DIRECTORY",
    "SOURCE_PLATFORM",
    "OTHER_ORGANIZATION"
  ]),
  position: nullablePosition,
  sentiment_score: nullableSentiment,
  evidence: import_zod2.z.string().trim().max(500).nullable().optional()
});
var sourceSchema = import_zod2.z.object({
  url: import_zod2.z.string().trim().catch(""),
  domain: import_zod2.z.string().trim().catch(""),
  source_type: import_zod2.z.enum([
    "EDITORIAL",
    "CORPORATE",
    "UGC",
    "SOCIAL",
    "COMPETITOR",
    "YOU",
    "REFERENCE",
    "INSTITUTIONAL",
    "OTHER"
  ]).catch("OTHER"),
  is_cited: import_zod2.z.boolean().catch(false)
});
var kimiAnalysisSchema = import_zod2.z.object({
  brand_mentioned: import_zod2.z.boolean(),
  matched_brand_name: import_zod2.z.string().trim().min(1).nullable().optional(),
  match_confidence: import_zod2.z.number().min(0).max(1).nullable().optional(),
  brand_position: nullablePosition,
  sentiment_score: nullableSentiment,
  brand_mentions: import_zod2.z.array(brandMentionSchema).default([]),
  sources: import_zod2.z.array(sourceSchema).default([])
});
function parseKimiAnalysisJson(raw) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = kimiAnalysisSchema.parse(JSON.parse(cleaned));
  return parsed;
}

// src/features/llm/analysis/kimi_analysis_service.ts
async function analyzeUiAnswerWithKimi(input) {
  const uiAnswer = input.uiAnswer.trim();
  if (!uiAnswer) throw new Error("Kimi analysis requires a non-empty UI answer.");
  const raw = await generateWithBedrockGateway(
    buildAnalysisSystemPrompt(),
    buildAnalysisUserPrompt(
      uiAnswer,
      input.brandName,
      input.brandUrl,
      input.citations ?? []
    ),
    {
      model: process.env.AWS_BEDROCK_ANALYSIS_MODEL ?? process.env.AWS_BEDROCK_LLM_MODEL ?? "moonshotai.kimi-k2.5",
      temperature: 0,
      maxTokens: Number(process.env.KIMI_ANALYSIS_MAX_OUTPUT_TOKENS ?? 1500),
      responseFormat: "json_object"
    }
  );
  return {
    ...parseKimiAnalysisJson(raw),
    ai_model: input.sourceModel
  };
}

// src/features/llm/gemini_service.ts
var genai = null;
var model = null;
function getModel() {
  if (model) return model;
  genai ??= new import_generative_ai.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genai.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
  return model;
}
var GROQ_ANALYSIS_MODEL = "qwen/qwen3.8-27b";
var bedrockFallbackWarned = false;
function warnBedrockFallbackOnce() {
  if (bedrockFallbackWarned) return;
  bedrockFallbackWarned = true;
  console.warn(
    "Bedrock gateway not configured; analysing with Gemini instead of Kimi. Set KIMI_ANALYSIS_REQUIRED=true to treat this as a fatal error instead."
  );
}
async function generateText(systemPrompt, userPrompt) {
  if (hasBedrockGateway()) {
    return generateWithBedrockGateway(systemPrompt, userPrompt);
  }
  return generateTextWithRest(systemPrompt, userPrompt);
}
async function generateBrandPrompts(brand_name, brand_url, brand_data) {
  const systemPrompt = buildBrandPromptGenerationSystemPrompt();
  const userPrompt = buildBrandPromptGenerationUserPrompt(brand_name, brand_url, brand_data);
  try {
    const result = await getModel().generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    return parseJson(result.response.text());
  } catch (error) {
    console.error("[generateBrandPrompts] Gemini failed \u2014 no fallback available:", error);
    throw new Error(
      error instanceof Error ? `Prompt generation failed: ${error.message}` : "Prompt generation failed: Gemini returned no usable response."
    );
  }
}
async function summarizeBrandResearch(brand_name, brand_url, crawl_data) {
  const systemPrompt = buildBrandResearchSystemPrompt();
  const userPrompt = buildBrandResearchUserPrompt(brand_name, brand_url, crawl_data);
  if (hasBedrockGateway()) {
    return parseJson(
      await generateWithBedrockGateway(systemPrompt, userPrompt, {
        temperature: 0.2,
        maxTokens: 8192,
        responseFormat: "json_object"
      })
    );
  }
  try {
    const result = await getModel().generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    return parseJson(result.response.text());
  } catch (error) {
    console.warn("Gemini brand research summary failed. Falling back to Groq.", error);
    return summarizeBrandResearchWithGroq(systemPrompt, userPrompt);
  }
}
async function analyzeResponse(raw_response, ai_model, brand_name, brand_url, citations) {
  const systemPrompt = buildAnalysisSystemPrompt();
  const userPrompt = buildAnalysisUserPrompt(raw_response, brand_name, brand_url, citations);
  if (hasBedrockGateway()) {
    const parsed = await analyzeUiAnswerWithKimi({
      uiAnswer: raw_response,
      sourceModel: ai_model,
      brandName: brand_name,
      brandUrl: brand_url,
      citations
    });
    return { ...normalizeAnalysisResult(parsed, raw_response, brand_name, brand_url, citations), ai_model };
  }
  if (process.env.KIMI_ANALYSIS_REQUIRED?.trim().toLowerCase() === "true") {
    throw new Error(
      "Kimi analysis is required but the Bedrock gateway is not configured. Configure a supported Bedrock gateway credential on this runtime."
    );
  }
  warnBedrockFallbackOnce();
  try {
    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }, { text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 8192 }
    });
    const parsed = parseJson(result.response.text());
    return { ...normalizeAnalysisResult(parsed, raw_response, brand_name, brand_url, citations), ai_model };
  } catch (error) {
    console.warn("Gemini analysis failed. Falling back to Groq.", error);
    const parsed = await analyzeResponseWithGroq(systemPrompt, userPrompt);
    return { ...normalizeAnalysisResult(parsed, raw_response, brand_name, brand_url, citations), ai_model };
  }
}
function repairTruncatedJson(raw) {
  let attempt = raw.trim();
  for (let cutAt = attempt.length - 1; cutAt > 10; cutAt--) {
    const ch = attempt[cutAt];
    if (ch === "," || ch === "{") {
      const candidate = attempt.slice(0, cutAt) + "}";
      try {
        return JSON.parse(candidate);
      } catch {
      }
    }
  }
  throw new SyntaxError(`Could not repair truncated JSON (length=${raw.length})`);
}
function parseJson(raw) {
  if (!raw) throw new Error("LLM returned an empty response \u2014 content may have been blocked or the model hit a token limit.");
  const cleaned = raw.trim().replace(/^```json\n?/i, "").replace(/^```\n?/i, "").replace(/\n?```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (firstError3) {
    try {
      console.warn("[parseJson] JSON truncated \u2014 attempting repair", {
        length: cleaned.length,
        tail: cleaned.slice(-120)
      });
      return repairTruncatedJson(cleaned);
    } catch {
      throw firstError3;
    }
  }
}
function normalizeAnalysisResult(analysis, rawResponse, brandName, brandUrl, citations = []) {
  const normalizedBrandMentions = dedupeBrandMentions([
    ...analysis.brand_mentions,
    ...extractKnownBrandMentions(rawResponse)
  ], citations, brandName, brandUrl);
  const semanticTrackedMention = normalizedBrandMentions.find(
    (mention) => mention.entity_type === "TRACKED_BRAND"
  );
  const brandMentioned = Boolean(analysis.brand_mentioned || semanticTrackedMention);
  if (brandMentioned && !semanticTrackedMention) {
    normalizedBrandMentions.push({
      brand_name: brandName,
      canonical_brand_name: brandName,
      domain: safeDomain(brandUrl),
      entity_type: "TRACKED_BRAND",
      position: analysis.brand_position ?? null,
      sentiment_score: analysis.sentiment_score ?? null,
      evidence: analysis.matched_brand_name ?? null
    });
  }
  const trackedMention = normalizedBrandMentions.find(
    (mention) => mention.entity_type === "TRACKED_BRAND"
  );
  const citationSources = citations.filter((citation) => citation.url).map((citation) => ({
    url: citation.url,
    domain: citation.domain || safeDomain(citation.url) || citation.url,
    source_type: classifySourceDomain(
      citation.domain || safeDomain(citation.url) || citation.url,
      brandUrl,
      normalizedBrandMentions.map((mention) => mention.brand_name)
    ),
    is_cited: citation.is_cited ?? (citation.source_kind === "citation" || citation.source_kind === "attached_link")
  }));
  const explicitDomains = extractExplicitDomains(rawResponse);
  const forumSources = [];
  if (/\br\/[A-Za-z0-9_]+\b/.test(rawResponse)) {
    forumSources.push({
      url: "https://reddit.com",
      domain: "reddit.com",
      source_type: "UGC",
      is_cited: true
    });
  }
  if (/\bquora\.com\b|\bQuora\b/i.test(rawResponse)) {
    forumSources.push({
      url: "https://quora.com",
      domain: "quora.com",
      source_type: "UGC",
      is_cited: true
    });
  }
  const normalizedSources = dedupeSources([
    ...citationSources,
    ...forumSources,
    ...analysis.sources.filter((source) => {
      if (!source.url && !source.domain) return false;
      if (isAiEngineDomain(source.domain || source.url)) return false;
      if (source.is_cited) return true;
      return explicitDomains.has(normalizeDomain(source.domain)) || Boolean(source.url && rawResponse.includes(source.url));
    })
  ]);
  return {
    ...analysis,
    brand_mentioned: brandMentioned,
    brand_position: brandMentioned ? analysis.brand_position ?? trackedMention?.position ?? null : null,
    sentiment_score: brandMentioned ? analysis.sentiment_score ?? trackedMention?.sentiment_score ?? null : null,
    brand_mentions: normalizedBrandMentions,
    sources: normalizedSources
  };
}
function dedupeBrandMentions(mentions, citations = [], trackedBrandName = "", trackedBrandUrl = "") {
  const seen = /* @__PURE__ */ new Set();
  const normalized = [];
  for (const mention of mentions) {
    const sanitizedName = sanitizeDiscoveredBrandName(mention.brand_name);
    if (!sanitizedName) continue;
    const isTrackedBrand = mention.entity_type === "TRACKED_BRAND" || normalizeBrandKey(sanitizedName) === normalizeBrandKey(trackedBrandName);
    const brandName = isTrackedBrand ? trackedBrandName : canonicalBrandName(mention.canonical_brand_name || sanitizedName);
    if (!isTrackedBrand && mention.entity_type && mention.entity_type !== "COMPETITOR") continue;
    if (!isTrackedBrand && !isEligibleCompetitorEntity({
      name: brandName,
      ownBrandName: trackedBrandName,
      ownBrandUrl: trackedBrandUrl
    })) continue;
    const key = normalizeBrandKey(brandName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      ...mention,
      brand_name: brandName,
      canonical_brand_name: brandName,
      entity_type: isTrackedBrand ? "TRACKED_BRAND" : "COMPETITOR",
      domain: isTrackedBrand ? safeDomain(trackedBrandUrl) : resolveOfficialCompetitorDomain(
        brandName,
        mention.domain,
        citations,
        trackedBrandName,
        trackedBrandUrl
      )
    });
  }
  return normalized;
}
function resolveOfficialCompetitorDomain(brandName, modelDomain, citations, trackedBrandName, trackedBrandUrl) {
  const candidates = [
    modelDomain,
    domainFromCitations(brandName, citations),
    knownBrandDomain(brandName)
  ];
  for (const candidate of candidates) {
    const domain = normalizeEntityDomain(candidate);
    if (!domain || !domain.includes(".") || !/^[a-z0-9.-]+$/.test(domain)) continue;
    if (!isEligibleCompetitorEntity({
      name: brandName,
      domain,
      ownBrandName: trackedBrandName,
      ownBrandUrl: trackedBrandUrl
    })) continue;
    return domain;
  }
  return null;
}
function extractKnownBrandMentions(rawResponse) {
  const detected = KNOWN_BRANDS.map((brand) => {
    const indexes = [brand.name, ...brand.aliases ?? []].map((alias) => firstVisibleMentionIndex(rawResponse, alias)).filter((index) => index !== null);
    const firstIndex = indexes.length ? Math.min(...indexes) : null;
    return firstIndex === null ? null : { brand, firstIndex };
  }).filter((item) => Boolean(item)).sort((a, b) => a.firstIndex - b.firstIndex);
  return detected.map((item, index) => ({
    brand_name: item.brand.name,
    domain: item.brand.domain,
    position: index + 1,
    sentiment_score: 50
  }));
}
function firstVisibleMentionIndex(text, brandName) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(brandName)}([^a-z0-9]|$)`, "i");
  const match = pattern.exec(text);
  if (!match) return null;
  return match.index + (match[1]?.length ?? 0);
}
function dedupeSources(sources) {
  const byKey = /* @__PURE__ */ new Map();
  for (const source of sources) {
    const url = source.url?.trim() || "";
    const domain = normalizeDomain(source.domain || safeDomain(url) || url);
    if (!domain) continue;
    const key = url || domain;
    const existing = byKey.get(key);
    if (!existing || !existing.is_cited && source.is_cited) {
      byKey.set(key, {
        url,
        domain,
        source_type: source.source_type || "OTHER",
        is_cited: Boolean(source.is_cited)
      });
    }
  }
  return Array.from(byKey.values());
}
function extractExplicitDomains(text) {
  const domains = /* @__PURE__ */ new Set();
  const matches = text.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/[^\s]*)?/gi);
  for (const match of matches) {
    domains.add(normalizeDomain(match[1]));
  }
  return domains;
}
function normalizeDomain(domain) {
  return (domain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
}
function safeDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return normalizeDomain(url) || null;
  }
}
function domainFromCitations(brandName, citations) {
  const brandKey = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const citation of citations) {
    const domain = normalizeDomain(citation.domain || safeDomain(citation.url));
    const titleKey = (citation.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const rootKey = domain.split(".")[0]?.replace(/[^a-z0-9]/g, "") || "";
    if (brandKey && (brandKey === titleKey || brandKey === rootKey || titleKey.includes(brandKey) || brandKey.includes(rootKey))) {
      return domain;
    }
  }
  return null;
}
function classifySourceDomain(domainOrUrl, brandUrl, mentionedBrands) {
  const domain = normalizeDomain(domainOrUrl);
  const ownDomain = normalizeDomain(safeDomain(brandUrl) || brandUrl);
  if (domain && ownDomain && domain === ownDomain) return "YOU";
  if (/\b(reddit|quora|trustpilot|producthunt|g2crowd|glassdoor|yelp|tripadvisor)\b/.test(domain)) return "UGC";
  if (/\b(linkedin|twitter|x\.com|youtube|instagram|facebook|tiktok|pinterest|snapchat|threads)\b/.test(domain)) return "SOCIAL";
  if (/\b(wikipedia|wikidata|investopedia|britannica|scholarpedia|imdb)\b/.test(domain)) return "REFERENCE";
  if (domain.endsWith(".gov") || domain.endsWith(".edu") || domain.includes(".gov.") || domain.includes(".edu.")) return "INSTITUTIONAL";
  if (/\b(g2\.com|capterra|softwareadvice|getapp|crozdesk|sourceforge|alternativeto)\b/.test(domain)) return "REFERENCE";
  const brandRoots = mentionedBrands.map((brand) => knownBrandDomain(brand)).filter((value) => Boolean(value)).map((value) => normalizeDomain(value));
  if (brandRoots.includes(domain)) return "COMPETITOR";
  if (isEditorialBySignals(domainOrUrl, domain)) return "EDITORIAL";
  return "CORPORATE";
}
function isEditorialBySignals(domainOrUrl, domain) {
  const domaEURoot = domain.split(".").slice(0, -1).join(".");
  const domainWords = domaEURoot.split(/[-_.]/);
  const editorialDomainWords = [
    // News / media words
    "news",
    "journal",
    "gazette",
    "herald",
    "tribune",
    "times",
    "post",
    "daily",
    "weekly",
    "monthly",
    "press",
    "media",
    "wire",
    "report",
    "reporter",
    "magazine",
    "chronicle",
    "dispatch",
    "bulletin",
    "observer",
    "courier",
    "review",
    "reviews",
    "digest",
    // Content marketing / editorial words
    "blog",
    "insights",
    "insight",
    "guide",
    "guides",
    "roundup",
    "editorial",
    "opinion",
    "analysis",
    "research",
    "resources",
    "academy",
    "learn",
    "hub",
    "community",
    "forum",
    "knowledge"
  ];
  const hasEditorialDomainWord = domainWords.some(
    (word) => word.length >= 3 && editorialDomainWords.includes(word.toLowerCase())
  );
  if (hasEditorialDomainWord) return true;
  const parts = domain.split(".");
  const subdomain = parts.length >= 3 ? parts[0].toLowerCase() : "";
  if (["blog", "news", "insights", "learn", "resources", "community", "forum"].includes(subdomain)) return true;
  let path2 = "";
  try {
    const urlToParse = domainOrUrl.startsWith("http") ? domainOrUrl : `https://${domainOrUrl}`;
    path2 = new URL(urlToParse).pathname.toLowerCase();
  } catch {
    return false;
  }
  const editorialPathSignals = [
    "/blog/",
    "/news/",
    "/insights/",
    "/articles/",
    "/article/",
    "/guides/",
    "/guide/",
    "/resources/",
    "/learn/",
    "/learning/",
    "/editorial/",
    "/opinion/",
    "/press/",
    // Comparison / listicle patterns (strong editorial signals)
    "/best-",
    "/top-",
    "-vs-",
    "/vs/",
    "/compare/",
    "/alternatives/",
    "/alternative-",
    "/roundup",
    "/reviews/",
    "/review/"
  ];
  return editorialPathSignals.some((signal) => path2.includes(signal));
}
function isAiEngineDomain(domainOrUrl) {
  const domain = normalizeDomain(domainOrUrl);
  return [
    "chatgpt.com",
    "openai.com",
    "gemini.google.com",
    "perplexity.ai",
    "copilot.microsoft.com",
    "bing.com"
  ].includes(domain);
}
var KNOWN_BRANDS = [
  { name: "Peec AI", domain: "peec.ai", aliases: ["PeecAI", "Peec"] },
  { name: "Profound", domain: "profound.ai" },
  { name: "AirOps", domain: "airops.com" },
  { name: "Frase", domain: "frase.io" },
  { name: "Semrush", domain: "semrush.com", aliases: ["Semrush AI Toolkit", "Semrush AI Visibility", "Semrush One"] },
  { name: "Ahrefs", domain: "ahrefs.com" },
  { name: "AthenaHQ", domain: "athenahq.ai", aliases: ["Athena"] },
  { name: "Otterly AI", domain: "otterly.ai", aliases: ["OtterlyAI"] },
  { name: "Scrunch AI", domain: "scrunch.com", aliases: ["ScrunchAI", "Scrunch"] },
  { name: "Writesonic", domain: "writesonic.com" },
  { name: "SE Ranking", domain: "seranking.com", aliases: ["SERanking", "SE Visible"] },
  { name: "Brand24", domain: "brand24.com" },
  { name: "PromptWatch", domain: "promptwatch.com" },
  { name: "DeepMention", domain: "deepmention.xyz", aliases: ["Deep Mention"] },
  { name: "Evertune", domain: "evertune.ai" },
  { name: "LLMClicks", domain: "llmclicks.ai", aliases: ["LLM Clicks"] },
  { name: "Pranas", domain: "pranas.co" },
  { name: "OpenForge", domain: "openforge.ai", aliases: ["Open Forge"] },
  { name: "Topify", domain: "topify.ai" }
];
function knownBrandInfo(brandName) {
  const key = normalizeBrandKey(brandName);
  return KNOWN_BRANDS.find(
    (brand) => normalizeBrandKey(brand.name) === key || (brand.aliases ?? []).some((alias) => normalizeBrandKey(alias) === key)
  ) ?? null;
}
function knownBrandDomain(brandName) {
  return knownBrandInfo(brandName)?.domain ?? null;
}
function canonicalBrandName(brandName) {
  const trimmed = brandName.trim();
  return knownBrandInfo(trimmed)?.name ?? trimmed;
}
function normalizeBrandKey(brandName) {
  return normalizeStrictBrandName(brandName);
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function generateTextWithRest(systemPrompt, userPrompt) {
  const response = await postGeminiRest(
    "gemini-3.1-flash-lite",
    "generateContent",
    {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: userPrompt }
          ]
        }
      ]
    }
  );
  const text = response.data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini REST generation returned an empty response.");
  }
  return text;
}
async function postGeminiRest(modelName, action, payload) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }
  return import_axios3.default.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:${action}`,
    payload,
    {
      params: { key: process.env.GEMINI_API_KEY },
      headers: { "Content-Type": "application/json" },
      timeout: 6e4,
      httpsAgent: shouldAllowInsecureLocalTls2() ? new import_https3.default.Agent({ rejectUnauthorized: false }) : void 0
    }
  );
}
async function analyzeResponseWithGroq(systemPrompt, userPrompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing, and Gemini analysis failed.");
  }
  const response = await postGroqChatCompletion(
    {
      model: GROQ_ANALYSIS_MODEL,
      temperature: 0,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }
  );
  const raw = response.data?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("Groq analysis returned an empty response.");
  }
  return parseJson(raw);
}
async function summarizeBrandResearchWithGroq(systemPrompt, userPrompt) {
  const response = await postGroqChatCompletion(
    {
      model: GROQ_ANALYSIS_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }
  );
  const raw = response.data?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("Groq brand research summary returned an empty response.");
  }
  return parseJson(raw);
}
async function postGroqChatCompletion(payload) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing.");
  }
  const config = {
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    timeout: 6e4
  };
  try {
    return await import_axios3.default.post(
      "https://api.groq.com/openai/v1/chat/completions",
      payload,
      config
    );
  } catch (error) {
    if (!isLocalCertificateError(error)) throw error;
    return import_axios3.default.post(
      "https://api.groq.com/openai/v1/chat/completions",
      payload,
      {
        ...config,
        httpsAgent: new import_https3.default.Agent({ rejectUnauthorized: false })
      }
    );
  }
}
function isLocalCertificateError(error) {
  return shouldAllowInsecureLocalTls2() && typeof error === "object" && error !== null && "code" in error && error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
}
function shouldAllowInsecureLocalTls2() {
  return process.env.ALLOW_INSECURE_LOCAL_TLS === "true" || process.env.NODE_ENV !== "production";
}

// src/features/onboarding/onboarding_service.ts
init_prisma();

// src/features/onboarding/brand_crawler_service.ts
var import_axios5 = __toESM(require("axios"), 1);

// src/features/onboarding/crawlers/firecrawl_client.ts
var import_axios4 = __toESM(require("axios"), 1);
var FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";
function hasFirecrawlKey() {
  return Boolean(getFirecrawlKey());
}
async function scrapeWithFirecrawl(url) {
  const apiKey = getFirecrawlKey();
  if (!apiKey) {
    throw new Error("CRAWLER_API_KEY is missing; Firecrawl fallback cannot run.");
  }
  const response = await import_axios4.default.post(
    FIRECRAWL_SCRAPE_URL,
    {
      url,
      formats: ["markdown", "html"],
      onlyMainContent: true,
      timeout: 3e4
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 45e3,
      validateStatus: (status) => status >= 200 && status < 500
    }
  );
  if (response.status >= 400 || response.data.success === false) {
    throw new Error(response.data.error || `Firecrawl scrape failed with status ${response.status}.`);
  }
  const data = response.data.data;
  const markdown = data?.markdown?.trim();
  if (!data || !markdown) {
    throw new Error("Firecrawl returned no readable markdown for this URL.");
  }
  return {
    url: data.metadata?.sourceURL || data.metadata?.url || url,
    title: data.metadata?.title || null,
    description: data.metadata?.description || null,
    markdown,
    html: data.html || null
  };
}
function getFirecrawlKey() {
  return process.env.CRAWLER_API_KEY || process.env.FIRECRAWL_API_KEY;
}

// src/lib/safe_url.ts
var import_dns = __toESM(require("dns"), 1);
var import_net = __toESM(require("net"), 1);
var BlockedUrlError = class extends Error {
};
function isBlockedIpv4(ip) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true;
  return false;
}
function isBlockedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}
function isBlockedAddress(ip) {
  const version = import_net.default.isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}
async function assertPublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("That does not look like a valid website address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http and https addresses can be crawled.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (import_net.default.isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedUrlError("That address is not publicly reachable.");
    return url;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new BlockedUrlError("That address is not publicly reachable.");
  }
  let resolved;
  try {
    resolved = await import_dns.default.promises.lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("That website address could not be resolved.");
  }
  if (resolved.length === 0 || resolved.some((entry) => isBlockedAddress(entry.address))) {
    throw new BlockedUrlError("That address is not publicly reachable.");
  }
  return url;
}

// src/features/onboarding/brand_crawler_service.ts
var MAX_PAGES = 8;
var MAX_FIRECRAWL_PAGES = 4;
var MAX_TEXT_PER_PAGE = 4500;
var MIN_USEFUL_TEXT_LENGTH = 120;
async function crawlBrandWebsite(brand_name, brand_url) {
  const rootUrl = normalizeUrl(brand_url);
  const notes = [];
  let homepage = null;
  let importantLinks = [];
  try {
    homepage = await fetchPage(rootUrl);
    const links = extractLinks(homepage.html, rootUrl);
    importantLinks = pickImportantLinks(links, rootUrl);
  } catch (error) {
    notes.push(`Static homepage crawl failed: ${getErrorMessage(error)}`);
  }
  if (!homepage) {
    return crawlWithFirecrawlFallback(brand_name, rootUrl, importantLinks, notes);
  }
  const urlsToCrawl = [rootUrl, ...importantLinks].slice(0, MAX_PAGES);
  const pages = [];
  const socialLinks = /* @__PURE__ */ new Set();
  for (const url of urlsToCrawl) {
    try {
      const page = url === rootUrl ? homepage : await fetchPage(url);
      const extracted = extractPage(page.url, page.html);
      pages.push(extracted);
      extractSocialLinks(page.html).forEach((link) => socialLinks.add(link));
    } catch (error) {
      notes.push(`Static page crawl failed for ${url}: ${getErrorMessage(error)}`);
    }
  }
  if (isThinCrawl(pages) && hasFirecrawlKey()) {
    notes.push("Static crawl returned thin content, switching to Firecrawl fallback.");
    return crawlWithFirecrawlFallback(brand_name, rootUrl, importantLinks, notes);
  }
  if (isThinCrawl(pages)) {
    throw new Error("Website crawl did not return enough useful brand content.");
  }
  return {
    brand_name,
    brand_url: rootUrl,
    source: "website_crawler",
    pages_crawled: pages.length,
    pages,
    social_links: Array.from(socialLinks),
    important_links: importantLinks.slice(0, MAX_PAGES - 1),
    crawler_notes: notes
  };
}
async function crawlWithFirecrawlFallback(brand_name, rootUrl, importantLinks, notes) {
  const urlsToCrawl = unique([rootUrl, ...importantLinks]).slice(0, MAX_FIRECRAWL_PAGES);
  const pages = [];
  const socialLinks = /* @__PURE__ */ new Set();
  if (!hasFirecrawlKey()) {
    throw new Error(`${notes.join(" ")} Firecrawl fallback is not configured.`.trim());
  }
  for (const url of urlsToCrawl) {
    try {
      const page = await scrapeWithFirecrawl(url);
      pages.push(extractFirecrawlPage(page));
      if (page.html) {
        extractSocialLinks(page.html).forEach((link) => socialLinks.add(link));
      }
    } catch (error) {
      notes.push(`Firecrawl failed for ${url}: ${getErrorMessage(error)}`);
    }
  }
  if (isThinCrawl(pages)) {
    throw new Error(notes.join(" ") || "Firecrawl fallback did not return enough useful brand content.");
  }
  return {
    brand_name,
    brand_url: rootUrl,
    source: "firecrawl_fallback",
    pages_crawled: pages.length,
    pages,
    social_links: Array.from(socialLinks),
    important_links: importantLinks.slice(0, MAX_FIRECRAWL_PAGES - 1),
    crawler_notes: notes
  };
}
function normalizeUrl(value) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
var MAX_REDIRECT_HOPS = 5;
async function fetchPage(url) {
  const requestConfig = {
    timeout: 15e3,
    // Redirects are followed by hand so every hop is re-checked against assertPublicUrl;
    // letting axios follow them would skip the check on all but the first address.
    maxRedirects: 0,
    responseType: "text",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    validateStatus: (status) => status >= 200 && status < 400
  };
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const safeUrl = await assertPublicUrl(currentUrl);
    const response = await import_axios5.default.get(safeUrl.toString(), requestConfig);
    const location = response.headers?.location;
    if (response.status >= 300 && response.status < 400 && typeof location === "string") {
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }
    return {
      url: response.request?.res?.responseUrl || safeUrl.toString(),
      html: response.data
    };
  }
  throw new BlockedUrlError("That website redirected too many times.");
}
function extractPage(url, html) {
  const cleanedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  return {
    url,
    title: firstMatch(cleanedHtml, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: extractMeta(cleanedHtml, "description") || extractMeta(cleanedHtml, "og:description"),
    headings: extractHeadings(cleanedHtml),
    body_text: normalizeText(stripTags(cleanedHtml)).slice(0, MAX_TEXT_PER_PAGE)
  };
}
function extractFirecrawlPage(page) {
  const bodyText = normalizeText(page.markdown).slice(0, MAX_TEXT_PER_PAGE);
  return {
    url: page.url,
    title: page.title,
    description: page.description,
    headings: extractMarkdownHeadings(page.markdown),
    body_text: bodyText
  };
}
function extractMarkdownHeadings(markdown) {
  const headings = markdown.split("\n").map((line) => line.trim()).filter((line) => /^#{1,3}\s+/.test(line)).map((line) => normalizeText(line.replace(/^#{1,3}\s+/, "")));
  return unique(headings).slice(0, 30);
}
function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return null;
}
function extractHeadings(html) {
  const matches = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi));
  return unique(matches.map((match) => normalizeText(stripTags(match[1]))).filter(Boolean)).slice(0, 30);
}
function extractLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((match) => toAbsoluteUrl(match[1], base)).filter((url) => Boolean(url)).filter((url) => {
    const parsed = new URL(url);
    return parsed.hostname === base.hostname && !/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip)$/i.test(parsed.pathname);
  });
  return unique(links);
}
function pickImportantLinks(links, rootUrl) {
  const wanted = [
    "about",
    "product",
    "products",
    "solution",
    "solutions",
    "platform",
    "pricing",
    "customers",
    "case-studies",
    "features",
    "services",
    "company"
  ];
  return links.filter((link) => link !== rootUrl).map((link) => ({ link, score: wanted.reduce((score, word) => score + (link.toLowerCase().includes(word) ? 1 : 0), 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.link.length - b.link.length).map((item) => item.link).slice(0, MAX_PAGES - 1);
}
function extractSocialLinks(html) {
  const socialDomains = ["linkedin.com", "twitter.com", "x.com", "youtube.com", "instagram.com", "facebook.com"];
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((match) => match[1]).filter((href) => /^https?:\/\//i.test(href)).filter((href) => socialDomains.some((domain) => href.toLowerCase().includes(domain)));
  return unique(links).slice(0, 20);
}
function toAbsoluteUrl(href, base) {
  if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return null;
  try {
    const url = new URL(href, base);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}
function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}
function firstMatch(value, pattern) {
  const match = value.match(pattern);
  return match?.[1] ? decodeHtml(normalizeText(stripTags(match[1]))) : null;
}
function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function unique(values) {
  return Array.from(new Set(values));
}
function isThinCrawl(pages) {
  return pages.length === 0 || pages.every((page) => page.body_text.length < MIN_USEFUL_TEXT_LENGTH);
}
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

// src/features/onboarding/onboarding_service.ts
init_subscription_service();
init_countries();
init_project_engines_service();
init_project_engine_policy();
async function researchbrand(input) {
  const { brand_url, brand_name } = input;
  let crawl;
  try {
    crawl = await crawlBrandWebsite(brand_name, brand_url);
  } catch (crawlerError) {
    const fallback = await researchBrand(brand_name, brand_url);
    return {
      ...fallback,
      research_source: "parallel_fallback",
      crawler_error: crawlerError instanceof Error ? crawlerError.message : "Website crawler failed"
    };
  }
  try {
    const data = await summarizeBrandResearch(brand_name, crawl.brand_url, crawl);
    return {
      brand_name,
      brand_url: crawl.brand_url,
      research_source: crawl.source,
      pages_crawled: crawl.pages_crawled,
      important_links: crawl.important_links,
      social_links: crawl.social_links,
      crawler_notes: crawl.crawler_notes,
      data
    };
  } catch (summaryError) {
    const fallback = await researchBrand(brand_name, brand_url);
    return {
      ...fallback,
      research_source: "parallel_fallback",
      crawler_source: crawl.source,
      pages_crawled: crawl.pages_crawled,
      important_links: crawl.important_links,
      social_links: crawl.social_links,
      crawler_notes: crawl.crawler_notes,
      summary_error: summaryError instanceof Error ? summaryError.message : "Brand research summary failed"
    };
  }
}
async function promptgeneration(input) {
  const { brand_name, brand_url, brand_data } = input;
  const result = await generateBrandPrompts(brand_name, brand_url, brand_data);
  return result;
}
async function createProject(input) {
  const { user_id, brand_name, brand_url, brand_location, competitors, prompts } = input;
  try {
    const user = await prisma_default.user.findUnique({
      where: { id: user_id },
      select: { id: true }
    });
    if (!user) {
      throw new Error("User not found");
    }
    const normalizedPrompts = [...new Map(prompts.map((prompt) => {
      const text = prompt.text.trim().replace(/\s+/g, " ");
      const topic = prompt.topic.trim().replace(/\s+/g, " ") || "Imported prompts";
      return [text.toLowerCase(), {
        text,
        topic,
        type: prompt.type.trim().replace(/\s+/g, "_") || "buyer_question",
        selected: Boolean(prompt.selected),
        source: prompt.source === "CUSTOMER" ? "CUSTOMER" : "GENERATED"
      }];
    })).values()].filter((prompt) => prompt.text.length >= 8 && prompt.text.length <= 500);
    const activePromptCount = normalizedPrompts.filter((prompt) => prompt.selected).length;
    if (activePromptCount === 0) {
      throw new Error("Select at least one prompt for your first visibility run");
    }
    await assertCanCreateProjectWithPrompts(user_id, activePromptCount);
    await assertCanAddCompetitors(user_id, competitors.length);
    const selectedEngines = await assertCanUseProjectEngines(user_id, input.engines);
    const country = getGeoCountryByName(brand_location);
    if (!country) {
      throw new Error("Please select a supported primary market");
    }
    const project = await prisma_default.$transaction(async (transaction) => {
      const createdProject = await transaction.project.create({
        data: {
          user_id,
          brand_name,
          brand_url,
          brand_location: country.name,
          competitors: {
            create: competitors.map((c) => ({ name: c }))
          }
        }
      });
      const topicNames = [...new Set(normalizedPrompts.map((prompt) => prompt.topic))];
      if (topicNames.length) {
        await transaction.topic.createMany({
          data: topicNames.map((name) => ({ name, project_id: createdProject.id })),
          skipDuplicates: true
        });
      }
      await transaction.prompt.createMany({
        data: normalizedPrompts.map((prompt) => ({
          project_id: createdProject.id,
          text: prompt.text,
          topic: prompt.topic,
          type: prompt.type,
          status: prompt.selected ? "ACTIVE" : "SUGGESTED",
          is_active: prompt.selected,
          source: prompt.source,
          tags: prompt.selected ? ["onboarding:selected"] : ["onboarding:unused"]
        }))
      });
      const selectedEngineSet = new Set(selectedEngines);
      await transaction.projectEnginePreference.createMany({
        data: SELECTABLE_PROJECT_ENGINES.map((engine) => ({
          project_id: createdProject.id,
          engine,
          is_active: selectedEngineSet.has(engine)
        })),
        skipDuplicates: true
      });
      return createdProject;
    });
    return project;
  } catch (error) {
    throw error;
  }
}

// src/features/onboarding/onboarding_controller.ts
var import_zod3 = require("zod");
var onboardingPromptSchema = import_zod3.z.object({
  topic: import_zod3.z.string().trim().min(2).max(80),
  type: import_zod3.z.string().trim().min(2).max(80),
  text: import_zod3.z.string().trim().min(8).max(500),
  selected: import_zod3.z.boolean(),
  source: import_zod3.z.enum(["GENERATED", "CUSTOMER"]).optional()
});
var onboardingEngineSchema = import_zod3.z.array(import_zod3.z.string().trim().min(2).max(40)).min(1).max(5);
var researchBrandController = async (req, res) => {
  try {
    const { brand_name, brand_url } = req.body;
    if (!brand_name || !brand_url) {
      res.status(400).json({ error: "brand_name and brand_url are required" });
      return;
    }
    const result = await researchbrand({ brand_name, brand_url });
    res.status(200).json(result);
  } catch (error) {
    console.error("Brand research failed", error);
    res.status(500).json({
      error: "Failed to research brand",
      detail: process.env.NODE_ENV === "production" ? void 0 : error instanceof Error ? error.message : "Unknown error"
    });
  }
};
var generatePromptsController = async (req, res) => {
  try {
    const { brand_name, brand_url, brand_data } = req.body;
    if (!brand_name || !brand_url || !brand_data) {
      res.status(400).json({ error: "brand_name, brand_url, and brand_data are required" });
      return;
    }
    const result = await promptgeneration({ brand_name, brand_url, brand_data });
    res.status(200).json(result);
  } catch (error) {
    console.error("Prompt generation failed", error);
    res.status(500).json({
      error: "Failed to generate prompts",
      detail: process.env.NODE_ENV === "production" ? void 0 : error instanceof Error ? error.message : "Unknown error"
    });
  }
};
var createProjectController = async (req, res) => {
  try {
    const { brand_name, brand_url, brand_location, competitors } = req.body;
    const parsedPrompts = import_zod3.z.array(onboardingPromptSchema).min(1).max(500).safeParse(req.body.prompts);
    const parsedEngines = onboardingEngineSchema.safeParse(req.body.engines);
    const user_id = req.user.id;
    const missing_fields = [
      !brand_name ? "brand_name" : null,
      !brand_url ? "brand_url" : null,
      !brand_location ? "brand_location" : null,
      !parsedPrompts.success ? "prompts" : null,
      !parsedEngines.success ? "engines" : null
    ].filter(Boolean);
    if (missing_fields.length > 0) {
      res.status(400).json({
        error: "Missing required fields for project creation",
        missing_fields
      });
      return;
    }
    const project = await createProject({
      user_id,
      brand_name,
      brand_url,
      brand_location,
      competitors: competitors || [],
      engines: parsedEngines.success ? parsedEngines.data : [],
      prompts: parsedPrompts.success ? parsedPrompts.data : []
    });
    res.status(201).json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    const status = message.includes("plan") || message.includes("Missing required") || message.includes("supported primary market") || message.includes("Select at least") ? 400 : 500;
    if (status === 500) {
      console.error("[onboarding_controller:createProject]", error);
      res.status(500).json({ error: "Failed to create project" });
      return;
    }
    res.status(status).json({ error: message });
  }
};

// src/features/onboarding/onboarding_routes.ts
var router2 = (0, import_express2.Router)();
router2.post("/research", researchBrandController);
router2.post("/prompts", generatePromptsController);
router2.post("/project", createProjectController);
var onboarding_routes_default = router2;

// src/features/dashboard/dashboard_route.ts
var import_express3 = require("express");

// src/features/dashboard/dashboard_service.ts
init_prisma();

// src/queues/source_enrichment_queue.ts
var import_bullmq = require("bullmq");
init_redis();
var SOURCE_ENRICHMENT_QUEUE_NAME = "ai-visibility-source-enrichment";
var sourceEnrichmentQueue = null;
function getSourceEnrichmentQueue() {
  if (sourceEnrichmentQueue) return sourceEnrichmentQueue;
  sourceEnrichmentQueue = new import_bullmq.Queue(SOURCE_ENRICHMENT_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 6e4
      },
      removeOnComplete: {
        age: 86400,
        count: 2e3
      },
      removeOnFail: {
        age: 604800,
        count: 5e3
      }
    }
  });
  sourceEnrichmentQueue.on("error", (error) => {
    console.error(`Source enrichment queue Redis error: ${error.message}`);
  });
  return sourceEnrichmentQueue;
}
async function enqueueSourceEnrichment(source_id, delay = 0) {
  try {
    return await getSourceEnrichmentQueue().add("enrich-source", { source_id }, {
      jobId: source_id,
      delay
    });
  } catch (error) {
    throw new Error(`Could not enqueue source enrichment. Is Redis running at ${process.env.REDIS_URL ?? "redis://127.0.0.1:6379"}? ${error instanceof Error ? error.message : ""}`);
  }
}

// src/features/dashboard/answer_block_normalizer.ts
var JUNK_LINE_PATTERNS = [
  /^videos?$/i,
  /^view all$/i,
  /^sponsored results?$/i,
  /^more results?/i,
  /^web results?$/i,
  /^related searches?/i,
  /^people also ask/i,
  /^find related/i,
  /^hide sponsored/i,
  /^youtube\s*[.-]/i,
  /^\d+:\d+$/,
  /^\d+ (days?|weeks?|months?) ago$/i,
  /^https?:\/\//i,
  /^\d+ (comments?|posts?|reactions?)$/i,
  /^\+\d+$/,
  /^-?\d+$/,
  /^(read ?more|show ?more)$/i
];
var SECTION_HINTS = [
  /^recommendations?$/i,
  /^enterprise$/i,
  /^mid-market$/i,
  /^startups?$/i,
  /^best picks?$/i,
  /^best platform types?$/i,
  /^best picks by use case$/i,
  /^quick recommendations?$/i,
  /^key features/i,
  /^key takeaways?$/i,
  /^summary$/i,
  /^overview$/i,
  /^conclusion$/i,
  /^top \d+/i,
  /^best \w+/i,
  /^if you/i,
  /^my shortlist$/i
];
var LEGACY_HEADER_HINTS = [
  "platform best for strengths potential limitations",
  "platform best fit why",
  "platform best for why",
  "tool use case strengths",
  "tool best for why",
  "tool best for why it stands out",
  "solution strengths limitations",
  "platform strengths limitations",
  "tool description best for",
  "platform description use case"
];
function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
function cleanLine(value) {
  return value.replace(/^[*\-\u2013\u2022]\s*/, "").replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").replace(/^#{1,4}\s+/, "").trim();
}
function isCitationMarker(line) {
  return /^\+\d+$|^[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/.test(line.trim());
}
function isJunkLine(line) {
  return JUNK_LINE_PATTERNS.some((pattern) => pattern.test(line.trim()));
}
function isSourceLabelArtifact(line) {
  return /^[a-z0-9][a-z0-9.-]{2,40}$/i.test(line.trim()) && !line.includes(" ");
}
function isLikelyHeading(line) {
  const clean2 = cleanLine(line);
  if (!clean2 || clean2.length > 90) return false;
  if (clean2.endsWith(".") || clean2.endsWith(",")) return false;
  if (SECTION_HINTS.some((pattern) => pattern.test(clean2))) return true;
  return /^[A-Z][A-Za-z0-9&+()/$\-\s]{2,70}$/.test(clean2) && !/[,.]/.test(clean2);
}
function isSentenceLike(line) {
  return /[.!?]$/.test(line) || line.includes(": ") || line.length > 72;
}
function cleanCellText(cell) {
  return compactWhitespace(cell.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`([^`]+)`/g, "$1"));
}
function isSeparatorRow(line) {
  return /^(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim()) || /^(?::?-{2,}:?\s*\|\s*)+:?-{2,}:?$/.test(line.trim());
}
function parsePipeRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cleanCellText);
}
function tryParsePipeTable(lines, startIndex) {
  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];
  if (!headerLine?.includes("|") || !separatorLine || !isSeparatorRow(separatorLine)) return null;
  const headers = parsePipeRow(headerLine);
  const rows = [];
  let i = startIndex + 2;
  while (i < lines.length && lines[i].includes("|") && !isLikelyHeading(lines[i])) {
    rows.push(parsePipeRow(lines[i]));
    i += 1;
  }
  if (headers.length < 2 || rows.length === 0) return null;
  return { headers, rows, consumed: i - startIndex };
}
function splitTabRow(line) {
  if (line.includes("	")) {
    const parts2 = line.split("	").map(cleanCellText).filter(Boolean);
    if (parts2.length >= 2) return parts2;
  }
  const parts = line.split(/\s{3,}/).map(cleanCellText).filter(Boolean);
  if (parts.length >= 2) return parts;
  return null;
}
function legacyHeaderMatch(line) {
  const normalized = line.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return LEGACY_HEADER_HINTS.some((header2) => normalized.includes(header2));
}
function splitBrandRow(line, knownBrands) {
  const brand = knownBrands.find((item) => line.toLowerCase().startsWith(`${item.toLowerCase()} `));
  if (!brand) return null;
  const rest = compactWhitespace(line.slice(brand.length));
  if (!rest) return [brand, "", ""];
  const markers = [" Premium ", " Expensive ", " Best value ", " Requires ", " Best suited ", " More ", " Smaller ", " Usually ", " Limited "];
  const marker = markers.map((value) => ({ value, index: rest.indexOf(value) })).filter((item) => item.index > 12).sort((a, b) => a.index - b.index)[0];
  if (!marker) return [brand, rest, ""];
  return [brand, rest.slice(0, marker.index).trim(), rest.slice(marker.index).trim()];
}
function flushList(blocks, listItems) {
  if (!listItems.length) return;
  blocks.push({ type: "list", items: [...listItems] });
  listItems.length = 0;
}
function flushParagraph(blocks, paragraph) {
  if (!paragraph.length) return;
  blocks.push({ type: "paragraph", text: compactWhitespace(paragraph.join(" ")) });
  paragraph.length = 0;
}
function normalizeRawLines(raw) {
  const rawLines = raw.replace(/\r/g, "").split("\n");
  return rawLines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (isJunkLine(trimmed)) return "";
    const previous = rawLines[index - 1]?.trim() ?? "";
    const next = rawLines[index + 1]?.trim() ?? "";
    if (isSourceLabelArtifact(trimmed) && (isCitationMarker(previous) || isCitationMarker(next))) return "";
    return trimmed;
  }).filter(Boolean);
}
function normalizeRowWidth(row, width) {
  if (row.length === width) return row;
  if (row.length > width) return [...row.slice(0, width - 1), row.slice(width - 1).join(" ")];
  return [...row, ...Array.from({ length: width - row.length }, () => "")];
}
function normalizeAnswerBlocks(raw, brands = []) {
  if (!raw?.trim()) return [{ type: "paragraph", text: "" }];
  const lines = normalizeRawLines(raw);
  const knownBrands = [...new Set(brands.filter(Boolean))].sort((a, b) => b.length - a.length);
  const blocks = [];
  const paragraph = [];
  const listItems = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const mdHeadingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (mdHeadingMatch) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems);
      blocks.push({ type: "heading", level: mdHeadingMatch[1].length <= 2 ? 2 : 3, text: cleanLine(mdHeadingMatch[2]) });
      index += 1;
      continue;
    }
    const pipeTable = tryParsePipeTable(lines, index);
    if (pipeTable) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems);
      blocks.push({ type: "comparison", headers: pipeTable.headers, rows: pipeTable.rows.map((row) => normalizeRowWidth(row, pipeTable.headers.length)) });
      index += pipeTable.consumed;
      continue;
    }
    const tabRow = splitTabRow(line);
    if (tabRow) {
      const tableRows = [tabRow];
      let i = index + 1;
      while (i < lines.length) {
        if (isSourceLabelArtifact(lines[i])) {
          i += 1;
          continue;
        }
        const nextRow = splitTabRow(lines[i]);
        if (!nextRow) break;
        tableRows.push(nextRow);
        i += 1;
      }
      if (tableRows.length >= 2) {
        flushParagraph(blocks, paragraph);
        flushList(blocks, listItems);
        const headers = tableRows[0];
        blocks.push({
          type: "comparison",
          headers,
          rows: tableRows.slice(1).map((row) => normalizeRowWidth(row, headers.length))
        });
        index = i;
        continue;
      }
    }
    if (legacyHeaderMatch(line)) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems);
      const rows = [];
      index += 1;
      while (index < lines.length && !isLikelyHeading(lines[index])) {
        const row = splitTabRow(lines[index]) ?? splitBrandRow(cleanLine(lines[index]), knownBrands);
        if (row) rows.push(row);
        index += 1;
      }
      if (rows.length) {
        blocks.push({ type: "comparison", headers: ["Tool", "Best for", "Why it stands out"], rows: rows.map((row) => normalizeRowWidth(row, 3)) });
        continue;
      }
    }
    const bulletMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph(blocks, paragraph);
      listItems.push(cleanLine(bulletMatch[1]));
      index += 1;
      continue;
    }
    const clean2 = cleanLine(line);
    if (isLikelyHeading(clean2)) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems);
      blocks.push({ type: "heading", level: blocks.length === 0 ? 2 : 3, text: clean2 });
      index += 1;
      continue;
    }
    const next = lines[index + 1];
    const prevBlock = blocks[blocks.length - 1];
    const isStandaloneItem = clean2.length <= 48 && !isSentenceLike(clean2) && (prevBlock?.type === "heading" || listItems.length > 0 || Boolean(next && !isSentenceLike(next) && !isLikelyHeading(next)));
    if (isStandaloneItem) {
      flushParagraph(blocks, paragraph);
      listItems.push(clean2);
      index += 1;
      continue;
    }
    flushList(blocks, listItems);
    paragraph.push(clean2);
    index += 1;
  }
  flushParagraph(blocks, paragraph);
  flushList(blocks, listItems);
  return blocks.length ? blocks : [{ type: "paragraph", text: compactWhitespace(raw) }];
}

// src/features/dashboard/dashboard_service.ts
function buildChatWhere(project_id, filters) {
  const where = {
    prompt: { project_id }
  };
  if (filters.days) {
    where.created_at = { gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1e3) };
  }
  if (filters.model && filters.model !== "all") {
    where.ai_model = { contains: filters.model, mode: "insensitive" };
  }
  if (filters.country && filters.country !== "all") {
    where.AND = [
      ...where.AND ? Array.isArray(where.AND) ? where.AND : [where.AND] : [],
      {
        OR: [
          { geo_country_code: filters.country },
          { geo_country_name: { equals: filters.country, mode: "insensitive" } }
        ]
      }
    ];
  }
  if (typeof filters.mentioned === "boolean") {
    where.brand_mentioned = filters.mentioned;
  }
  if (filters.cited === true) {
    where.sources = { some: { is_cited: true } };
  } else if (filters.cited === false) {
    where.sources = { none: { is_cited: true } };
  }
  const promptWhere = { project_id };
  let hasPromptFilter = false;
  if (filters.topic && filters.topic !== "all") {
    promptWhere.topic = filters.topic;
    hasPromptFilter = true;
  }
  if (filters.intent && filters.intent !== "all") {
    promptWhere.type = filters.intent;
    hasPromptFilter = true;
  }
  if (filters.tag && filters.tag !== "all") {
    promptWhere.tags = { has: filters.tag };
    hasPromptFilter = true;
  }
  if (filters.prompt_id) {
    promptWhere.id = filters.prompt_id;
    hasPromptFilter = true;
  }
  if (hasPromptFilter) {
    where.prompt = promptWhere;
  }
  const q = filters.q?.trim();
  if (q) {
    const searchCondition = {
      OR: [
        { raw_response: { contains: q, mode: "insensitive" } },
        { prompt: { text: { contains: q, mode: "insensitive" } } },
        { brand_mentions: { some: { brand_name: { contains: q, mode: "insensitive" } } } },
        { sources: { some: { domain: { contains: q, mode: "insensitive" } } } },
        { sources: { some: { title: { contains: q, mode: "insensitive" } } } }
      ]
    };
    where.AND = [
      ...where.AND ? Array.isArray(where.AND) ? where.AND : [where.AND] : [],
      searchCondition
    ];
  }
  return where;
}
function previousPeriodFilters(filters) {
  if (!filters.days) return null;
  return {
    ...filters,
    days: void 0
  };
}
function previousPeriodDateWhere(filters) {
  if (!filters.days) return void 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1e3;
  return {
    gte: new Date(now - filters.days * 2 * dayMs),
    lt: new Date(now - filters.days * dayMs)
  };
}
function deltaValue(current, previous, lowerIsBetter = false) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  return lowerIsBetter ? -diff : diff;
}
function splitAllTimeChats(chats) {
  const sorted = [...chats].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const midpoint = Math.floor(sorted.length / 2);
  return {
    previous: sorted.slice(0, midpoint),
    current: sorted.slice(midpoint)
  };
}
function aggregateOwnBrand(chats) {
  const totalChats = chats.length;
  if (totalChats === 0) {
    return { visibility: null, avg_position: null, avg_sentiment: null };
  }
  const brandMentions = chats.filter((c) => c.brand_mentioned);
  const positionChats = brandMentions.filter((c) => c.brand_position !== null);
  const sentimentChats = brandMentions.filter((c) => c.sentiment_score !== null);
  return {
    visibility: brandMentions.length / totalChats * 100,
    avg_position: positionChats.length > 0 ? positionChats.reduce((acc, c) => acc + (c.brand_position ?? 0), 0) / positionChats.length : null,
    avg_sentiment: sentimentChats.length > 0 ? sentimentChats.reduce((acc, c) => acc + (c.sentiment_score ?? 0), 0) / sentimentChats.length : null
  };
}
async function getFilterOptions(project_id) {
  const prompts = await prisma_default.prompt.findMany({
    where: { project_id },
    select: { topic: true, tags: true, type: true }
  });
  const topics = Array.from(new Set(prompts.map((p) => p.topic).filter(Boolean)));
  const tags = Array.from(new Set(prompts.flatMap((p) => p.tags).filter(Boolean)));
  const intents = Array.from(new Set(prompts.map((p) => p.type).filter(Boolean)));
  const chats = await prisma_default.chat.findMany({
    where: { prompt: { project_id } },
    select: { geo_country_code: true, geo_country_name: true },
    distinct: ["geo_country_code", "geo_country_name"]
  });
  const countries = chats.map((chat) => ({ value: chat.geo_country_code || chat.geo_country_name || "", label: chat.geo_country_name || chat.geo_country_code || "" })).filter((country) => country.value && country.label).sort((a, b) => a.label.localeCompare(b.label));
  return { topics, tags, intents, countries };
}
async function runPrompt(input) {
  const {
    prompt_id,
    run_id,
    raw_response,
    ai_model,
    screenshot_path,
    citations,
    geo_variant_id,
    geo_country_code,
    geo_country_name,
    geo_city
  } = input;
  const prompt = await prisma_default.prompt.findUniqueOrThrow({
    where: { id: prompt_id },
    include: { project: true }
  });
  const analysis = await analyzeResponse(
    raw_response,
    ai_model,
    prompt.project.brand_name,
    prompt.project.brand_url,
    citations ?? []
  );
  const sourceRows = buildSourceRows(analysis.sources, citations ?? []);
  const chat = await prisma_default.chat.create({
    data: {
      run_id,
      prompt_id,
      geo_variant_id: geo_variant_id ?? null,
      geo_country_code: geo_country_code ?? null,
      geo_country_name: geo_country_name ?? null,
      geo_city: geo_city ?? null,
      ai_model,
      raw_response,
      // always keep original scraper dump as truth
      display_response: null,
      answer_blocks: normalizeAnswerBlocks(
        raw_response,
        analysis.brand_mentions.map((mention) => mention.brand_name)
      ),
      screenshot_path: screenshot_path ?? null,
      brand_mentioned: analysis.brand_mentioned,
      brand_position: analysis.brand_position ?? null,
      sentiment_score: analysis.sentiment_score ?? null,
      brand_mentions: {
        create: analysis.brand_mentions.map((m) => ({
          brand_name: m.brand_name,
          domain: m.domain ?? null,
          // persist the real domain (peec.ai, profound.ai etc.)
          position: m.position ?? null,
          sentiment_score: m.sentiment_score ?? null
        }))
      },
      sources: {
        create: sourceRows
      }
    },
    include: {
      brand_mentions: true,
      sources: true
    }
  });
  if (input.enqueue_source_enrichment !== false && process.env.SOURCE_ENRICHMENT_AUTO_ENQUEUE !== "false") {
    try {
      const maxSources = Math.max(0, Number(process.env.SOURCE_ENRICHMENT_MAX_PER_CHAT ?? 8));
      const sources = maxSources > 0 ? await prisma_default.source.findMany({
        where: {
          chat_id: chat.id,
          url: { not: "" },
          source_url_content_id: null
        },
        select: { id: true },
        orderBy: [
          { is_cited: "desc" },
          { created_at: "asc" }
        ],
        take: maxSources
      }) : [];
      const queued = await Promise.allSettled(
        sources.map((source, index) => enqueueSourceEnrichment(source.id, index * 1e3))
      );
      const failed = queued.filter((result) => result.status === "rejected").length;
      if (failed > 0) {
        console.warn("Some source enrichment jobs could not be queued", {
          chat_id: chat.id,
          failed,
          total: queued.length
        });
      }
    } catch (error) {
      console.warn("Source enrichment enqueue skipped", {
        chat_id: chat.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }
  return chat;
}
function buildSourceRows(analysisSources, citations) {
  const rows = [];
  const byKey = /* @__PURE__ */ new Map();
  for (const source of analysisSources) {
    const url = source.url?.trim();
    const domain = source.domain?.trim() || safeDomain2(url);
    if (!url && !domain) continue;
    const row = {
      url: url || domain || "unknown-source",
      domain: domain || url || "unknown-source",
      source_type: source.source_type || "OTHER",
      is_cited: Boolean(source.is_cited),
      used_by_ai: true,
      source_kind: null,
      source_position: null,
      answer_position: null
    };
    byKey.set(sourceKey(row.url, row.domain), row);
  }
  for (const citation of citations) {
    const url = citation.url?.trim();
    if (!url) continue;
    const domain = citation.domain?.trim() || safeDomain2(url);
    const key = sourceKey(url, domain);
    const existing = byKey.get(key);
    const title = citation.text && citation.text !== url ? citation.text : null;
    const isCited = citation.is_cited ?? (citation.source_kind === "citation" || citation.source_kind === "attached_link");
    byKey.set(key, {
      url,
      domain,
      source_type: existing?.source_type ?? "OTHER",
      url_type: existing?.url_type ?? sourceKindToUrlType(citation.source_kind),
      is_cited: Boolean(citation.is_cited !== void 0 ? isCited : existing?.is_cited || isCited),
      used_by_ai: true,
      title: existing?.title ?? title,
      snippet: existing?.snippet ?? citation.snippet ?? null,
      source_kind: existing?.source_kind ?? citation.source_kind ?? null,
      source_position: existing?.source_position ?? citation.position ?? null,
      answer_position: existing?.answer_position ?? citation.answer_position ?? null
    });
  }
  rows.push(...byKey.values());
  return rows;
}
function sourceKindToUrlType(sourceKind) {
  if (sourceKind === "reference") return "DOCUMENTATION";
  return "OTHER";
}
function sourceKey(url, domain) {
  return (url?.trim() || domain?.trim() || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
}
function safeDomain2(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
async function getDashboardData({ project_id, filters }) {
  const chatWhere2 = buildChatWhere(project_id, filters || {});
  const chats = await prisma_default.chat.findMany({
    where: chatWhere2,
    select: {
      created_at: true,
      brand_mentioned: true,
      brand_position: true,
      sentiment_score: true,
      brand_mentions: {
        select: {
          brand_name: true,
          position: true,
          sentiment_score: true
        }
      },
      sources: {
        select: {
          domain: true,
          source_type: true
        }
      }
    }
  });
  const totalChats = chats.length;
  if (totalChats === 0) return null;
  const brandStats2 = aggregateOwnBrand(chats);
  let previousBrandStats = null;
  if (filters?.days) {
    const previousFilters = previousPeriodFilters(filters) ?? {};
    const previousWhere = buildChatWhere(project_id, previousFilters);
    previousWhere.created_at = previousPeriodDateWhere(filters);
    const previousChats = await prisma_default.chat.findMany({
      where: previousWhere,
      select: {
        brand_mentioned: true,
        brand_position: true,
        sentiment_score: true
      }
    });
    previousBrandStats = aggregateOwnBrand(previousChats);
  } else {
    const split = splitAllTimeChats(chats);
    previousBrandStats = aggregateOwnBrand(split.previous);
    const recentStats = aggregateOwnBrand(split.current);
    brandStats2.visibility = brandStats2.visibility ?? recentStats.visibility;
  }
  const competitorMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const mention of chat.brand_mentions) {
      const existing = competitorMap.get(mention.brand_name) || { count: 0, totalPosition: 0, totalSentiment: 0 };
      competitorMap.set(mention.brand_name, {
        count: existing.count + 1,
        totalPosition: existing.totalPosition + (mention.position || 0),
        totalSentiment: existing.totalSentiment + (mention.sentiment_score || 0)
      });
    }
  }
  const competitors = Array.from(competitorMap.entries()).map(([name, data]) => ({
    brand_name: name,
    visibility: data.count / totalChats * 100,
    avg_position: data.totalPosition / data.count,
    avg_sentiment: data.totalSentiment / data.count
  })).sort((a, b) => b.visibility - a.visibility);
  const sourceMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const uniqueDomains = new Set(chat.sources.map((s) => s.domain));
    for (const domain of uniqueDomains) {
      const sourceInfo = chat.sources.find((s) => s.domain === domain);
      const existing = sourceMap.get(domain) || { count: 0, type: sourceInfo?.source_type || "OTHER" };
      sourceMap.set(domain, { count: existing.count + 1, type: existing.type });
    }
  }
  const topSources = Array.from(sourceMap.entries()).map(([domain, data]) => ({
    domain,
    source_type: data.type,
    usage_percentage: data.count / totalChats * 100
  })).sort((a, b) => b.usage_percentage - a.usage_percentage);
  return {
    brand: {
      visibility: brandStats2.visibility ?? 0,
      avg_position: brandStats2.avg_position ?? 0,
      avg_sentiment: brandStats2.avg_sentiment ?? 0,
      delta_visibility: deltaValue(brandStats2.visibility, previousBrandStats?.visibility ?? null),
      delta_position: deltaValue(brandStats2.avg_position, previousBrandStats?.avg_position ?? null, true),
      delta_sentiment: deltaValue(brandStats2.avg_sentiment, previousBrandStats?.avg_sentiment ?? null)
    },
    competitors,
    topSources
  };
}
async function getVisibilityTimeSeries(project_id, filters) {
  const chatWhere2 = buildChatWhere(project_id, filters || {});
  const chats = await prisma_default.chat.findMany({
    where: chatWhere2,
    select: {
      created_at: true,
      brand_mentioned: true,
      brand_mentions: {
        select: {
          brand_name: true,
          domain: true
        }
      },
      run: { select: { ran_at: true } }
    },
    orderBy: { created_at: "asc" }
  });
  const dayMap = /* @__PURE__ */ new Map();
  const project = await prisma_default.project.findUniqueOrThrow({
    where: { id: project_id },
    include: { competitors: true }
  });
  const mentionDomains = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const mention of chat.brand_mentions) {
      const domain = normalizeEntityDomain(mention.domain);
      if (domain && !mentionDomains.has(mention.brand_name)) {
        mentionDomains.set(mention.brand_name, domain);
      }
    }
  }
  for (const chat of chats) {
    const dateKey = chat.run.ran_at.toISOString().slice(0, 10);
    const existing = dayMap.get(dateKey) ?? {
      total: 0,
      brandHit: 0,
      competitorHits: /* @__PURE__ */ new Map()
    };
    existing.total += 1;
    if (chat.brand_mentioned) existing.brandHit += 1;
    for (const mention of chat.brand_mentions) {
      const count = existing.competitorHits.get(mention.brand_name) ?? 0;
      existing.competitorHits.set(mention.brand_name, count + 1);
    }
    dayMap.set(dateKey, existing);
  }
  const competitorNames = project.competitors.map((c) => c.name);
  return Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => {
    const brands = {
      [project.brand_name]: data.total > 0 ? data.brandHit / data.total * 100 : 0
    };
    const brand_domains = {
      [project.brand_name]: normalizeEntityDomain(project.brand_url)
    };
    for (const name of competitorNames) {
      const hits = data.competitorHits.get(name) ?? 0;
      brands[name] = data.total > 0 ? hits / data.total * 100 : 0;
      const configuredUrl = project.competitors.find((competitor) => competitor.name === name)?.url;
      brand_domains[name] = normalizeEntityDomain(configuredUrl) ?? mentionDomains.get(name) ?? null;
    }
    return { date, total_chats: data.total, brands, brand_domains };
  });
}
async function getRecentChats(project_id, filters, limit = 9) {
  const chatWhere2 = buildChatWhere(project_id, filters || {});
  const chats = await prisma_default.chat.findMany({
    where: chatWhere2,
    include: {
      brand_mentions: { select: { brand_name: true, sentiment_score: true, position: true } },
      sources: {
        select: {
          domain: true,
          url: true,
          title: true,
          snippet: true,
          is_cited: true,
          source_type: true,
          url_type: true,
          source_kind: true,
          source_position: true,
          answer_position: true
        },
        orderBy: [
          { is_cited: "desc" },
          { answer_position: "asc" },
          { source_position: "asc" },
          { created_at: "asc" }
        ]
      },
      prompt: { select: { text: true } },
      run: { select: { ran_at: true } }
    },
    orderBy: { created_at: "desc" },
    take: limit
  });
  return chats.map((chat) => ({
    id: chat.id,
    ai_model: chat.ai_model,
    prompt_text: chat.prompt.text,
    excerpt: (chat.display_response || chat.raw_response).replace(/[#*`\[\]>]/g, "").replace(/\n/g, " ").slice(0, 200),
    raw_response: chat.raw_response,
    display_response: chat.display_response ?? null,
    answer_blocks: chat.answer_blocks,
    brand_mentioned: chat.brand_mentioned,
    brand_position: chat.brand_position,
    sentiment_score: chat.sentiment_score,
    brands: chat.brand_mentions.map((m) => m.brand_name),
    brand_details: chat.brand_mentions,
    sources: chat.sources,
    screenshot_path: chat.screenshot_path,
    has_screenshot: Boolean(chat.screenshot_path?.startsWith("gs://")),
    ran_at: chat.run.ran_at
  }));
}
async function getChatsPage(project_id, filters, page = 1, pageSize = 10) {
  const chatWhere2 = buildChatWhere(project_id, filters || {});
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const [total, chats] = await Promise.all([
    prisma_default.chat.count({ where: chatWhere2 }),
    prisma_default.chat.findMany({
      where: chatWhere2,
      include: {
        brand_mentions: { select: { brand_name: true, sentiment_score: true, position: true } },
        sources: {
          select: {
            domain: true,
            url: true,
            title: true,
            snippet: true,
            is_cited: true,
            source_type: true,
            url_type: true,
            source_kind: true,
            source_position: true,
            answer_position: true
          },
          orderBy: [
            { is_cited: "desc" },
            { answer_position: "asc" },
            { source_position: "asc" },
            { created_at: "asc" }
          ]
        },
        prompt: { select: { text: true } },
        run: { select: { ran_at: true } }
      },
      orderBy: { created_at: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize
    })
  ]);
  return {
    data: chats.map((chat) => ({
      id: chat.id,
      ai_model: chat.ai_model,
      prompt_text: chat.prompt.text,
      excerpt: (chat.display_response || chat.raw_response).replace(/[#*`\[\]>]/g, "").replace(/\n/g, " ").slice(0, 200),
      raw_response: chat.raw_response,
      display_response: chat.display_response ?? null,
      answer_blocks: chat.answer_blocks,
      brand_mentioned: chat.brand_mentioned,
      brand_position: chat.brand_position,
      sentiment_score: chat.sentiment_score,
      brands: chat.brand_mentions.map((m) => m.brand_name),
      brand_details: chat.brand_mentions,
      sources: chat.sources,
      screenshot_path: chat.screenshot_path,
      has_screenshot: Boolean(chat.screenshot_path?.startsWith("gs://")),
      ran_at: chat.run.ran_at
    })),
    page: safePage,
    page_size: safePageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / safePageSize))
  };
}

// src/features/dashboard/dashboard_controller.ts
init_project_access();
function parseFilters(query) {
  const filters = {};
  if (query.days) filters.days = parseInt(query.days);
  if (query.model && query.model !== "all") filters.model = query.model;
  if (query.topic && query.topic !== "all") filters.topic = query.topic;
  if (query.tag && query.tag !== "all") filters.tag = query.tag;
  if (query.prompt_id && query.prompt_id !== "all") filters.prompt_id = query.prompt_id;
  if (query.q) filters.q = query.q;
  if (query.country && query.country !== "all") filters.country = query.country;
  if (query.intent && query.intent !== "all") filters.intent = query.intent;
  if (query.mentioned === "true" || query.mentioned === "false") filters.mentioned = query.mentioned === "true";
  if (query.cited === "true" || query.cited === "false") filters.cited = query.cited === "true";
  return filters;
}
var runPromptController = async (req, res) => {
  try {
    const { prompt_id, run_id, raw_response, ai_model } = req.body;
    if (!prompt_id || !run_id || !raw_response || !ai_model) {
      res.status(400).json({ error: "prompt_id, run_id, raw_response, and ai_model are required" });
      return;
    }
    const user_id = req.user.id;
    await assertPromptAccess(prompt_id, user_id);
    await assertRunAccess(run_id, user_id);
    const chat = await runPrompt({ prompt_id, run_id, raw_response, ai_model });
    res.status(201).json(chat);
  } catch (error) {
    if (error instanceof Error && (error.message === "PROMPT_NOT_FOUND" || error.message === "RUN_NOT_FOUND")) {
      res.status(404).json({ error: "Prompt or run not found" });
      return;
    }
    res.status(500).json({ error: "Failed to run prompt analysis" });
  }
};
var getDashboardDataController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const filters = parseFilters(req.query);
    const data = await getDashboardData({ project_id, filters });
    if (!data) {
      res.status(404).json({ error: "No data found for this project" });
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get dashboard data" });
  }
};
var getVisibilityTimeSeriesController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const filters = parseFilters(req.query);
    const data = await getVisibilityTimeSeries(project_id, filters);
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get timeseries data" });
  }
};
var getRecentChatsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const filters = parseFilters(req.query);
    const data = await getRecentChats(project_id, filters);
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get recent chats" });
  }
};
var getChatsPageController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const filters = parseFilters(req.query);
    const page = Number.parseInt(req.query.page, 10) || 1;
    const pageSize = Number.parseInt(req.query.page_size, 10) || 10;
    const data = await getChatsPage(project_id, filters, page, pageSize);
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get chats" });
  }
};
var getFilterOptionsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const data = await getFilterOptions(project_id);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getFilterOptionsController:", error);
    res.status(500).json({ error: "Failed to get filter options" });
  }
};

// src/features/dashboard/dashboard_route.ts
var router3 = (0, import_express3.Router)();
router3.post("/run", runPromptController);
router3.get("/:project_id/filters", getFilterOptionsController);
router3.get("/:project_id/timeseries", getVisibilityTimeSeriesController);
router3.get("/:project_id/recent-chats", getRecentChatsController);
router3.get("/:project_id/chats", getChatsPageController);
router3.get("/:project_id", getDashboardDataController);
var dashboard_route_default = router3;

// src/features/sources/sources_routes.ts
var import_express4 = require("express");

// src/features/sources/sources_service.ts
init_prisma();

// src/features/sources/source_enrichment_service.ts
var import_axios6 = __toESM(require("axios"), 1);
var import_https4 = __toESM(require("https"), 1);
var import_client9 = require("@prisma/client");
init_prisma();
var MAX_REDIRECT_HOPS2 = 5;
async function fetchHtmlWithSsrfGuard(url) {
  const requestConfig = {
    timeout: Number(process.env.SOURCE_FETCH_TIMEOUT_MS ?? 2e4),
    responseType: "text",
    maxRedirects: 0,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9"
    },
    httpsAgent: process.env.NODE_ENV !== "production" ? new import_https4.default.Agent({ rejectUnauthorized: false }) : void 0,
    validateStatus: (status) => status >= 200 && status < 400
  };
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS2; hop++) {
    const safeUrl = await assertPublicUrl(currentUrl);
    const response = await import_axios6.default.get(safeUrl.toString(), requestConfig);
    const location = response.headers?.location;
    if (response.status >= 300 && response.status < 400 && typeof location === "string") {
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }
    return typeof response.data === "string" ? response.data : String(response.data);
  }
  throw new BlockedUrlError("Source URL redirected too many times.");
}
async function enrichSource(source_id) {
  const source = await prisma_default.source.findUniqueOrThrow({
    where: { id: source_id },
    include: {
      chat: {
        include: {
          brand_mentions: true,
          run: {
            include: {
              project: {
                include: {
                  competitors: true
                }
              }
            }
          }
        }
      }
    }
  });
  const project = source.chat.run.project;
  const brands = [
    project.brand_name,
    ...project.competitors.map((competitor) => competitor.name),
    ...source.chat.brand_mentions.map((mention) => mention.brand_name)
  ];
  const enriched = await fetchAndExtractSource(source.url, brands);
  const content = await prisma_default.sourceUrlContent.upsert({
    where: { url: source.url },
    create: enriched,
    update: enriched
  });
  await prisma_default.source.updateMany({
    where: { url: source.url },
    data: {
      source_url_content_id: content.id,
      title: enriched.title,
      snippet: enriched.snippet,
      source_type: enriched.source_type,
      url_type: enriched.url_type,
      platform: enriched.platform,
      subreddit: enriched.subreddit,
      mentioned_brands: enriched.mentioned_brands
    }
  });
  return content;
}
async function fetchAndExtractSource(url, brands) {
  const normalizedUrl = ensureHttpUrl(url);
  const domain = safeDomain3(normalizedUrl);
  const base = classifyUrl(normalizedUrl, domain);
  try {
    const html = await fetchHtmlWithSsrfGuard(normalizedUrl);
    const title = extractTitle(html);
    let extractedHtml = html;
    try {
      const { JSDOM } = await import("jsdom");
      const { Readability } = await import("@mozilla/readability");
      const doc = new JSDOM(html, { url: normalizedUrl });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();
      if (article && article.content) {
        extractedHtml = article.content;
      }
    } catch (e) {
      console.warn("Readability parsing failed, falling back to raw html", e);
    }
    const text = normalizeText2(stripHtml(extractedHtml)).slice(0, Number(process.env.SOURCE_CONTENT_MAX_CHARS ?? 25e3));
    const snippet = buildSnippet(text, brands);
    const mentioned_brands = findMentionedBrands(text, brands);
    return {
      url: normalizedUrl,
      domain,
      title,
      content: text,
      snippet,
      content_length: text.length,
      source_type: base.source_type,
      url_type: base.url_type,
      platform: base.platform,
      subreddit: base.subreddit,
      mentioned_brands,
      fetch_status: "SUCCESS",
      error_reason: null,
      content_updated_at: /* @__PURE__ */ new Date()
    };
  } catch (error) {
    return {
      url: normalizedUrl,
      domain,
      title: null,
      content: null,
      snippet: null,
      content_length: 0,
      source_type: base.source_type,
      url_type: base.url_type,
      platform: base.platform,
      subreddit: base.subreddit,
      mentioned_brands: [],
      fetch_status: "FAILED",
      error_reason: error instanceof Error ? error.message : "Source fetch failed",
      content_updated_at: /* @__PURE__ */ new Date()
    };
  }
}
function classifyUrl(url, domain) {
  const lower = url.toLowerCase();
  const platform = platformFromDomain(domain);
  const subreddit = extractSubreddit(url);
  let source_type = import_client9.SourceType.OTHER;
  let url_type = "OTHER";
  if (domain.includes("reddit.com") || domain.includes("quora.com")) {
    source_type = import_client9.SourceType.UGC;
    url_type = "DISCUSSION";
  } else if (domain.includes("linkedin.com") || domain.includes("x.com") || domain.includes("twitter.com") || domain.includes("youtube.com")) {
    source_type = import_client9.SourceType.SOCIAL;
    url_type = "SOCIAL_POST";
  } else if (lower.includes("review") || domain.includes("g2.com") || domain.includes("capterra.com")) {
    source_type = import_client9.SourceType.REFERENCE;
    url_type = "REVIEW";
  } else if (lower.includes("compare") || lower.includes("alternative") || lower.includes("vs-") || lower.includes("-vs-")) {
    source_type = import_client9.SourceType.EDITORIAL;
    url_type = "COMPARISON";
  } else if (lower.includes("best") || lower.includes("top-") || lower.includes("tools") || lower.includes("software")) {
    source_type = import_client9.SourceType.EDITORIAL;
    url_type = "LISTICLE";
  } else if (lower.includes("docs") || lower.includes("documentation")) {
    source_type = import_client9.SourceType.REFERENCE;
    url_type = "DOCUMENTATION";
  } else if (isHomepage(url)) {
    source_type = import_client9.SourceType.CORPORATE;
    url_type = "HOMEPAGE";
  } else {
    url_type = "ARTICLE";
  }
  return { source_type, url_type, platform, subreddit };
}
function safeDomain3(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function ensureHttpUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
function platformFromDomain(domain) {
  if (domain.includes("reddit.com")) return "reddit";
  if (domain.includes("linkedin.com")) return "linkedin";
  if (domain.includes("youtube.com")) return "youtube";
  if (domain.includes("x.com") || domain.includes("twitter.com")) return "x";
  if (domain.includes("quora.com")) return "quora";
  return null;
}
function extractSubreddit(url) {
  const match = url.match(/reddit\.com\/r\/([^/?#]+)/i);
  return match ? `r/${decodeURIComponent(match[1])}` : null;
}
function isHomepage(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}
function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return decodeHtml2(og[1]).trim();
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return title?.[1] ? decodeHtml2(stripHtml(title[1])).trim() : null;
}
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<\/?(?:p|div|section|article|main|header|footer|aside|nav|h[1-6]|ul|ol|blockquote|pre|table|thead|tbody|tr|figure|figcaption)[^>]*>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n\u2022 ").replace(/<[^>]+>/g, "");
}
function normalizeText2(text) {
  return decodeHtml2(text).split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function decodeHtml2(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function findMentionedBrands(text, brands) {
  const lower = text.toLowerCase();
  return [...new Set(brands.filter((brand) => lower.includes(brand.toLowerCase())))];
}
function buildSnippet(text, brands) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const brand = brands.find((item) => lower.includes(item.toLowerCase()));
  if (!brand) return text.slice(0, 500);
  const index = lower.indexOf(brand.toLowerCase());
  const start = Math.max(0, index - 220);
  const end = Math.min(text.length, index + brand.length + 280);
  return text.slice(start, end).trim();
}

// src/features/sources/sources_service.ts
function paginate(items, page = 1, pageSize = 20) {
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safePage = Math.max(page, 1);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    page_size: safePageSize,
    total: items.length,
    total_pages: Math.max(1, Math.ceil(items.length / safePageSize))
  };
}
function matchesSearch(value, search) {
  const needle = search?.trim().toLowerCase();
  return !needle || value.toLowerCase().includes(needle);
}
async function getTopSources(project_id, filters = {}) {
  const chats = await prisma_default.chat.findMany({
    where: { ...buildChatWhere(project_id, filters), run: { project_id } },
    select: {
      id: true,
      sources: {
        select: {
          domain: true,
          source_type: true,
          is_cited: true
        }
      }
    }
  });
  const totalChats = chats.length;
  if (totalChats === 0) return [];
  const sourceMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const uniqueDomains = new Set(chat.sources.map((s) => s.domain));
    for (const domain of uniqueDomains) {
      const sourceInfoList = chat.sources.filter((s) => s.domain === domain);
      const citationsInChat = sourceInfoList.filter((s) => s.is_cited).length;
      const type = sourceInfoList[0]?.source_type || "OTHER";
      const existing = sourceMap.get(domain) || { count: 0, type, totalCitations: 0 };
      sourceMap.set(domain, {
        count: existing.count + 1,
        type,
        totalCitations: existing.totalCitations + citationsInChat
      });
    }
  }
  const topSources = Array.from(sourceMap.entries()).map(([domain, data]) => ({
    domain,
    source_type: data.type,
    used_percentage: data.count / totalChats * 100,
    avg_citations: data.totalCitations / data.count
  })).sort((a, b) => b.used_percentage - a.used_percentage);
  return topSources;
}
async function getDomaEUReport(project_id, filters = {}) {
  const chats = await prisma_default.chat.findMany({
    where: { ...buildChatWhere(project_id, filters), run: { project_id } },
    select: {
      id: true,
      sources: {
        select: {
          domain: true,
          source_type: true,
          url_type: true,
          url: true,
          is_cited: true
        }
      }
    }
  });
  const totalChats = chats.length;
  if (totalChats === 0) return [];
  const domainMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const source of chat.sources) {
      const existing = domainMap.get(source.domain) ?? {
        retrievedChats: /* @__PURE__ */ new Set(),
        citationCount: 0,
        sourceType: source.source_type,
        urlTypes: /* @__PURE__ */ new Set(),
        urls: /* @__PURE__ */ new Set()
      };
      existing.retrievedChats.add(chat.id);
      existing.urls.add(source.url);
      existing.urlTypes.add(source.url_type);
      if (source.is_cited) existing.citationCount += 1;
      domainMap.set(source.domain, existing);
    }
  }
  return Array.from(domainMap.entries()).map(([domain, data]) => {
    const retrievalCount = data.retrievedChats.size;
    return {
      domain,
      source_type: data.sourceType,
      url_types: Array.from(data.urlTypes),
      unique_urls: data.urls.size,
      retrieval_count: retrievalCount,
      retrieval_rate: retrievalCount / totalChats * 100,
      citation_count: data.citationCount,
      citation_rate: retrievalCount > 0 ? data.citationCount / retrievalCount * 100 : 0
    };
  }).sort((a, b) => b.retrieval_rate - a.retrieval_rate);
}
async function getDomaEUReportPage(project_id, filters = {}, options = {}) {
  const rows = await getDomaEUReport(project_id, filters);
  const search = options.search?.trim().toLowerCase();
  const filtered = search ? rows.filter((row) => matchesSearch(`${row.domain} ${row.source_type}`, search)) : rows;
  return paginate(filtered, options.page, options.pageSize);
}
async function getUrlReport(project_id, filters = {}) {
  const sources = await prisma_default.source.findMany({
    where: { chat: { ...buildChatWhere(project_id, filters), run: { project_id } } },
    include: {
      source_url_content: true,
      chat: {
        include: {
          brand_mentions: true,
          prompt: true
        }
      }
    },
    orderBy: { created_at: "desc" }
  });
  const urlMap = /* @__PURE__ */ new Map();
  for (const source of sources) {
    const existing = urlMap.get(source.url) ?? {
      url: source.url,
      domain: source.domain,
      title: source.title ?? source.source_url_content?.title ?? null,
      source_type: source.source_type,
      url_type: source.url_type,
      platform: source.platform,
      subreddit: source.subreddit,
      retrievals: 0,
      citations: 0,
      prompts: /* @__PURE__ */ new Set(),
      mentionedBrands: /* @__PURE__ */ new Set(),
      snippet: source.snippet ?? source.source_url_content?.snippet ?? null,
      content_updated_at: source.source_url_content?.content_updated_at ?? null,
      content_length: source.source_url_content?.content_length ?? 0,
      fetch_status: source.source_url_content?.fetch_status ?? null,
      error_reason: source.source_url_content?.error_reason ?? null
    };
    existing.retrievals += 1;
    if (source.is_cited) existing.citations += 1;
    existing.prompts.add(source.chat.prompt.text);
    if (!existing.snippet && source.source_url_content?.snippet) existing.snippet = source.source_url_content.snippet;
    if (!existing.content_updated_at && source.source_url_content?.content_updated_at) {
      existing.content_updated_at = source.source_url_content.content_updated_at;
    }
    if ((source.source_url_content?.content_length ?? 0) > existing.content_length) {
      existing.content_length = source.source_url_content?.content_length ?? 0;
    }
    if (!existing.fetch_status && source.source_url_content?.fetch_status) {
      existing.fetch_status = source.source_url_content.fetch_status;
    }
    if (!existing.error_reason && source.source_url_content?.error_reason) {
      existing.error_reason = source.source_url_content.error_reason;
    }
    const sourceBrands = Array.isArray(source.mentioned_brands) ? source.mentioned_brands : [];
    const contentBrands = Array.isArray(source.source_url_content?.mentioned_brands) ? source.source_url_content.mentioned_brands : [];
    for (const brand of [...sourceBrands, ...contentBrands]) {
      if (typeof brand === "string") existing.mentionedBrands.add(brand);
    }
    urlMap.set(source.url, existing);
  }
  return Array.from(urlMap.values()).map((item) => ({
    url: item.url,
    domain: item.domain,
    title: item.title,
    source_type: item.source_type,
    url_type: item.url_type,
    platform: item.platform,
    subreddit: item.subreddit,
    retrievals: item.retrievals,
    citations: item.citations,
    citation_rate: item.retrievals > 0 ? item.citations / item.retrievals * 100 : 0,
    prompts: Array.from(item.prompts),
    mentioned_brands: Array.from(item.mentionedBrands),
    snippet: item.snippet,
    content_updated_at: item.content_updated_at,
    content_length: item.content_length,
    fetch_status: item.fetch_status,
    error_reason: item.error_reason
  })).sort((a, b) => b.retrievals - a.retrievals);
}
async function getUrlReportPage(project_id, filters = {}, options = {}) {
  const rows = await getUrlReport(project_id, filters);
  const search = options.search?.trim().toLowerCase();
  const domain = options.domain?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const domainMatch = !domain || row.domain.toLowerCase() === domain;
    const searchMatch = !search || matchesSearch(
      `${row.url} ${row.domain} ${row.title ?? ""} ${row.url_type ?? ""}`,
      search
    );
    return domainMatch && searchMatch;
  });
  return paginate(filtered, options.page, options.pageSize);
}
async function getUrlContent(project_id, url) {
  const source = await findProjectSourceByUrl(project_id, url);
  if (!source) return null;
  if (source.source_url_content) return source.source_url_content;
  const matchedContent = await findExistingContentByUrl(source.url);
  if (matchedContent) {
    await prisma_default.source.updateMany({
      where: { url: source.url },
      data: {
        source_url_content_id: matchedContent.id,
        title: matchedContent.title,
        snippet: matchedContent.snippet,
        source_type: matchedContent.source_type,
        url_type: matchedContent.url_type,
        platform: matchedContent.platform,
        subreddit: matchedContent.subreddit,
        mentioned_brands: matchedContent.mentioned_brands ?? []
      }
    });
    return matchedContent;
  }
  return enrichSource(source.id);
}
async function findProjectSourceByUrl(project_id, url) {
  const exact = await prisma_default.source.findFirst({
    where: {
      url,
      chat: { run: { project_id } }
    },
    include: { source_url_content: true },
    orderBy: { created_at: "desc" }
  });
  if (exact) return exact;
  const targetKey = canonicalUrlKey(url);
  const domain = safeDomain4(url);
  const candidates = await prisma_default.source.findMany({
    where: {
      domain,
      chat: { run: { project_id } }
    },
    include: { source_url_content: true },
    orderBy: { created_at: "desc" },
    take: 100
  });
  return candidates.find((source) => canonicalUrlKey(source.url) === targetKey) ?? null;
}
async function findExistingContentByUrl(url) {
  const exact = await prisma_default.sourceUrlContent.findUnique({ where: { url } });
  if (exact) return exact;
  const targetKey = canonicalUrlKey(url);
  const domain = safeDomain4(url);
  const candidates = await prisma_default.sourceUrlContent.findMany({
    where: { domain },
    orderBy: { updated_at: "desc" },
    take: 100
  });
  return candidates.find((content) => canonicalUrlKey(content.url) === targetKey) ?? null;
}
function canonicalUrlKey(url) {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_") || ["fbclid", "gclid", "msclkid"].includes(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path2 = parsed.pathname.replace(/\/+$/, "") || "/";
    const query = parsed.searchParams.toString();
    return `${host}${path2}${query ? `?${query}` : ""}`;
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}
function safeDomain4(url) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}
async function getSourceTrend(project_id) {
  const chats = await prisma_default.chat.findMany({
    where: { run: { project_id } },
    select: {
      id: true,
      created_at: true,
      sources: {
        select: {
          domain: true,
          source_type: true,
          is_cited: true
        }
      }
    },
    orderBy: { created_at: "asc" }
  });
  if (chats.length === 0) return [];
  const topDomains = await getDomaEUReport(project_id);
  const domainSet = new Set(topDomains.slice(0, 6).map((source) => source.domain));
  const dayMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const date = chat.created_at.toISOString().slice(0, 10);
    const existingDay = dayMap.get(date) ?? {
      date,
      label: chat.created_at.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total_chats: 0,
      domains: /* @__PURE__ */ new Map()
    };
    existingDay.total_chats += 1;
    const uniqueSourceDomains = /* @__PURE__ */ new Set();
    for (const source of chat.sources) {
      if (!domainSet.has(source.domain) || uniqueSourceDomains.has(source.domain)) continue;
      uniqueSourceDomains.add(source.domain);
      const domainData = existingDay.domains.get(source.domain) ?? {
        domain: source.domain,
        source_type: source.source_type,
        chats: /* @__PURE__ */ new Set(),
        citations: 0
      };
      domainData.chats.add(chat.id);
      domainData.citations += chat.sources.filter((item) => item.domain === source.domain && item.is_cited).length;
      existingDay.domains.set(source.domain, domainData);
    }
    dayMap.set(date, existingDay);
  }
  return Array.from(dayMap.values()).map((day) => ({
    date: day.date,
    label: day.label,
    total_chats: day.total_chats,
    domains: Array.from(day.domains.values()).map((domain) => ({
      domain: domain.domain,
      source_type: domain.source_type,
      usage_percentage: day.total_chats > 0 ? domain.chats.size / day.total_chats * 100 : 0,
      citation_count: domain.citations
    }))
  }));
}
async function getSourceGaps(project_id) {
  const project = await prisma_default.project.findUniqueOrThrow({
    where: { id: project_id },
    include: { competitors: true }
  });
  const sources = await prisma_default.source.findMany({
    where: {
      chat: {
        run: { project_id }
      }
    },
    select: {
      url: true,
      domain: true,
      title: true,
      source_type: true,
      url_type: true,
      platform: true,
      subreddit: true,
      is_cited: true,
      mentioned_brands: true,
      source_url_content: {
        select: {
          title: true,
          mentioned_brands: true
        }
      },
      chat: {
        select: {
          brand_mentions: {
            select: {
              brand_name: true
            }
          }
        }
      }
    }
  });
  const brandName = project.brand_name.toLowerCase();
  const trackedCompetitors = new Set(project.competitors.map((competitor) => competitor.name.toLowerCase()));
  const gapMap = /* @__PURE__ */ new Map();
  for (const source of sources) {
    const existing = gapMap.get(source.url) ?? {
      url: source.url,
      domain: source.domain,
      title: source.title ?? source.source_url_content?.title ?? null,
      source_type: source.source_type,
      url_type: source.url_type,
      platform: source.platform,
      subreddit: source.subreddit,
      retrievals: 0,
      citations: 0,
      mentionedOwnBrand: false,
      mentionedCompetitors: /* @__PURE__ */ new Set(),
      trackedCompetitors: /* @__PURE__ */ new Set()
    };
    existing.retrievals += 1;
    if (source.is_cited) existing.citations += 1;
    const sourceBrands = Array.isArray(source.mentioned_brands) ? source.mentioned_brands.filter((brand) => typeof brand === "string") : [];
    const candidateBrands = [
      project.brand_name,
      ...project.competitors.map((competitor) => competitor.name),
      ...source.chat.brand_mentions.map((mention) => mention.brand_name)
    ];
    const inferredBrands = inferBrandsFromSourceIdentity(source.url, source.domain, source.title ?? source.source_url_content?.title ?? null, candidateBrands);
    const sourceLevelBrands = sourceBrands.length > 0 ? sourceBrands : inferredBrands;
    const answerCompetitorBrands = source.chat.brand_mentions.map((mention) => mention.brand_name).filter((brand) => brand.toLowerCase() !== brandName);
    const competitorBrands = sourceLevelBrands.length > 0 ? sourceLevelBrands : answerCompetitorBrands;
    for (const brand of sourceLevelBrands) {
      const normalized = brand.toLowerCase();
      if (normalized === brandName) {
        existing.mentionedOwnBrand = true;
      }
    }
    for (const brand of competitorBrands) {
      const normalized = brand.toLowerCase();
      if (normalized !== brandName) {
        existing.mentionedCompetitors.add(brand);
        if (trackedCompetitors.has(normalized)) {
          existing.trackedCompetitors.add(brand);
        }
      }
    }
    gapMap.set(source.url, existing);
  }
  return Array.from(gapMap.values()).map((url) => {
    const competitorHits = Array.from(url.mentionedCompetitors);
    return {
      url: url.url,
      domain: url.domain,
      title: url.title,
      source_type: url.source_type,
      url_type: url.url_type,
      platform: url.platform,
      subreddit: url.subreddit,
      retrievals: url.retrievals,
      citations: url.citations,
      mentioned_own_brand: url.mentionedOwnBrand,
      mentioned_competitors: competitorHits,
      tracked_competitors: Array.from(url.trackedCompetitors),
      gap_score: !url.mentionedOwnBrand && competitorHits.length > 0 ? url.retrievals * competitorHits.length : 0,
      suggested_action: buildSuggestedAction(url, url.mentionedOwnBrand, competitorHits)
    };
  }).filter((gap) => gap.gap_score > 0).sort((a, b) => b.gap_score - a.gap_score);
}
async function getSourceGapsPage(project_id, options = {}) {
  const rows = await getSourceGaps(project_id);
  const search = options.search?.trim().toLowerCase();
  const domain = options.domain?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const domainMatch = !domain || row.domain.toLowerCase() === domain;
    const searchMatch = !search || matchesSearch(
      `${row.url} ${row.domain} ${row.title ?? ""} ${row.url_type ?? ""}`,
      search
    );
    return domainMatch && searchMatch;
  });
  return paginate(filtered, options.page, options.pageSize);
}
function buildSuggestedAction(url, hasBrand, competitors) {
  if (hasBrand) return "Maintain presence on this source.";
  if (url.platform === "reddit") {
    return `Join or monitor ${url.subreddit ?? "this Reddit discussion"} because competitors ${competitors.join(", ")} are visible there.`;
  }
  if (url.url_type === "LISTICLE" || url.url_type === "COMPARISON") {
    return `Pitch ${url.domain} or improve content so your brand appears alongside ${competitors.join(", ")}.`;
  }
  return `Investigate ${url.domain}; competitors ${competitors.join(", ")} appear in a source used by AI answers.`;
}
function inferBrandsFromSourceIdentity(url, domain, title, brands) {
  const haystack = `${url} ${domain} ${title ?? ""}`.toLowerCase();
  const normalizedDomain = domain.replace(/^www\./, "").split(".")[0].toLowerCase();
  return [...new Set(brands.filter((brand) => {
    const normalizedBrand = brand.toLowerCase();
    const compactBrand = normalizedBrand.replace(/[^a-z0-9]/g, "");
    const compactHaystack = haystack.replace(/[^a-z0-9]/g, "");
    return haystack.includes(normalizedBrand) || compactHaystack.includes(compactBrand) || compactBrand.includes(normalizedDomain) || normalizedDomain.includes(compactBrand);
  }))];
}

// src/features/sources/sources_controller.ts
init_project_access();
function parseFilters2(query) {
  const filters = {};
  if (query.days) filters.days = parseInt(query.days, 10);
  if (query.model && query.model !== "all") filters.model = query.model;
  if (query.topic && query.topic !== "all") filters.topic = query.topic;
  if (query.tag && query.tag !== "all") filters.tag = query.tag;
  if (query.country && query.country !== "all") filters.country = query.country;
  if (query.intent && query.intent !== "all") filters.intent = query.intent;
  if (query.mentioned === "true" || query.mentioned === "false") filters.mentioned = query.mentioned === "true";
  if (query.cited === "true" || query.cited === "false") filters.cited = query.cited === "true";
  return filters;
}
function parsePageOptions(query) {
  const page = typeof query.page === "string" ? parseInt(query.page, 10) : 1;
  const pageSize = typeof query.page_size === "string" ? parseInt(query.page_size, 10) : 20;
  return {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    search: typeof query.search === "string" ? query.search : void 0,
    domain: typeof query.domain === "string" ? query.domain : void 0
  };
}
var getTopSourcesController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const topSources = await getTopSources(project_id, parseFilters2(req.query));
    res.status(200).json(topSources);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to retrieve top sources" });
  }
};
var getDomaEUReportController = async (req, res) => {
  try {
    const project_id = await getOwnedProjectId(req, res);
    if (!project_id) return;
    res.status(200).json(await getDomaEUReportPage(project_id, parseFilters2(req.query), parsePageOptions(req.query)));
  } catch (error) {
    handleSourceError(error, res, "Failed to retrieve domain report");
  }
};
var getUrlReportController = async (req, res) => {
  try {
    const project_id = await getOwnedProjectId(req, res);
    if (!project_id) return;
    res.status(200).json(await getUrlReportPage(project_id, parseFilters2(req.query), parsePageOptions(req.query)));
  } catch (error) {
    handleSourceError(error, res, "Failed to retrieve URL report");
  }
};
var getUrlContentController = async (req, res) => {
  try {
    const project_id = await getOwnedProjectId(req, res);
    if (!project_id) return;
    const url = typeof req.query.url === "string" ? req.query.url : null;
    if (!url) {
      res.status(400).json({ error: "url query param is required" });
      return;
    }
    const content = await getUrlContent(project_id, url);
    if (!content) {
      res.status(404).json({ error: "URL content not found" });
      return;
    }
    res.status(200).json(content);
  } catch (error) {
    handleSourceError(error, res, "Failed to retrieve URL content");
  }
};
var getSourceGapsController = async (req, res) => {
  try {
    const project_id = await getOwnedProjectId(req, res);
    if (!project_id) return;
    res.status(200).json(await getSourceGapsPage(project_id, parsePageOptions(req.query)));
  } catch (error) {
    handleSourceError(error, res, "Failed to retrieve source gaps");
  }
};
var getSourceTrendController = async (req, res) => {
  try {
    const project_id = await getOwnedProjectId(req, res);
    if (!project_id) return;
    res.status(200).json(await getSourceTrend(project_id));
  } catch (error) {
    handleSourceError(error, res, "Failed to retrieve source trend");
  }
};
async function getOwnedProjectId(req, res) {
  const { project_id } = req.params;
  if (!project_id || Array.isArray(project_id)) {
    res.status(400).json({ error: "project_id is required" });
    return null;
  }
  await assertProjectAccess(project_id, req.user.id);
  return project_id;
}
function handleSourceError(error, res, fallback) {
  if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.status(500).json({ error: fallback });
}

// src/features/sources/sources_routes.ts
var router4 = (0, import_express4.Router)();
router4.get("/:project_id/top", getTopSourcesController);
router4.get("/:project_id/domains", getDomaEUReportController);
router4.get("/:project_id/urls", getUrlReportController);
router4.get("/:project_id/url-content", getUrlContentController);
router4.get("/:project_id/gaps", getSourceGapsController);
router4.get("/:project_id/trend", getSourceTrendController);
var sources_routes_default = router4;

// src/features/brands/brand_routes.ts
var import_express5 = require("express");

// src/features/brands/brand_service.ts
init_prisma();
init_subscription_service();
function previousPeriodDateWhere2(filters) {
  if (!filters.days) return void 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1e3;
  return {
    gte: new Date(now - filters.days * 2 * dayMs),
    lt: new Date(now - filters.days * dayMs)
  };
}
function splitAllTimeChats2(chats) {
  const sorted = [...chats].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const midpoint = Math.floor(sorted.length / 2);
  return {
    previous: sorted.slice(0, midpoint),
    current: sorted.slice(midpoint)
  };
}
function deltaValue2(current, previous, lowerIsBetter = false) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  return lowerIsBetter ? -diff : diff;
}
async function loadBrandChats(project_id, filters) {
  return prisma_default.chat.findMany({
    where: buildChatWhere(project_id, filters || {}),
    include: { brand_mentions: true }
  });
}
async function loadPreviousBrandChats(project_id, filters, currentChats = []) {
  if (filters?.days) {
    const previousWhere = buildChatWhere(project_id, { ...filters, days: void 0 });
    previousWhere.created_at = previousPeriodDateWhere2(filters);
    return prisma_default.chat.findMany({
      where: previousWhere,
      include: { brand_mentions: true }
    });
  }
  return splitAllTimeChats2(currentChats).previous;
}
function aggregateBrandMap(chats, ownBrand) {
  const totalChats = chats.length;
  const brandMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const seenInChat = /* @__PURE__ */ new Set();
    for (const mention of chat.brand_mentions) {
      const name = sanitizeDiscoveredBrandName(mention.brand_name);
      if (!name) continue;
      if (!isEligibleCompetitorEntity({
        name,
        domain: mention.domain,
        ownBrandName: ownBrand.name,
        ownBrandUrl: ownBrand.url
      })) continue;
      const key = name.toLowerCase();
      if (seenInChat.has(key)) continue;
      seenInChat.add(key);
      const existing = brandMap.get(key) || { name, domain: null, count: 0, totalPosition: 0, totalSentiment: 0, sentimentCount: 0 };
      brandMap.set(key, {
        name: existing.name,
        domain: existing.domain ?? normalizeEntityDomain(mention.domain),
        count: existing.count + 1,
        totalPosition: existing.totalPosition + (mention.position ?? 0),
        totalSentiment: existing.totalSentiment + (mention.sentiment_score ?? 0),
        sentimentCount: existing.sentimentCount + (mention.sentiment_score !== null ? 1 : 0)
      });
    }
  }
  return { totalChats, brandMap };
}
function mentionsForBrand(name, chats) {
  return chats.flatMap((chat) => {
    const matches = chat.brand_mentions.filter((mention) => sameBrandEntity(mention.brand_name, name));
    if (matches.length === 0) return [];
    return [matches.reduce((best, mention) => {
      if (best.position === null) return mention;
      if (mention.position === null) return best;
      return mention.position < best.position ? mention : best;
    })];
  });
}
function brandStats(name, chats) {
  const totalChats = chats.length;
  const mentions = mentionsForBrand(name, chats);
  const sentimentMentions = mentions.filter((m) => m.sentiment_score !== null);
  return {
    visibility: totalChats > 0 ? mentions.length / totalChats * 100 : 0,
    avg_position: mentions.length > 0 ? mentions.reduce((acc, m) => acc + (m.position ?? 0), 0) / mentions.length : null,
    avg_sentiment: sentimentMentions.length > 0 ? sentimentMentions.reduce((acc, m) => acc + (m.sentiment_score ?? 0), 0) / sentimentMentions.length : null,
    mention_count: mentions.length
  };
}
function attachDeltas(row, previous) {
  return {
    ...row,
    delta_visibility: deltaValue2(row.visibility, previous?.visibility ?? null),
    delta_position: deltaValue2(row.avg_position, previous?.avg_position ?? null, true),
    delta_sentiment: deltaValue2(row.avg_sentiment, previous?.avg_sentiment ?? null)
  };
}
async function getDiscoveredBrands(project_id, filters) {
  const [chats, project] = await Promise.all([
    loadBrandChats(project_id, filters),
    prisma_default.project.findUniqueOrThrow({
      where: { id: project_id },
      select: { brand_name: true, brand_url: true }
    })
  ]);
  const totalChats = chats.length;
  if (totalChats === 0) return [];
  const { brandMap } = aggregateBrandMap(chats, { name: project.brand_name, url: project.brand_url });
  const previousChats = await loadPreviousBrandChats(project_id, filters, chats);
  return Array.from(brandMap.values()).map((data) => ({
    brand_name: data.name,
    domain: data.domain,
    visibility: data.count / totalChats * 100,
    avg_position: data.count > 0 ? data.totalPosition / data.count : null,
    avg_sentiment: data.sentimentCount > 0 ? data.totalSentiment / data.sentimentCount : null,
    mention_count: data.count
  })).map((row) => attachDeltas(row, brandStats(row.brand_name, previousChats))).sort((a, b) => b.visibility - a.visibility);
}
async function addCompetitor(input) {
  const { project_id, name, url, user_id } = input;
  const existing = await prisma_default.competitor.findFirst({
    where: { project_id, name }
  });
  if (existing) {
    if (url && existing.url !== url) {
      return prisma_default.competitor.update({ where: { id: existing.id }, data: { url } });
    }
    return existing;
  }
  await assertCanAddCompetitor(user_id);
  return prisma_default.competitor.create({
    data: { project_id, name, url }
  });
}
async function getTrackedCompetitors(project_id, filters) {
  const chats = await loadBrandChats(project_id, filters);
  const totalChats = chats.length;
  const previousChats = await loadPreviousBrandChats(project_id, filters, chats);
  const tracked = await prisma_default.competitor.findMany({
    where: { project_id }
  });
  return tracked.map((competitor) => {
    const allMentions = mentionsForBrand(competitor.name, chats);
    const mentionCount = allMentions.length;
    const sentimentMentions = allMentions.filter((m) => m.sentiment_score !== null);
    const current = {
      id: competitor.id,
      name: competitor.name,
      url: competitor.url,
      visibility: totalChats > 0 ? mentionCount / totalChats * 100 : 0,
      avg_position: mentionCount > 0 ? allMentions.reduce((acc, m) => acc + (m.position ?? 0), 0) / mentionCount : null,
      avg_sentiment: sentimentMentions.length > 0 ? sentimentMentions.reduce((acc, m) => acc + (m.sentiment_score ?? 0), 0) / sentimentMentions.length : null,
      mention_count: mentionCount
    };
    return attachDeltas(current, brandStats(competitor.name, previousChats));
  }).sort((a, b) => b.visibility - a.visibility);
}
async function removeCompetitor(competitor_id) {
  return prisma_default.competitor.delete({
    where: { id: competitor_id }
  });
}

// src/features/brands/brand_controller.ts
init_project_access();
function parseFilters3(query) {
  const filters = {};
  if (query.days) filters.days = parseInt(query.days);
  if (query.model && query.model !== "all") filters.model = query.model;
  if (query.topic && query.topic !== "all") filters.topic = query.topic;
  if (query.prompt_id && query.prompt_id !== "all") filters.prompt_id = query.prompt_id;
  if (query.q) filters.q = query.q;
  return filters;
}
var getDiscoveredBrandsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const brands = await getDiscoveredBrands(project_id, parseFilters3(req.query));
    res.status(200).json(brands);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get discovered brands" });
  }
};
var addCompetitorController = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { name, url } = req.body;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const userId = req.user.id;
    await assertProjectMutationAccess(project_id, userId);
    const competitor = await addCompetitor({ project_id, name, url, user_id: userId });
    res.status(201).json(competitor);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (error instanceof Error && error.message.toLowerCase().includes("competitor")) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to add competitor" });
  }
};
var getTrackedCompetitorsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const competitors = await getTrackedCompetitors(project_id, parseFilters3(req.query));
    res.status(200).json(competitors);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get tracked competitors" });
  }
};
var removeCompetitorController = async (req, res) => {
  try {
    const { competitor_id } = req.params;
    if (!competitor_id || Array.isArray(competitor_id)) {
      res.status(400).json({ error: "competitor_id is required" });
      return;
    }
    await assertCompetitorMutationAccess(competitor_id, req.user.id);
    await removeCompetitor(competitor_id);
    res.status(200).json({ message: "Competitor removed" });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPETITOR_NOT_FOUND") {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    res.status(500).json({ error: "Failed to remove competitor" });
  }
};

// src/features/brands/brand_routes.ts
var router5 = (0, import_express5.Router)();
router5.get("/:project_id/discovered", getDiscoveredBrandsController);
router5.get("/:project_id/tracked", getTrackedCompetitorsController);
router5.post("/:project_id/competitors", addCompetitorController);
router5.delete("/competitors/:competitor_id", removeCompetitorController);
var brand_routes_default = router5;

// src/features/scraping/scraping_routes.ts
var import_express6 = require("express");

// src/features/scraping/scraping_controller.ts
var import_client12 = require("@prisma/client");
init_scrape_orchestration_service();
init_project_access();
init_scrape_engine_policy();
init_project_engines_service();
init_prisma();
init_credits_service();
init_project_engines_service();
init_scrape_gate();
var enqueueProjectRunController = async (req, res) => {
  try {
    if (isScrapingDisabled()) {
      res.status(503).json({ error: "Scraping is temporarily disabled for all projects." });
      return;
    }
    const { project_id, prompt_ids, engines, profile } = req.body;
    if (!project_id) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const userId = req.user.id;
    await assertProjectMutationAccess(project_id, userId);
    const parsedEngines = Array.isArray(engines) ? engines.map((engine) => engine.toUpperCase()).filter((engine) => engine in import_client12.Engine) : void 0;
    if (Array.isArray(engines) && parsedEngines?.length !== engines.length) {
      res.status(400).json({ error: "One or more scrape engines are invalid." });
      return;
    }
    if (parsedEngines?.some((engine) => !isActiveScrapeEngine(engine))) {
      res.status(400).json({ error: "Google AI Overview is no longer a supported scrape engine. Use Google AI Mode instead." });
      return;
    }
    if (parsedEngines?.length) {
      await assertCanUseProjectEngines(userId, parsedEngines);
    }
    const selectedPromptWhere = {
      project_id,
      is_active: true,
      status: "ACTIVE",
      ...Array.isArray(prompt_ids) && prompt_ids.length ? { id: { in: prompt_ids } } : {}
    };
    const prompts = await prisma_default.prompt.findMany({
      where: selectedPromptWhere,
      select: { _count: { select: { geo_variants: { where: { is_active: true } } } } }
    });
    const selectedEngines = parsedEngines?.length ? parsedEngines : await getProjectEngines(project_id);
    const engineCount = selectedEngines.length;
    const requestedJobs = prompts.reduce((total, prompt) => total + 1 + prompt._count.geo_variants, 0) * engineCount;
    await ensureSignupBonusCredits(userId);
    const availableCredits = await getCreditBalance(userId);
    const unitCreditCost = await getPromptRunCreditCost(userId);
    const requiredCredits = requestedJobs * unitCreditCost;
    if (requiredCredits > availableCredits) {
      res.status(402).json({ error: `Not enough credits: this run needs ${requiredCredits}, but your wallet has ${availableCredits}.` });
      return;
    }
    const result = await enqueueProjectRun({
      project_id,
      prompt_ids: Array.isArray(prompt_ids) ? prompt_ids : void 0,
      engines: parsedEngines,
      profile: typeof profile === "string" ? profile : void 0
    });
    res.status(202).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (error instanceof Error && (error.message.includes("Select at least") || error.message.includes("plan can track"))) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("[scraping_controller:enqueueScrapeRun]", error);
    res.status(500).json({ error: "Failed to enqueue scrape run" });
  }
};
var getScrapeRunController = async (req, res) => {
  try {
    const { run_id } = req.params;
    if (!run_id || Array.isArray(run_id)) {
      res.status(400).json({ error: "run_id is required" });
      return;
    }
    const run = await getScrapeRun(run_id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    await assertProjectAccess(run.project_id, req.user.id);
    res.status(200).json(run);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    console.error("[scraping_controller:getScrapeRun]", error);
    res.status(500).json({ error: "Failed to get scrape run" });
  }
};

// src/features/scraping/scrape_retry_controller.ts
init_project_access();

// src/features/scraping/scrape_retry_service.ts
var import_client13 = require("@prisma/client");
init_prisma();
init_scrape_engine_policy();
init_project_engines_service();
init_scrape_gate();
var MAX_MANUAL_SCRAPE_RETRIES = 2;
async function retryFailedJobsForRun(run_id) {
  assertScrapingEnabled();
  const run = await prisma_default.run.findUnique({
    where: { id: run_id },
    select: { id: true, project_id: true }
  });
  if (!run) throw new Error("RUN_NOT_FOUND");
  const failedJobs = await prisma_default.scrapeJob.findMany({
    where: {
      run_id,
      status: import_client13.ScrapeJobStatus.FAILED,
      chat_id: null
    },
    select: {
      id: true,
      engine: true,
      retry_count: true
    },
    orderBy: { created_at: "asc" }
  });
  const selectedEngineSet = new Set(await getProjectEngines(run.project_id));
  const eligibleJobs = failedJobs.filter((job) => isActiveScrapeEngine(job.engine) && selectedEngineSet.has(job.engine) && job.retry_count < MAX_MANUAL_SCRAPE_RETRIES);
  const exhaustedJobs = failedJobs.filter((job) => isActiveScrapeEngine(job.engine) && selectedEngineSet.has(job.engine) && job.retry_count >= MAX_MANUAL_SCRAPE_RETRIES);
  const unsupportedJobs = failedJobs.filter((job) => job.engine === import_client13.Engine.GOOGLE_AI_OVERVIEW);
  if (eligibleJobs.length === 0) {
    return {
      run_id,
      queued: 0,
      exhausted: exhaustedJobs.length,
      unsupported: unsupportedJobs.length,
      jobs: []
    };
  }
  const eligibleIds = eligibleJobs.map((job) => job.id);
  let queuedCount = 0;
  await prisma_default.$transaction(async (tx) => {
    const updated = await tx.scrapeJob.updateMany({
      where: {
        id: { in: eligibleIds },
        run_id,
        status: import_client13.ScrapeJobStatus.FAILED,
        chat_id: null,
        retry_count: { lt: MAX_MANUAL_SCRAPE_RETRIES },
        engine: { in: [...ACTIVE_SCRAPE_ENGINES].filter((engine) => selectedEngineSet.has(engine)) }
      },
      data: {
        status: import_client13.ScrapeJobStatus.QUEUED,
        started_at: null,
        completed_at: null,
        error_reason: null,
        retry_count: { increment: 1 }
      }
    });
    if (updated.count === 0) return;
    queuedCount = updated.count;
    await tx.brightDataBatchItem.deleteMany({
      where: { scrape_job_id: { in: eligibleIds } }
    });
    await tx.run.update({
      where: { id: run_id },
      data: {
        status: import_client13.VisibilityRunStatus.QUEUED,
        completed_at: null,
        error_reason: null
      }
    });
  }, { isolationLevel: "Serializable" });
  const jobs = await prisma_default.scrapeJob.findMany({
    where: {
      id: { in: eligibleIds }
    },
    select: {
      id: true,
      engine: true,
      status: true,
      retry_count: true
    },
    orderBy: { created_at: "asc" }
  });
  return {
    run_id,
    queued: queuedCount,
    exhausted: exhaustedJobs.length,
    unsupported: unsupportedJobs.length,
    jobs
  };
}

// src/features/scraping/scrape_retry_controller.ts
init_prisma();
async function retryFailedJobsController(req, res) {
  try {
    const runId = req.params.run_id;
    if (!runId || Array.isArray(runId)) {
      res.status(400).json({ error: "run_id is required" });
      return;
    }
    const run = await prisma_default.run.findUnique({
      where: { id: runId },
      select: { project_id: true }
    });
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    const userId = req.user.id;
    await assertProjectAccess(run.project_id, userId);
    const result = await retryFailedJobsForRun(runId);
    if (result.queued === 0) {
      res.status(409).json({
        error: result.exhausted > 0 ? "These failed jobs have already used both retry attempts." : "There are no failed jobs eligible for retry.",
        ...result
      });
      return;
    }
    res.status(202).json(result);
  } catch (error) {
    if (error instanceof Error && (error.message === "PROJECT_NOT_FOUND" || error.message === "RUN_NOT_FOUND")) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    console.error("[scrape_retry_controller:retryScrapeJobs]", error);
    res.status(500).json({ error: "Failed to retry scrape jobs" });
  }
}

// src/features/scraping/scraping_routes.ts
var router6 = (0, import_express6.Router)();
router6.post("/runs", enqueueProjectRunController);
router6.get("/runs/:run_id", getScrapeRunController);
router6.post("/runs/:run_id/retry-failed", retryFailedJobsController);
var scraping_routes_default = router6;

// src/features/projects/projects_routes.ts
var import_express7 = require("express");

// src/features/projects/projects_service.ts
init_prisma();
init_agency_access();
async function getUserProjects(user_id) {
  const accessibleIds = await getAccessibleUserIds(user_id);
  const assignedProjectIds = await getAssignedProjectIds(user_id);
  return prisma_default.project.findMany({
    where: {
      OR: [
        { user_id: { in: accessibleIds } },
        { id: { in: assignedProjectIds } }
      ]
    },
    orderBy: { created_at: "asc" },
    include: {
      // Only the latest run (+ its scrape jobs) is used by the client, for the
      // "Today's run" status badge shown for every project on every page. Prompts,
      // competitors and engine preferences used to be embedded here too, but nothing
      // reads them from this endpoint anymore — each tab (Prompts, Competitors,
      // Settings) already fetches its own authoritative copy from its own endpoint.
      // Embedding them here duplicated that data and made this request, which runs
      // on every authenticated page load, needlessly heavy for every accessible project.
      runs: {
        take: 1,
        orderBy: { ran_at: "desc" },
        include: {
          scrape_jobs: {
            select: {
              id: true,
              engine: true,
              status: true,
              prompt_id: true,
              completed_at: true,
              created_at: true,
              error_reason: true,
              retry_count: true,
              chat_id: true,
              geo_country_code: true,
              geo_city: true
            },
            orderBy: { created_at: "asc" }
          }
        }
      }
    }
  });
}

// src/features/projects/projects_controller.ts
var getUserProjectsController = async (req, res) => {
  try {
    const user_id = req.user.id;
    const projects = await getUserProjects(user_id);
    res.status(200).json(projects);
  } catch {
    res.status(500).json({ error: "Failed to retrieve projects" });
  }
};

// src/features/project_engines/project_engines_controller.ts
init_project_engines_service();
init_project_access();
init_project_engine_policy();
init_subscription_service();
async function getProjectEnginesController(req, res) {
  try {
    const projectId = req.params.project_id;
    const userId = req.user.id;
    await assertProjectAccess(projectId, userId);
    const plan = await getUserPlan(userId);
    const engines = await getProjectEngines(projectId);
    const limit = getEngineLimitForPlan(plan);
    res.status(200).json({
      engines,
      selectable: [...SELECTABLE_PROJECT_ENGINES],
      limit,
      plan
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    console.error("[project_engines_controller:load]", error);
    res.status(500).json({ error: "Failed to load AI engines" });
  }
}
async function updateProjectEnginesController(req, res) {
  try {
    const projectId = req.params.project_id;
    const userId = req.user.id;
    const engines = await setProjectEngines(projectId, userId, req.body.engines);
    res.status(200).json({ engines });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Select") || message.includes("plan")) {
      res.status(400).json({ error: message });
      return;
    }
    console.error("[project_engines_controller:update]", error);
    res.status(500).json({ error: "Failed to update AI engines" });
  }
}

// src/features/projects/projects_routes.ts
var router7 = (0, import_express7.Router)();
router7.get("/", getUserProjectsController);
router7.get("/:project_id/engines", getProjectEnginesController);
router7.put("/:project_id/engines", updateProjectEnginesController);
var projects_routes_default = router7;

// src/features/prompts/prompt_routes.ts
var import_express8 = require("express");

// src/features/prompts/prompt_controller.ts
var import_zod4 = require("zod");

// src/features/prompts/prompt_service.ts
init_prisma();

// src/features/prompts/prompt_demand_service.ts
init_prisma();
var DEMAND_WINDOW_DAYS = 30;
function demandLabel(score) {
  if (score === null) return "NOT_ENOUGH_DATA";
  if (score >= 67) return "HIGH";
  if (score >= 34) return "MODERATE";
  return "LOW";
}
async function getObservedPromptDemand(promptIds) {
  if (!promptIds.length) return /* @__PURE__ */ new Map();
  const since = new Date(Date.now() - DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1e3);
  const rows = await prisma_default.chat.groupBy({
    by: ["prompt_id"],
    where: {
      prompt_id: { in: promptIds },
      created_at: { gte: since }
    },
    _count: { _all: true }
  });
  const counts = new Map(rows.map((row) => [row.prompt_id, row._count._all]));
  const maxRuns = Math.max(0, ...counts.values());
  const demand = /* @__PURE__ */ new Map();
  for (const promptId of promptIds) {
    const runs = counts.get(promptId) ?? 0;
    const score = maxRuns > 0 && runs > 0 ? Math.round(Math.log1p(runs) / Math.log1p(maxRuns) * 100) : null;
    demand.set(promptId, {
      runs_30d: runs,
      score,
      label: demandLabel(score)
    });
  }
  return demand;
}

// src/features/prompts/prompt_service.ts
init_countries();
async function getPromptsWithStats(input) {
  const { project_id, status, topic, model: model2, days, country, intent, tag, mentioned, cited } = input;
  const promptWhere = { project_id };
  if (status) promptWhere.status = status;
  if (topic) promptWhere.topic = topic;
  if (intent) promptWhere.type = intent;
  if (tag) promptWhere.tags = { has: tag };
  const prompts = await prisma_default.prompt.findMany({
    where: promptWhere,
    include: {
      chats: {
        where: {
          ...days ? { created_at: { gte: new Date(Date.now() - days * 864e5) } } : {},
          ...model2 ? { ai_model: { contains: model2, mode: "insensitive" } } : {},
          ...country ? { OR: [{ geo_country_code: country }, { geo_country_name: { equals: country, mode: "insensitive" } }] } : {},
          ...typeof mentioned === "boolean" ? { brand_mentioned: mentioned } : {},
          ...cited === true ? { sources: { some: { is_cited: true } } } : {},
          ...cited === false ? { sources: { none: { is_cited: true } } } : {}
        },
        select: {
          ai_model: true,
          brand_mentioned: true,
          brand_position: true,
          sentiment_score: true,
          brand_mentions: {
            select: {
              brand_name: true
            }
          }
        }
      }
    },
    orderBy: { created_at: "desc" }
  });
  const observedDemand = await getObservedPromptDemand(prompts.map((prompt) => prompt.id));
  return prompts.map((prompt) => {
    const chats = prompt.chats;
    const total = chats.length;
    const mentioned2 = chats.filter((c) => c.brand_mentioned).length;
    const visibility = total > 0 ? mentioned2 / total * 100 : null;
    const sentimentChats = chats.filter((c) => c.sentiment_score !== null);
    const avg_sentiment = sentimentChats.length > 0 ? sentimentChats.reduce((acc, c) => acc + (c.sentiment_score ?? 0), 0) / sentimentChats.length : null;
    const positionChats = chats.filter((c) => c.brand_mentioned && c.brand_position !== null);
    const avg_position = positionChats.length > 0 ? positionChats.reduce((acc, c) => acc + (c.brand_position ?? 0), 0) / positionChats.length : null;
    const mentionSet = /* @__PURE__ */ new Map();
    for (const chat of chats) {
      for (const mention of chat.brand_mentions) {
        mentionSet.set(mention.brand_name, (mentionSet.get(mention.brand_name) ?? 0) + 1);
      }
    }
    const mentions = Array.from(mentionSet.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const models = [...new Set(chats.map((c) => c.ai_model))];
    return {
      id: prompt.id,
      text: prompt.text,
      topic: prompt.topic,
      type: prompt.type,
      tags: prompt.tags || [],
      status: prompt.status,
      source: prompt.source,
      priority_score: prompt.priority_score,
      volume_score: prompt.volume_score,
      observed_demand_score: observedDemand.get(prompt.id)?.score ?? null,
      observed_demand_label: observedDemand.get(prompt.id)?.label ?? "NOT_ENOUGH_DATA",
      observed_runs_30d: observedDemand.get(prompt.id)?.runs_30d ?? 0,
      observed_demand_basis: "DeepMention AI runs in the last 30 days",
      last_run_at: prompt.last_run_at,
      created_at: prompt.created_at,
      // stats
      total_chats: total,
      visibility,
      avg_sentiment,
      avg_position,
      mentions,
      models
    };
  });
}
async function activatePrompt(prompt_id) {
  return prisma_default.prompt.update({
    where: { id: prompt_id },
    data: { status: "ACTIVE", is_active: true }
  });
}
async function deactivatePrompt(prompt_id) {
  return prisma_default.prompt.update({
    where: { id: prompt_id },
    data: { status: "INACTIVE", is_active: false }
  });
}
async function getPromptTopics(project_id) {
  const [savedTopics, prompts] = await Promise.all([
    prisma_default.topic.findMany({
      where: { project_id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        created_at: true,
        updated_at: true
      }
    }),
    prisma_default.prompt.findMany({
      where: { project_id },
      select: { topic: true }
    })
  ]);
  const savedNames = new Set(savedTopics.map((topic) => topic.name.toLowerCase()));
  const promptOnlyTopics = [...new Set(prompts.map((p) => p.topic.trim()).filter(Boolean))].filter((name) => !savedNames.has(name.toLowerCase())).map((name) => ({
    id: `prompt-topic:${name}`,
    name,
    created_at: /* @__PURE__ */ new Date(0),
    updated_at: /* @__PURE__ */ new Date(0)
  }));
  return [...savedTopics, ...promptOnlyTopics].sort((a, b) => a.name.localeCompare(b.name));
}
async function getPromptStats(project_id) {
  const counts = await prisma_default.prompt.groupBy({
    by: ["status"],
    where: { project_id },
    _count: { _all: true }
  });
  const total = await prisma_default.prompt.count({ where: { project_id } });
  const byStatus = {};
  for (const row of counts) {
    byStatus[row.status] = row._count._all;
  }
  return { total, byStatus };
}
async function createTopic(input) {
  const { name, project_id } = input;
  const normalizedName = name.trim().replace(/\s+/g, " ");
  return prisma_default.topic.upsert({
    where: {
      project_id_name: {
        project_id,
        name: normalizedName
      }
    },
    create: {
      name: normalizedName,
      project_id
    },
    update: {},
    select: {
      id: true,
      name: true,
      created_at: true,
      updated_at: true
    }
  });
}
async function createPrompt(input) {
  const normalizedText = input.text.trim().replace(/\s+/g, " ");
  const normalizedTopic = input.topic.trim().replace(/\s+/g, " ");
  const isGeo = !!(input.country_code && input.country_name);
  const prompt = await prisma_default.prompt.create({
    data: {
      text: normalizedText,
      topic: normalizedTopic,
      type: "customer_prompt",
      project_id: input.project_id,
      status: "ACTIVE",
      source: "CUSTOMER",
      geo_enabled: isGeo,
      ...isGeo ? {
        geo_variants: {
          create: {
            country_code: input.country_code.toUpperCase(),
            country_name: input.country_name,
            is_active: true
          }
        }
      } : {}
    },
    select: {
      id: true,
      text: true,
      topic: true,
      type: true,
      tags: true,
      status: true,
      source: true,
      priority_score: true,
      volume_score: true,
      last_run_at: true,
      created_at: true
    }
  });
  return prompt;
}
async function getGeoVariantsForPrompt(prompt_id) {
  return prisma_default.geoPromptVariant.findMany({
    where: { prompt_id },
    orderBy: [{ country_code: "asc" }, { city: "asc" }]
  });
}
async function addGeoVariant(input) {
  const { prompt_id, country_code, country_name, city } = input;
  const normalizedCity = city?.trim() || "";
  await prisma_default.prompt.update({
    where: { id: prompt_id },
    data: { geo_enabled: true }
  });
  return prisma_default.geoPromptVariant.upsert({
    where: {
      prompt_id_country_code_city: {
        prompt_id,
        country_code: country_code.toUpperCase(),
        city: normalizedCity
      }
    },
    create: {
      prompt_id,
      country_code: country_code.toUpperCase(),
      country_name,
      city: normalizedCity,
      is_active: true
    },
    update: { is_active: true, country_name }
  });
}
async function removeGeoVariant(variant_id) {
  return prisma_default.geoPromptVariant.delete({ where: { id: variant_id } });
}
async function toggleGeoVariant(variant_id, is_active) {
  return prisma_default.geoPromptVariant.update({
    where: { id: variant_id },
    data: { is_active }
  });
}
async function getGeoVisibilityStats(project_id, days) {
  const dateFilter = days ? { created_at: { gte: new Date(Date.now() - days * 864e5) } } : {};
  const chats = await prisma_default.chat.findMany({
    where: {
      run: { project_id },
      geo_country_code: { not: null },
      ...dateFilter
    },
    select: {
      geo_country_code: true,
      geo_country_name: true,
      geo_city: true,
      brand_mentioned: true,
      sentiment_score: true,
      brand_position: true
    }
  });
  const grouped = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const key = `${chat.geo_country_code}::${chat.geo_city ?? ""}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(chat);
  }
  const rows = [];
  for (const [, group] of grouped) {
    const first = group[0];
    const total = group.length;
    const mentioned = group.filter((c) => c.brand_mentioned).length;
    const sentimentChats = group.filter((c) => c.sentiment_score !== null);
    const positionChats = group.filter((c) => c.brand_mentioned && c.brand_position !== null);
    rows.push({
      country_code: first.geo_country_code,
      country_name: first.geo_country_name ?? first.geo_country_code,
      city: first.geo_city,
      visibility: total > 0 ? Math.round(mentioned / total * 100) : null,
      avg_sentiment: sentimentChats.length > 0 ? sentimentChats.reduce((acc, c) => acc + (c.sentiment_score ?? 0), 0) / sentimentChats.length : null,
      avg_position: positionChats.length > 0 ? positionChats.reduce((acc, c) => acc + (c.brand_position ?? 0), 0) / positionChats.length : null,
      chat_count: total
    });
  }
  return rows.sort((a, b) => (b.visibility ?? 0) - (a.visibility ?? 0));
}

// src/features/prompts/prompt_discovery_service.ts
init_prisma();
function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function titleCase(value) {
  return value.trim().replace(/\s+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function clean(value) {
  return value.trim().replace(/\s+/g, " ");
}
function clampScore(value) {
  return Math.max(10, Math.min(100, Math.round(value)));
}
function safeStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").map(clean).filter(Boolean) : [];
}
function cityFromLocation(location) {
  const cleaned = clean(location);
  if (!cleaned) return "";
  return cleaned.split(",")[0]?.trim() || cleaned;
}
function hasAny(text, words) {
  const normalized = normalize(text);
  return words.some((word) => normalized.includes(normalize(word)));
}
function industryKind(industry, brandName, keywords) {
  const haystack = `${industry} ${brandName} ${keywords.join(" ")}`.toLowerCase();
  if (hasAny(haystack, ["hospital", "clinic", "healthcare", "doctor", "medical", "multispeciality", "speciality", "specialty"])) return "healthcare";
  if (hasAny(haystack, ["real estate", "property", "realtor", "builder", "apartment", "villa"])) return "real_estate";
  if (hasAny(haystack, ["law", "legal", "lawyer", "attorney", "advocate"])) return "legal";
  if (hasAny(haystack, ["school", "college", "university", "education", "course", "academy"])) return "education";
  if (hasAny(haystack, ["hotel", "resort", "restaurant", "cafe", "travel"])) return "hospitality";
  return "general";
}
function addCandidate(candidates, input) {
  const text = clean(input.text).replace(/\?+$/, "?");
  if (text.length < 16) return;
  candidates.push({
    text,
    topic: input.topic,
    type: input.type,
    intent: input.intent,
    funnel: input.funnel,
    frequency: input.frequency,
    tags: [
      "discovery:prompt_intelligence",
      `intent:${input.intent}`,
      `funnel:${input.funnel.toLowerCase()}`,
      `frequency:${input.frequency}`,
      ...input.tags ?? []
    ],
    priority_score: clampScore(input.score),
    volume_score: input.volume ?? null
  });
}
function defaultHealthcareServices(keywords) {
  const weakServices = /* @__PURE__ */ new Set([
    "hospital",
    "hospitals",
    "clinic",
    "clinics",
    "healthcare",
    "health care",
    "medical",
    "doctor",
    "doctors",
    "multispeciality",
    "multi speciality",
    "multi specialty",
    "speciality",
    "specialty"
  ]);
  const known = [
    "cardiology",
    "orthopedics",
    "maternity",
    "gynecology",
    "pediatrics",
    "neurology",
    "gastroenterology",
    "urology",
    "oncology",
    "general surgery",
    "emergency care",
    "ICU",
    "diagnostics"
  ];
  const merged = [...keywords, ...known];
  return [...new Set(merged.map((item) => clean(item)).filter(Boolean))].filter((item) => !weakServices.has(item.toLowerCase())).filter((item) => item.length <= 40).slice(0, 14);
}
function genericServices(ctx) {
  const fromKeywords = ctx.keywords.filter((item) => item.length <= 50);
  const fromTopics = ctx.existingTopics.filter((item) => !["No topic", "Category Research"].includes(item)).slice(0, 8);
  const fallback = ["service provider", "solution", "company", "agency"];
  return [...new Set([...fromKeywords, ...fromTopics, ...fallback].map(clean).filter(Boolean))].slice(0, 10);
}
function buildHealthcareCandidates(ctx) {
  const candidates = [];
  const city = cityFromLocation(ctx.location);
  const location = city || ctx.location || "near me";
  const services = defaultHealthcareServices(ctx.keywords);
  const competitors = [.../* @__PURE__ */ new Set([...ctx.evidenceCompetitors, ...ctx.competitors])].slice(0, 4);
  const evidenceTags = [
    ctx.evidenceSources.length ? "source:citation_patterns" : "source:project_context",
    ctx.evidenceTopics.length ? "source:existing_runs" : "source:industry_playbook",
    "industry:healthcare"
  ];
  addCandidate(candidates, {
    text: `Which is the best multispeciality hospital in ${location}?`,
    topic: "Local Hospital Discovery",
    type: "local_buyer_recommendation",
    intent: "best_recommendation",
    funnel: "HIGH",
    frequency: "daily",
    score: 96,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `Which hospital in ${location} is best for emergency care at night?`,
    topic: "Emergency Care",
    type: "urgent_care_decision",
    intent: "emergency",
    funnel: "HIGH",
    frequency: "daily",
    score: 95,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `Which hospital in ${location} has good ICU and critical care facilities?`,
    topic: "Emergency Care",
    type: "critical_care_decision",
    intent: "emergency",
    funnel: "HIGH",
    frequency: "daily",
    score: 92,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `Which hospital in ${location} has good doctors and patient reviews?`,
    topic: "Trust & Reviews",
    type: "trust_review_decision",
    intent: "trust_reviews",
    funnel: "HIGH",
    frequency: "daily",
    score: 90,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `Which hospital in ${location} accepts cashless insurance for surgery?`,
    topic: "Insurance & Cost",
    type: "insurance_decision",
    intent: "insurance_payment",
    funnel: "HIGH",
    frequency: "daily",
    score: 88,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `Which hospital in ${location} is affordable but reliable for family treatment?`,
    topic: "Insurance & Cost",
    type: "cost_value_decision",
    intent: "pricing_cost",
    funnel: "HIGH",
    frequency: "daily",
    score: 86,
    tags: evidenceTags
  });
  for (const service of services.slice(0, 10)) {
    const readable = service.toLowerCase();
    const topic = titleCase(service);
    const highValue = hasAny(readable, ["cardiology", "orthopedic", "maternity", "surgery", "emergency", "icu", "oncology"]);
    addCandidate(candidates, {
      text: `Best hospital for ${readable} in ${location}?`,
      topic,
      type: "service_specific_decision",
      intent: "service_specific",
      funnel: "HIGH",
      frequency: highValue ? "daily" : "weekly",
      score: highValue ? 92 : 82,
      tags: [...evidenceTags, `service:${normalize(service).replace(/\s+/g, "_")}`]
    });
    addCandidate(candidates, {
      text: `Which ${readable} hospital in ${location} has experienced doctors?`,
      topic,
      type: "doctor_trust_decision",
      intent: "trust_reviews",
      funnel: "HIGH",
      frequency: highValue ? "daily" : "weekly",
      score: highValue ? 89 : 78,
      tags: [...evidenceTags, `service:${normalize(service).replace(/\s+/g, "_")}`]
    });
  }
  const symptomPrompts = [
    ["chest pain", "cardiology"],
    ["severe stomach pain", "gastroenterology"],
    ["pregnancy delivery", "maternity"],
    ["knee pain or joint pain", "orthopedics"],
    ["child fever at night", "pediatrics"]
  ];
  for (const [problem, topic] of symptomPrompts) {
    addCandidate(candidates, {
      text: `My family member has ${problem}; which hospital in ${location} should I choose?`,
      topic: titleCase(topic),
      type: "problem_led_decision",
      intent: "problem_led",
      funnel: "HIGH",
      frequency: "daily",
      score: 91,
      tags: [...evidenceTags, `problem:${normalize(problem).replace(/\s+/g, "_")}`]
    });
  }
  for (const competitor of competitors.slice(0, 3)) {
    addCandidate(candidates, {
      text: `${ctx.brandName} vs ${competitor}: which hospital is better in ${location}?`,
      topic: "Competitor Comparison",
      type: "competitor_comparison",
      intent: "comparison",
      funnel: "HIGH",
      frequency: "daily",
      score: 94,
      tags: [...evidenceTags, `competitor:${competitor}`]
    });
    addCandidate(candidates, {
      text: `What are the best alternatives to ${competitor} hospital in ${location}?`,
      topic: "Competitor Comparison",
      type: "alternatives",
      intent: "alternatives",
      funnel: "HIGH",
      frequency: "weekly",
      score: 86,
      tags: [...evidenceTags, `competitor:${competitor}`]
    });
  }
  if (ctx.evidenceSources.length) {
    addCandidate(candidates, {
      text: `Which sources does AI trust when recommending hospitals in ${location}?`,
      topic: "Source Influence",
      type: "source_influence",
      intent: "source_influence",
      funnel: "MEDIUM",
      frequency: "weekly",
      score: 78,
      tags: [...evidenceTags, ...ctx.evidenceSources.slice(0, 3).map((domain) => `source_domain:${domain}`)]
    });
  }
  return candidates;
}
function buildGeneralCandidates(ctx) {
  const candidates = [];
  const city = cityFromLocation(ctx.location);
  const location = city || ctx.location;
  const services = genericServices(ctx);
  const competitors = [.../* @__PURE__ */ new Set([...ctx.evidenceCompetitors, ...ctx.competitors])].slice(0, 4);
  const evidenceTags = [
    ctx.evidenceSources.length ? "source:citation_patterns" : "source:project_context",
    ctx.evidenceTopics.length ? "source:existing_runs" : "source:industry_playbook",
    `industry:${normalize(ctx.industry || "general").replace(/\s+/g, "_")}`
  ];
  const localSuffix = location ? ` in ${location}` : "";
  addCandidate(candidates, {
    text: `Which ${ctx.industry || "company"} should I choose${localSuffix}?`,
    topic: "Buyer Shortlist",
    type: "buyer_shortlist",
    intent: "best_recommendation",
    funnel: "HIGH",
    frequency: "daily",
    score: 90,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `What are the best ${ctx.industry || "services"}${localSuffix}?`,
    topic: "Best Recommendations",
    type: "category_discovery",
    intent: "best_recommendation",
    funnel: "HIGH",
    frequency: "daily",
    score: 88,
    tags: evidenceTags
  });
  addCandidate(candidates, {
    text: `Which ${ctx.industry || "provider"} has the best reviews and proof${localSuffix}?`,
    topic: "Trust & Reviews",
    type: "trust_review_decision",
    intent: "trust_reviews",
    funnel: "HIGH",
    frequency: "weekly",
    score: 84,
    tags: evidenceTags
  });
  for (const service of services.slice(0, 8)) {
    addCandidate(candidates, {
      text: `Best ${service.toLowerCase()} provider${localSuffix}?`,
      topic: titleCase(service),
      type: "service_specific_decision",
      intent: "service_specific",
      funnel: "HIGH",
      frequency: "weekly",
      score: 84,
      tags: [...evidenceTags, `service:${normalize(service).replace(/\s+/g, "_")}`]
    });
    addCandidate(candidates, {
      text: `How do I choose a reliable ${service.toLowerCase()} provider${localSuffix}?`,
      topic: titleCase(service),
      type: "decision_support",
      intent: "problem_led",
      funnel: "MEDIUM",
      frequency: "weekly",
      score: 72,
      tags: [...evidenceTags, `service:${normalize(service).replace(/\s+/g, "_")}`]
    });
  }
  for (const competitor of competitors.slice(0, 3)) {
    addCandidate(candidates, {
      text: `${ctx.brandName} vs ${competitor}: which is better?`,
      topic: "Competitor Comparison",
      type: "competitor_comparison",
      intent: "comparison",
      funnel: "HIGH",
      frequency: "daily",
      score: 92,
      tags: [...evidenceTags, `competitor:${competitor}`]
    });
    addCandidate(candidates, {
      text: `What are the best alternatives to ${competitor}?`,
      topic: "Competitor Comparison",
      type: "alternatives",
      intent: "alternatives",
      funnel: "HIGH",
      frequency: "weekly",
      score: 86,
      tags: [...evidenceTags, `competitor:${competitor}`]
    });
  }
  if (ctx.evidenceSources.length) {
    addCandidate(candidates, {
      text: `Which sources do AI assistants trust for ${ctx.industry || "this category"} recommendations?`,
      topic: "Source Influence",
      type: "source_influence",
      intent: "source_influence",
      funnel: "MEDIUM",
      frequency: "weekly",
      score: 76,
      tags: [...evidenceTags, ...ctx.evidenceSources.slice(0, 3).map((domain) => `source_domain:${domain}`)]
    });
  }
  return candidates;
}
function qualityPenalty(candidate, ctx) {
  let penalty = 0;
  const text = normalize(candidate.text);
  if (text.split(" ").length < 5) penalty += 20;
  if (candidate.funnel === "LOW") penalty += 8;
  if (ctx.location && ["local", "service_specific", "emergency", "best_recommendation"].includes(candidate.intent) && !text.includes(normalize(cityFromLocation(ctx.location)))) {
    penalty += 8;
  }
  for (const avoid of ctx.avoidKeywords) {
    if (avoid && text.includes(normalize(avoid))) penalty += 30;
  }
  if (/^what is\b/.test(text) && !text.includes("which")) penalty += 18;
  return penalty;
}
function dedupeByIntent(candidates, existingTexts, ctx) {
  const seen = /* @__PURE__ */ new Set();
  const sorted = candidates.map((candidate) => ({
    ...candidate,
    priority_score: clampScore(candidate.priority_score - qualityPenalty(candidate, ctx))
  })).filter((candidate) => candidate.priority_score >= 50).filter((candidate) => !existingTexts.has(normalize(candidate.text))).sort((a, b) => b.priority_score - a.priority_score);
  const result = [];
  const bucketCount = /* @__PURE__ */ new Map();
  for (const candidate of sorted) {
    const key = normalize(candidate.text);
    if (!key || seen.has(key)) continue;
    const intentCount = bucketCount.get(candidate.intent) ?? 0;
    if (intentCount >= 8) continue;
    seen.add(key);
    bucketCount.set(candidate.intent, intentCount + 1);
    result.push(candidate);
  }
  return result;
}
async function buildContext(project_id) {
  const project = await prisma_default.project.findUniqueOrThrow({
    where: { id: project_id },
    include: {
      competitors: true,
      brand_preference: true,
      prompts: {
        select: {
          text: true,
          topic: true
        }
      }
    }
  });
  const chats = await prisma_default.chat.findMany({
    where: { run: { project_id } },
    include: {
      prompt: { select: { topic: true, text: true } },
      brand_mentions: { select: { brand_name: true } },
      sources: { select: { domain: true, is_cited: true } }
    },
    orderBy: { created_at: "desc" },
    take: 250
  });
  const evidenceTopics = [...new Set(chats.map((chat) => titleCase(chat.prompt.topic)).filter(Boolean))];
  const competitorCounts = /* @__PURE__ */ new Map();
  const sourceCounts = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const mention of chat.brand_mentions) {
      const name = clean(mention.brand_name);
      if (!name || name.toLowerCase() === project.brand_name.toLowerCase()) continue;
      competitorCounts.set(name, (competitorCounts.get(name) ?? 0) + 1);
    }
    for (const source of chat.sources) {
      if (!source.domain) continue;
      sourceCounts.set(source.domain, (sourceCounts.get(source.domain) ?? 0) + (source.is_cited ? 2 : 1));
    }
  }
  return {
    brandName: project.brand_name,
    brandUrl: project.brand_url,
    location: project.brand_location,
    industry: project.brand_preference?.industry_category ?? "Business",
    buyerPersona: project.brand_preference?.buyer_persona ?? null,
    keywords: safeStringArray(project.brand_preference?.keywords),
    avoidKeywords: safeStringArray(project.brand_preference?.avoid_keywords),
    competitors: project.competitors.map((competitor) => competitor.name).filter(Boolean),
    existingTopics: [...new Set(project.prompts.map((prompt) => titleCase(prompt.topic)).filter(Boolean))],
    existingPromptTexts: project.prompts.map((prompt) => prompt.text),
    evidenceTopics,
    evidenceCompetitors: [...competitorCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 5),
    evidenceSources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([domain]) => domain).slice(0, 5)
  };
}
async function discoverPromptCandidates(project_id, options = {}) {
  const ctx = await buildContext(project_id);
  const existingTexts = new Set(ctx.existingPromptTexts.map(normalize));
  const kind = industryKind(ctx.industry, ctx.brandName, ctx.keywords);
  const generated = kind === "healthcare" ? buildHealthcareCandidates(ctx) : buildGeneralCandidates(ctx);
  const deduped = dedupeByIntent(generated, existingTexts, ctx).slice(0, Math.max(1, Math.min(60, options.limit ?? 30)));
  let created = 0;
  let skipped = Math.max(0, generated.length - deduped.length);
  for (const candidate of deduped) {
    const existing = await prisma_default.prompt.findFirst({
      where: {
        project_id,
        text: { equals: candidate.text, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma_default.topic.upsert({
      where: {
        project_id_name: {
          project_id,
          name: candidate.topic
        }
      },
      create: {
        project_id,
        name: candidate.topic
      },
      update: {}
    });
    await prisma_default.prompt.create({
      data: {
        project_id,
        text: candidate.text,
        topic: candidate.topic,
        type: candidate.type,
        status: "SUGGESTED",
        source: "GENERATED",
        tags: options.runTag ? [...candidate.tags, options.runTag] : candidate.tags,
        priority_score: candidate.priority_score,
        volume_score: candidate.volume_score,
        is_active: false
      }
    });
    created += 1;
  }
  const industryLabel = kind === "healthcare" ? "healthcare/local buyer" : "buyer-intent";
  return {
    created,
    skipped,
    total_candidates: deduped.length,
    message: created ? `Found ${created} ${industryLabel} prompt suggestions with intent, funnel, and tracking frequency.` : "No new strong prompt suggestions found. Your current set already covers the discovered high-value intents."
  };
}

// src/features/prompts/prompt_controller.ts
init_project_access();
init_subscription_service();
init_prisma();
var createTopicSchema = import_zod4.z.object({
  name: import_zod4.z.string().trim().min(2, "Topic name must be at least 2 characters").max(80, "Topic name is too long")
});
var createPromptSchema = import_zod4.z.object({
  text: import_zod4.z.string().trim().min(8, "Prompt must be at least 8 characters").max(500, "Prompt is too long"),
  topic: import_zod4.z.string().trim().min(2, "Topic is required").max(80, "Topic is too long"),
  country_code: import_zod4.z.string().trim().optional(),
  country_name: import_zod4.z.string().trim().optional()
});
function readRouteParam(value) {
  return typeof value === "string" && value ? value : null;
}
var getPromptsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertProjectAccess(project_id, user_id);
    const status = req.query.status;
    const topic = req.query.topic;
    const model2 = req.query.model;
    const days = req.query.days ? parseInt(req.query.days) : void 0;
    const country = req.query.country;
    const intent = req.query.intent;
    const tag = req.query.tag;
    const mentioned = req.query.mentioned === "true" || req.query.mentioned === "false" ? req.query.mentioned === "true" : void 0;
    const cited = req.query.cited === "true" || req.query.cited === "false" ? req.query.cited === "true" : void 0;
    const prompts = await getPromptsWithStats({ project_id, status, topic, model: model2, days, country, intent, tag, mentioned, cited });
    res.status(200).json(prompts);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get prompts" });
  }
};
var getPromptTopicsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertProjectAccess(project_id, user_id);
    const topics = await getPromptTopics(project_id);
    res.status(200).json({ topics });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get prompt topics" });
  }
};
var createTopicController = async (req, res) => {
  const parsed = createTopicSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError3 = Object.values(fieldErrors).flat().find(Boolean);
    res.status(400).json({
      success: false,
      error: firstError3 ?? "Invalid topic payload",
      errors: fieldErrors
    });
    return;
  }
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectMutationAccess(project_id, req.user.id);
    const topic = await createTopic({
      project_id,
      name: parsed.data.name
    });
    res.status(201).json({ success: true, topic });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to create topic" });
  }
};
var createPromptController = async (req, res) => {
  const parsed = createPromptSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError3 = Object.values(fieldErrors).flat().find(Boolean);
    res.status(400).json({
      success: false,
      error: firstError3 ?? "Invalid prompt payload",
      errors: fieldErrors
    });
    return;
  }
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const user = req.user;
    const project = await assertProjectMutationAccess(project_id, user.id);
    const topics = await getPromptTopics(project_id);
    const topicExists = topics.some((topic) => topic.name.toLowerCase() === parsed.data.topic.trim().toLowerCase());
    if (!topicExists) {
      res.status(400).json({ success: false, error: "Please select an existing topic" });
      return;
    }
    await assertCanCreatePrompts(user.id, 1);
    let country_code = parsed.data.country_code;
    let country_name = parsed.data.country_name;
    if (!country_code && user.account_type === "AGENCY") {
      const matchedCountry = getGeoCountryByName(project.brand_location);
      if (matchedCountry) {
        country_code = matchedCountry.code;
        country_name = matchedCountry.name;
      } else {
        country_code = "US";
        country_name = "United States";
      }
    }
    const prompt = await createPrompt({
      project_id,
      text: parsed.data.text,
      topic: parsed.data.topic,
      country_code,
      country_name
    });
    res.status(201).json({ success: true, prompt });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (error instanceof Error && error.message.includes("plan")) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to create prompt" });
  }
};
var getPromptStatsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const stats = await getPromptStats(project_id);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get prompt stats" });
  }
};
var discoverPromptsController = async (req, res) => {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectMutationAccess(project_id, req.user.id);
    const result = await discoverPromptCandidates(project_id);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to discover prompt suggestions" });
  }
};
var activatePromptController = async (req, res) => {
  try {
    const { prompt_id } = req.params;
    if (!prompt_id || Array.isArray(prompt_id)) {
      res.status(400).json({ error: "prompt_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertPromptMutationAccess(prompt_id, user_id);
    const currentPrompt = await prisma_default.prompt.findUnique({
      where: { id: prompt_id },
      select: { status: true, is_active: true }
    });
    if (!currentPrompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    if (currentPrompt.status !== "ACTIVE" || !currentPrompt.is_active) {
      await assertCanCreatePrompts(user_id, 1);
    }
    const prompt = await activatePrompt(prompt_id);
    res.status(200).json(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("plan") || message.includes("remaining")) {
      res.status(400).json({ error: message });
      return;
    }
    console.error("[prompt_controller:activatePrompt]", error);
    res.status(500).json({ error: "Failed to activate prompt" });
  }
};
var deactivatePromptController = async (req, res) => {
  try {
    const { prompt_id } = req.params;
    if (!prompt_id || Array.isArray(prompt_id)) {
      res.status(400).json({ error: "prompt_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertPromptMutationAccess(prompt_id, user_id);
    const prompt = await deactivatePrompt(prompt_id);
    res.status(200).json(prompt);
  } catch (error) {
    res.status(500).json({ error: "Failed to deactivate prompt" });
  }
};
var listGeoCountriesController = async (_req, res) => {
  res.json({ countries: GEO_COUNTRIES });
};
var listGeoVariantsController = async (req, res) => {
  try {
    const prompt_id = readRouteParam(req.params.prompt_id);
    if (!prompt_id) {
      res.status(400).json({ error: "prompt_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertPromptAccess(prompt_id, user_id);
    const variants = await getGeoVariantsForPrompt(prompt_id);
    res.json({ variants });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch geo variants" });
  }
};
var addGeoVariantController = async (req, res) => {
  const { country_code, country_name, city } = req.body;
  if (!country_code || !country_name) {
    res.status(400).json({ error: "country_code and country_name are required" });
    return;
  }
  try {
    const prompt_id = readRouteParam(req.params.prompt_id);
    if (!prompt_id) {
      res.status(400).json({ error: "prompt_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertPromptMutationAccess(prompt_id, user_id);
    const variant = await addGeoVariant({
      prompt_id,
      country_code,
      country_name,
      city
    });
    res.status(201).json({ variant });
  } catch (error) {
    if (error?.code === "P2002") {
      res.status(409).json({ error: "This location is already tracked for this prompt" });
      return;
    }
    res.status(500).json({ error: "Failed to add geo variant" });
  }
};
var deleteGeoVariantController = async (req, res) => {
  try {
    const variant_id = readRouteParam(req.params.variant_id);
    if (!variant_id) {
      res.status(400).json({ error: "variant_id is required" });
      return;
    }
    const variant = await prisma_default.promptGeoVariant.findUnique({ where: { id: variant_id } });
    if (!variant) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }
    await assertPromptMutationAccess(variant.prompt_id, req.user.id);
    await removeGeoVariant(variant_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete geo variant" });
  }
};
var toggleGeoVariantController = async (req, res) => {
  const { is_active } = req.body;
  try {
    const variant_id = readRouteParam(req.params.variant_id);
    if (!variant_id) {
      res.status(400).json({ error: "variant_id is required" });
      return;
    }
    const existingVariant = await prisma_default.promptGeoVariant.findUnique({ where: { id: variant_id } });
    if (!existingVariant) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }
    await assertPromptMutationAccess(existingVariant.prompt_id, req.user.id);
    const variant = await toggleGeoVariant(variant_id, is_active);
    res.json({ variant });
  } catch (error) {
    res.status(500).json({ error: "Failed to update geo variant" });
  }
};
var getGeoStatsController = async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : void 0;
  try {
    const project_id = readRouteParam(req.params.project_id);
    if (!project_id) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const stats = await getGeoVisibilityStats(project_id, days);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch geo stats" });
  }
};

// src/features/prompts/prompt_routes.ts
var router8 = (0, import_express8.Router)();
router8.post("/:prompt_id/activate", activatePromptController);
router8.post("/:prompt_id/deactivate", deactivatePromptController);
router8.get("/geo/countries", listGeoCountriesController);
router8.get("/:prompt_id/geo", listGeoVariantsController);
router8.post("/:prompt_id/geo", addGeoVariantController);
router8.delete("/geo/variants/:variant_id", deleteGeoVariantController);
router8.patch("/geo/variants/:variant_id/toggle", toggleGeoVariantController);
router8.get("/:project_id/geo-stats", getGeoStatsController);
router8.post("/:project_id/discovery/run", discoverPromptsController);
router8.get("/:project_id/stats", getPromptStatsController);
router8.get("/:project_id/topics", getPromptTopicsController);
router8.post("/:project_id/topics", createTopicController);
router8.post("/:project_id", createPromptController);
router8.get("/:project_id", getPromptsController);
var prompt_routes_default = router8;

// src/features/webanalytics/webanalytics_routes.ts
var import_express9 = require("express");

// src/middleware/auth.ts
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"), 1);
init_prisma();
async function requireAuth(req, res, next) {
  const header2 = req.headers.authorization;
  const bearerToken = header2?.startsWith("Bearer ") ? header2.slice("Bearer ".length).trim() : "";
  const cookieToken = readAccessTokenCookie(req);
  const candidates = [bearerToken, cookieToken].filter((value) => Boolean(value));
  if (candidates.length === 0) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }
  try {
    let payload = null;
    for (const candidate of candidates) {
      try {
        payload = import_jsonwebtoken3.default.verify(candidate, process.env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
        if (payload?.sub) break;
        payload = null;
      } catch {
        payload = null;
      }
    }
    if (!payload?.sub) {
      res.status(401).json({ error: "Invalid authorization token" });
      return;
    }
    const user = await prisma_default.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, is_verified: true, account_type: true }
    });
    if (!user) {
      res.status(401).json({ error: "Invalid user" });
      return;
    }
    if (!user.is_verified) {
      res.status(403).json({ error: "Please verify your email before continuing" });
      return;
    }
    ;
    req.user = { id: user.id, role: user.role, account_type: user.account_type };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired authorization token" });
  }
}
async function requireAdmin(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await prisma_default.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });
    if (!user) {
      res.status(401).json({ error: "Invalid user" });
      return;
    }
    if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    ;
    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify admin access" });
  }
}

// src/features/webanalytics/webanalytics_controller.ts
init_project_access();

// src/features/webanalytics/webanalytics_types.ts
var import_zod5 = require("zod");
var createSiteSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(1).max(120),
  domain: import_zod5.z.string().min(3).max(255)
});
var updateSiteSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(1).max(120).optional(),
  domain: import_zod5.z.string().min(3).max(255).optional(),
  is_active: import_zod5.z.boolean().optional()
});
var collectEventSchema = import_zod5.z.object({
  public_key: import_zod5.z.string().min(10),
  visitor_id: import_zod5.z.string().min(6).max(128).optional(),
  type: import_zod5.z.enum(["PAGE_VIEW", "CUSTOM"]).default("PAGE_VIEW"),
  path: import_zod5.z.string().min(1).max(2048),
  url: import_zod5.z.string().max(4096).optional(),
  title: import_zod5.z.string().max(500).optional(),
  referrer: import_zod5.z.string().max(4096).optional(),
  source: import_zod5.z.string().max(255).optional(),
  language: import_zod5.z.string().min(2).max(12).optional(),
  screen_width: import_zod5.z.number().int().nonnegative().max(1e5).optional(),
  screen_height: import_zod5.z.number().int().nonnegative().max(1e5).optional(),
  screen_color_depth: import_zod5.z.number().int().nonnegative().max(64).optional(),
  browser_width: import_zod5.z.number().int().nonnegative().max(1e5).optional(),
  browser_height: import_zod5.z.number().int().nonnegative().max(1e5).optional(),
  event_name: import_zod5.z.string().max(120).optional(),
  event_value: import_zod5.z.unknown().optional(),
  duration_ms: import_zod5.z.number().int().nonnegative().optional(),
  metadata: import_zod5.z.record(import_zod5.z.string(), import_zod5.z.unknown()).optional()
});
var createCustomEventSchema = import_zod5.z.object({
  title: import_zod5.z.string().min(1).max(160),
  type: import_zod5.z.enum(["TOTAL_CHART", "AVERAGE_CHART", "TOTAL_LIST", "AVERAGE_LIST"]).default("TOTAL_CHART"),
  key: import_zod5.z.string().max(120).optional()
});
var updateCustomEventSchema = createCustomEventSchema.partial();
var collectActionSchema = import_zod5.z.object({
  public_key: import_zod5.z.string().min(10),
  event_id: import_zod5.z.string().min(1),
  visitor_id: import_zod5.z.string().min(6).max(128).optional(),
  key: import_zod5.z.string().max(160).optional(),
  value: import_zod5.z.number().default(1),
  details: import_zod5.z.string().max(1e3).optional()
});

// src/features/webanalytics/webanalytics_service.ts
var import_crypto3 = __toESM(require("crypto"), 1);
init_prisma();
var ACTIVE_VISITOR_WINDOW_MS = 5 * 60 * 1e3;
function parseAnalyticsRange(daysInput) {
  const days = Math.min(Math.max(Number(daysInput ?? 30) || 30, 1), 365);
  const now = /* @__PURE__ */ new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);
  return { from, to, days };
}
async function createAnalyticsSite(project_id, input) {
  return prisma_default.webAnalyticsSite.create({
    data: {
      project_id,
      name: input.name.trim(),
      domain: normalizeDomain2(input.domain),
      public_key: createPublicKey()
    }
  });
}
async function listAnalyticsSites(project_id) {
  return prisma_default.webAnalyticsSite.findMany({
    where: { project_id },
    orderBy: { created_at: "desc" },
    select: siteSelect
  });
}
async function updateAnalyticsSite(project_id, site_id, input) {
  await assertSiteAccess(project_id, site_id);
  return prisma_default.webAnalyticsSite.update({
    where: { id: site_id },
    data: {
      name: input.name?.trim(),
      domain: input.domain ? normalizeDomain2(input.domain) : void 0,
      is_active: input.is_active
    },
    select: siteSelect
  });
}
async function deleteAnalyticsSite(project_id, site_id) {
  await assertSiteAccess(project_id, site_id);
  await prisma_default.$transaction([
    prisma_default.webAnalyticsAction.deleteMany({ where: { custom_event: { site_id } } }),
    prisma_default.webAnalyticsCustomEvent.deleteMany({ where: { site_id } }),
    prisma_default.webAnalyticsEvent.deleteMany({ where: { site_id } }),
    prisma_default.webAnalyticsSession.deleteMany({ where: { site_id } }),
    prisma_default.webAnalyticsSite.delete({ where: { id: site_id } })
  ]);
  return { ok: true };
}
async function regenerateAnalyticsSiteKey(project_id, site_id) {
  await assertSiteAccess(project_id, site_id);
  return prisma_default.webAnalyticsSite.update({
    where: { id: site_id },
    data: { public_key: createPublicKey() },
    select: siteSelect
  });
}
async function collectAnalyticsEvent(input, requestMeta2) {
  const site = await getActiveSiteByPublicKey(input.public_key);
  const session = await upsertAnalyticsSession(site.id, input, requestMeta2);
  const event = await prisma_default.webAnalyticsEvent.create({
    data: {
      site_id: site.id,
      session_id: session.id,
      type: input.type,
      path: normalizePath(input.path),
      url: input.url,
      title: input.title,
      referrer: input.referrer ?? null,
      event_name: input.type === "CUSTOM" ? input.event_name : void 0,
      event_value: toPrismaJson(input.event_value),
      duration_ms: input.duration_ms,
      metadata: toPrismaJson(input.metadata)
    }
  });
  return { ok: true, site_id: site.id, session_id: session.id, event_id: event.id };
}
async function collectAnalyticsAction(input, requestMeta2) {
  const site = await getActiveSiteByPublicKey(input.public_key);
  const customEvent = await prisma_default.webAnalyticsCustomEvent.findFirst({
    where: { id: input.event_id, site_id: site.id }
  });
  if (!customEvent) throw new Error("CUSTOM_EVENT_NOT_FOUND");
  const session = await upsertAnalyticsSession(site.id, {
    visitor_id: input.visitor_id,
    type: "CUSTOM",
    path: "/"
  }, requestMeta2);
  const action = await prisma_default.webAnalyticsAction.create({
    data: {
      custom_event_id: customEvent.id,
      session_id: session.id,
      key: input.key,
      value: input.value,
      details: input.details
    }
  });
  return { ok: true, action_id: action.id, event_id: customEvent.id, session_id: session.id };
}
async function getAnalyticsFacts(project_id, range) {
  const siteIds = await getProjectSiteIds(project_id);
  if (siteIds.length === 0) return emptyFacts(range);
  const now = /* @__PURE__ */ new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_VISITOR_WINDOW_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const [activeVisitors, viewsToday, viewsMonth, viewsYear, rangeEvents, durationAgg] = await Promise.all([
    prisma_default.webAnalyticsSession.count({
      where: { site_id: { in: siteIds }, last_seen_at: { gte: activeSince } }
    }),
    countPageViews(siteIds, todayStart, now),
    countPageViews(siteIds, monthStart, now),
    countPageViews(siteIds, yearStart, now),
    prisma_default.webAnalyticsEvent.findMany({
      where: { site_id: { in: siteIds }, type: "PAGE_VIEW", created_at: { gte: range.from, lte: range.to } },
      select: { session_id: true, created_at: true }
    }),
    prisma_default.webAnalyticsEvent.aggregate({
      where: { site_id: { in: siteIds }, duration_ms: { not: null }, created_at: { gte: range.from, lte: range.to } },
      _avg: { duration_ms: true }
    })
  ]);
  const dailyViews = createDayBuckets(range);
  for (const event of rangeEvents) {
    const bucket = dailyViews.find((item) => item.date === dayKey(event.created_at));
    if (bucket) bucket.page_views += 1;
  }
  return {
    range,
    active_visitors: activeVisitors,
    views_today: viewsToday,
    views_month: viewsMonth,
    views_year: viewsYear,
    average_daily_views: Math.round(dailyViews.reduce((sum, item) => sum + item.page_views, 0) / Math.max(range.days, 1)),
    average_duration_ms: Math.round(durationAgg._avg.duration_ms ?? 0),
    bounce_rate: calculateBounceRate(rangeEvents)
  };
}
async function getAnalyticsSummary(project_id, range) {
  const [facts, timeseries] = await Promise.all([
    getAnalyticsFacts(project_id, range),
    getAnalyticsTimeseries(project_id, range)
  ]);
  const previousFromDate = previousFrom(range);
  const siteIds = await getProjectSiteIds(project_id);
  const previousPageViews = siteIds.length === 0 ? 0 : await countPageViews(siteIds, previousFromDate, range.from);
  const pageViews = timeseries.reduce((sum, item) => sum + item.page_views, 0);
  const visitors = timeseries.reduce((sum, item) => sum + item.visitors, 0);
  return {
    range,
    page_views: pageViews,
    visitors,
    bounce_rate: facts.bounce_rate,
    average_duration_ms: facts.average_duration_ms,
    active_visitors: facts.active_visitors,
    previous_page_views: previousPageViews,
    page_views_delta_pct: previousPageViews === 0 ? null : Math.round((pageViews - previousPageViews) / previousPageViews * 100)
  };
}
async function getAnalyticsTimeseries(project_id, range) {
  const siteIds = await getProjectSiteIds(project_id);
  const buckets = createDayBuckets(range);
  if (siteIds.length === 0) return buckets;
  const events = await prisma_default.webAnalyticsEvent.findMany({
    where: { site_id: { in: siteIds }, type: "PAGE_VIEW", created_at: { gte: range.from, lte: range.to } },
    select: { created_at: true, session: { select: { visitor_id: true } } }
  });
  const byDay = new Map(buckets.map((b) => [b.date, { page_views: 0, visitors: /* @__PURE__ */ new Set() }]));
  for (const event of events) {
    const bucket = byDay.get(dayKey(event.created_at));
    if (!bucket) continue;
    bucket.page_views += 1;
    if (event.session?.visitor_id) bucket.visitors.add(event.session.visitor_id);
  }
  return buckets.map((bucket) => {
    const found = byDay.get(bucket.date);
    return { date: bucket.date, page_views: found?.page_views ?? 0, visitors: found?.visitors.size ?? 0 };
  });
}
async function getAnalyticsPages(project_id, range) {
  return getAnalyticsBreakdown(project_id, range, "pages");
}
async function getAnalyticsReferrers(project_id, range) {
  return getAnalyticsBreakdown(project_id, range, "referrers");
}
async function getAnalyticsBreakdown(project_id, range, dimension, limit = 25) {
  const siteIds = await getProjectSiteIds(project_id);
  if (siteIds.length === 0) return [];
  if (["browsers", "devices", "systems", "languages", "screens"].includes(dimension)) {
    return getSessionBreakdown(siteIds, range, dimension, limit);
  }
  const events = await prisma_default.webAnalyticsEvent.findMany({
    where: { site_id: { in: siteIds }, type: "PAGE_VIEW", created_at: { gte: range.from, lte: range.to } },
    select: { path: true, referrer: true, session_id: true }
  });
  const values = /* @__PURE__ */ new Map();
  for (const event of events) {
    const key = dimension === "referrers" ? safeHostname(event.referrer ?? "") ?? "Direct" : event.path;
    const row = values.get(key) ?? { count: 0, sessions: /* @__PURE__ */ new Set() };
    row.count += 1;
    if (event.session_id) row.sessions.add(event.session_id);
    values.set(key, row);
  }
  return [...values.entries()].map(([name, row]) => ({ name, count: row.count, sessions: row.sessions.size })).sort((a, b) => b.count - a.count).slice(0, limit);
}
async function getAnalyticsDurations(project_id, range) {
  const siteIds = await getProjectSiteIds(project_id);
  const buckets = createDayBuckets(range).map((item) => ({ ...item, average_duration_ms: 0, samples: 0 }));
  if (siteIds.length === 0) return buckets;
  const events = await prisma_default.webAnalyticsEvent.findMany({
    where: { site_id: { in: siteIds }, duration_ms: { not: null }, created_at: { gte: range.from, lte: range.to } },
    select: { created_at: true, duration_ms: true }
  });
  for (const event of events) {
    const bucket = buckets.find((item) => item.date === dayKey(event.created_at));
    if (!bucket || event.duration_ms == null) continue;
    bucket.average_duration_ms += event.duration_ms;
    bucket.samples += 1;
  }
  return buckets.map((bucket) => ({
    date: bucket.date,
    average_duration_ms: bucket.samples === 0 ? 0 : Math.round(bucket.average_duration_ms / bucket.samples),
    samples: bucket.samples
  }));
}
async function getAnalyticsEvents(project_id, range) {
  const siteIds = await getProjectSiteIds(project_id);
  if (siteIds.length === 0) return [];
  return prisma_default.webAnalyticsEvent.findMany({
    where: { site_id: { in: siteIds }, created_at: { gte: range.from, lte: range.to } },
    orderBy: { created_at: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      path: true,
      title: true,
      referrer: true,
      event_name: true,
      event_value: true,
      duration_ms: true,
      metadata: true,
      created_at: true
    }
  });
}
async function createCustomEvent(project_id, site_id, input) {
  await assertSiteAccess(project_id, site_id);
  return prisma_default.webAnalyticsCustomEvent.create({
    data: {
      site_id,
      title: input.title.trim(),
      type: input.type,
      key: input.key?.trim()
    }
  });
}
async function listCustomEvents(project_id, site_id) {
  await assertSiteAccess(project_id, site_id);
  return prisma_default.webAnalyticsCustomEvent.findMany({
    where: { site_id },
    orderBy: { created_at: "desc" },
    include: { _count: { select: { actions: true } } }
  });
}
async function updateCustomEvent(project_id, site_id, event_id, input) {
  await assertCustomEventAccess(project_id, site_id, event_id);
  return prisma_default.webAnalyticsCustomEvent.update({
    where: { id: event_id },
    data: {
      title: input.title?.trim(),
      type: input.type,
      key: input.key?.trim()
    }
  });
}
async function deleteCustomEvent(project_id, site_id, event_id) {
  await assertCustomEventAccess(project_id, site_id, event_id);
  await prisma_default.$transaction([
    prisma_default.webAnalyticsAction.deleteMany({ where: { custom_event_id: event_id } }),
    prisma_default.webAnalyticsCustomEvent.delete({ where: { id: event_id } })
  ]);
  return { ok: true };
}
async function getCustomEventStats(project_id, site_id, event_id, range) {
  const customEvent = await assertCustomEventAccess(project_id, site_id, event_id);
  const actions = await prisma_default.webAnalyticsAction.findMany({
    where: { custom_event_id: event_id, created_at: { gte: range.from, lte: range.to } },
    select: { key: true, value: true, created_at: true }
  });
  const buckets = createDayBuckets(range).map((item) => ({ date: item.date, value: 0, count: 0 }));
  const list = /* @__PURE__ */ new Map();
  for (const action of actions) {
    const bucket = buckets.find((item) => item.date === dayKey(action.created_at));
    if (bucket) {
      bucket.value += action.value;
      bucket.count += 1;
    }
    const key = action.key ?? "Action";
    const row = list.get(key) ?? { value: 0, count: 0 };
    row.value += action.value;
    row.count += 1;
    list.set(key, row);
  }
  const isAverage = customEvent.type === "AVERAGE_CHART" || customEvent.type === "AVERAGE_LIST";
  return {
    event: customEvent,
    total_actions: actions.length,
    chart: buckets.map((bucket) => ({
      date: bucket.date,
      value: isAverage && bucket.count > 0 ? Number((bucket.value / bucket.count).toFixed(2)) : bucket.value,
      count: bucket.count
    })),
    list: [...list.entries()].map(([key, row]) => ({
      key,
      value: isAverage && row.count > 0 ? Number((row.value / row.count).toFixed(2)) : row.value,
      count: row.count
    })).sort((a, b) => b.count - a.count)
  };
}
function getTrackerScript() {
  return `(() => {
  const script = document.currentScript;
  const key = script && script.getAttribute("data-promptpulse-key");
  const endpoint = (script && script.getAttribute("data-promptpulse-endpoint")) || "/api/webanalytics";
  if (!key) return;

  const visitorKey = "promptpulse_visitor";
  const visitor = sessionStorage.getItem(visitorKey) || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  sessionStorage.setItem(visitorKey, visitor);

  const startedAt = Date.now();
  const payload = () => ({
    public_key: key,
    visitor_id: visitor,
    path: location.pathname + location.search,
    url: location.href,
    title: document.title,
    referrer: document.referrer || undefined,
    language: navigator.language,
    screen_width: screen.width,
    screen_height: screen.height,
    screen_color_depth: screen.colorDepth,
    browser_width: window.innerWidth,
    browser_height: window.innerHeight
  });

  const send = (path, body) => {
    const data = JSON.stringify(body);
    fetch(endpoint + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: data, keepalive: true }).catch(() => {});
  };

  send("/collect", payload());
  window.promptpulseAction = (eventId, data = {}) => send("/actions", { public_key: key, visitor_id: visitor, event_id: eventId, ...data });
  let lastPath = location.pathname + location.search;
  const trackRoute = () => {
    const nextPath = location.pathname + location.search;
    if (nextPath === lastPath) return;
    lastPath = nextPath;
    send("/collect", payload());
  };
  const pushState = history.pushState;
  const replaceState = history.replaceState;
  history.pushState = function () {
    pushState.apply(this, arguments);
    setTimeout(trackRoute, 0);
  };
  history.replaceState = function () {
    replaceState.apply(this, arguments);
    setTimeout(trackRoute, 0);
  };
  window.addEventListener("popstate", trackRoute);
  window.addEventListener("pagehide", () => send("/collect", { ...payload(), type: "CUSTOM", event_name: "duration", duration_ms: Date.now() - startedAt }));
})();`;
}
async function getProjectSiteIds(project_id) {
  const sites = await prisma_default.webAnalyticsSite.findMany({ where: { project_id }, select: { id: true } });
  return sites.map((site) => site.id);
}
async function assertSiteAccess(project_id, site_id) {
  const site = await prisma_default.webAnalyticsSite.findFirst({ where: { id: site_id, project_id } });
  if (!site) throw new Error("SITE_NOT_FOUND");
  return site;
}
async function assertCustomEventAccess(project_id, site_id, event_id) {
  await assertSiteAccess(project_id, site_id);
  const event = await prisma_default.webAnalyticsCustomEvent.findFirst({ where: { id: event_id, site_id } });
  if (!event) throw new Error("CUSTOM_EVENT_NOT_FOUND");
  return event;
}
async function getActiveSiteByPublicKey(public_key) {
  const site = await prisma_default.webAnalyticsSite.findUnique({ where: { public_key } });
  if (!site || !site.is_active) throw new Error("SITE_NOT_FOUND");
  return site;
}
async function upsertAnalyticsSession(site_id, input, requestMeta2) {
  const now = /* @__PURE__ */ new Date();
  const referrer = input.referrer ?? null;
  const source = input.source ?? (referrer ? safeHostname(referrer) ?? void 0 : void 0);
  const visitor_id = createVisitorId(site_id, input.visitor_id, requestMeta2);
  const userAgent = requestMeta2.userAgent;
  return prisma_default.webAnalyticsSession.upsert({
    where: { site_id_visitor_id: { site_id, visitor_id } },
    create: {
      site_id,
      visitor_id,
      ip_hash: hashIp(requestMeta2.ip),
      user_agent: userAgent,
      browser: detectBrowser(userAgent),
      browser_version: detectBrowserVersion(userAgent),
      browser_width: input.browser_width,
      browser_height: input.browser_height,
      os: detectOs(userAgent),
      os_version: detectOsVersion(userAgent),
      device: detectDevice(userAgent),
      language: input.language?.slice(0, 12),
      screen_width: input.screen_width,
      screen_height: input.screen_height,
      screen_color_depth: input.screen_color_depth,
      referrer,
      source,
      medium: source ? "referral" : "direct",
      landing_page: normalizePath(input.path),
      started_at: now,
      last_seen_at: now
    },
    update: {
      last_seen_at: now,
      referrer: referrer ?? void 0,
      source,
      medium: source ? "referral" : void 0,
      browser_width: input.browser_width,
      browser_height: input.browser_height
    }
  });
}
async function countPageViews(siteIds, from, to) {
  return prisma_default.webAnalyticsEvent.count({
    where: { site_id: { in: siteIds }, type: "PAGE_VIEW", created_at: { gte: from, lt: to } }
  });
}
async function getSessionBreakdown(siteIds, range, dimension, limit) {
  const sessions = await prisma_default.webAnalyticsSession.findMany({
    where: { site_id: { in: siteIds }, started_at: { gte: range.from, lte: range.to } },
    select: {
      browser: true,
      device: true,
      os: true,
      language: true,
      screen_width: true,
      screen_height: true
    }
  });
  const values = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    const name = sessionBreakdownName(session, dimension);
    values.set(name, (values.get(name) ?? 0) + 1);
  }
  return [...values.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
function sessionBreakdownName(session, dimension) {
  if (dimension === "browsers") return session.browser ?? "Other";
  if (dimension === "devices") return session.device ?? "Other";
  if (dimension === "systems") return session.os ?? "Other";
  if (dimension === "languages") return session.language ?? "Unknown";
  if (dimension === "screens") return session.screen_width && session.screen_height ? `${session.screen_width}x${session.screen_height}` : "Unknown";
  return "Unknown";
}
function createPublicKey() {
  return `wa_${import_crypto3.default.randomBytes(18).toString("hex")}`;
}
function createVisitorId(siteId, visitorId, meta) {
  const raw = visitorId ?? `${meta.ip ?? "0.0.0.0"}:${meta.userAgent ?? "unknown"}`;
  const daySalt = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return import_crypto3.default.createHash("sha256").update(`${siteId}:${raw}:${daySalt}:${process.env.JWT_SECRET ?? "local"}`).digest("hex");
}
function normalizeDomain2(domain) {
  const trimmed = domain.trim().toLowerCase();
  return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}
function normalizePath(path2) {
  return path2.startsWith("/") ? path2 : `/${path2}`;
}
function hashIp(ip) {
  if (!ip) return null;
  const daySalt = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return import_crypto3.default.createHash("sha256").update(`${ip}:${daySalt}:${process.env.JWT_SECRET ?? "local"}`).digest("hex");
}
function safeHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function detectBrowser(ua = "") {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "Other";
}
function detectBrowserVersion(ua = "") {
  const match = ua.match(/(?:Edg|Chrome|Firefox|Version)\/([\d.]+)/i);
  return match?.[1];
}
function detectOs(ua = "") {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}
function detectOsVersion(ua = "") {
  const match = ua.match(/(?:Windows NT|Android|OS|Mac OS X)\s?([\d_\.]+)/i);
  return match?.[1]?.replace(/_/g, ".");
}
function detectDevice(ua = "") {
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile";
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}
function emptyFacts(range) {
  return {
    range,
    active_visitors: 0,
    views_today: 0,
    views_month: 0,
    views_year: 0,
    average_daily_views: 0,
    average_duration_ms: 0,
    bounce_rate: 0
  };
}
function previousFrom(range) {
  const from = new Date(range.from);
  from.setDate(from.getDate() - range.days);
  return from;
}
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
function createDayBuckets(range) {
  return Array.from({ length: range.days }, (_, index) => {
    const date = new Date(range.from);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: dayKey(date), page_views: 0, visitors: 0 };
  });
}
function calculateBounceRate(events) {
  if (events.length === 0) return 0;
  const counts = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (!event.session_id) continue;
    counts.set(event.session_id, (counts.get(event.session_id) ?? 0) + 1);
  }
  const bounced = [...counts.values()].filter((count) => count === 1).length;
  return Math.round(bounced / Math.max(counts.size, 1) * 100);
}
function toPrismaJson(value) {
  if (value === void 0) return void 0;
  return value;
}
var siteSelect = {
  id: true,
  name: true,
  domain: true,
  public_key: true,
  is_active: true,
  created_at: true,
  updated_at: true
};

// src/features/webanalytics/webanalytics_controller.ts
async function createAnalyticsSiteController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(201).json(await createAnalyticsSite(project_id, createSiteSchema.parse(req.body)));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to create analytics site");
  }
}
async function listAnalyticsSitesController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await listAnalyticsSites(project_id));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to list analytics sites");
  }
}
async function updateAnalyticsSiteController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await updateAnalyticsSite(project_id, routeParam(req, "site_id"), updateSiteSchema.parse(req.body)));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to update analytics site");
  }
}
async function deleteAnalyticsSiteController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await deleteAnalyticsSite(project_id, routeParam(req, "site_id")));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to delete analytics site");
  }
}
async function regenerateAnalyticsSiteKeyController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await regenerateAnalyticsSiteKey(project_id, routeParam(req, "site_id")));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to regenerate analytics site key");
  }
}
async function collectAnalyticsEventController(req, res) {
  try {
    const result = await collectAnalyticsEvent(collectEventSchema.parse(req.body), requestMeta(req));
    res.status(202).json(result);
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to collect analytics event");
  }
}
async function collectAnalyticsActionController(req, res) {
  try {
    const result = await collectAnalyticsAction(collectActionSchema.parse(req.body), requestMeta(req));
    res.status(202).json(result);
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to collect analytics action");
  }
}
async function getTrackerScriptController(_req, res) {
  res.type("application/javascript").send(getTrackerScript());
}
async function getAnalyticsSummaryController(req, res) {
  await report(req, res, getAnalyticsSummary, "Failed to retrieve analytics summary");
}
async function getAnalyticsFactsController(req, res) {
  await report(req, res, getAnalyticsFacts, "Failed to retrieve analytics facts");
}
async function getAnalyticsTimeseriesController(req, res) {
  await report(req, res, getAnalyticsTimeseries, "Failed to retrieve analytics timeseries");
}
async function getAnalyticsPagesController(req, res) {
  await report(req, res, getAnalyticsPages, "Failed to retrieve analytics pages");
}
async function getAnalyticsReferrersController(req, res) {
  await report(req, res, getAnalyticsReferrers, "Failed to retrieve analytics referrers");
}
async function getAnalyticsDurationsController(req, res) {
  await report(req, res, getAnalyticsDurations, "Failed to retrieve analytics durations");
}
async function getAnalyticsBreakdownController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await getAnalyticsBreakdown(
      project_id,
      parseAnalyticsRange(req.query.days),
      routeParam(req, "dimension"),
      Number(req.query.limit ?? 25)
    ));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to retrieve analytics breakdown");
  }
}
async function getAnalyticsEventsController(req, res) {
  await report(req, res, getAnalyticsEvents, "Failed to retrieve analytics events");
}
async function createCustomEventController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(201).json(await createCustomEvent(project_id, routeParam(req, "site_id"), createCustomEventSchema.parse(req.body)));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to create custom event");
  }
}
async function listCustomEventsController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await listCustomEvents(project_id, routeParam(req, "site_id")));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to list custom events");
  }
}
async function updateCustomEventController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await updateCustomEvent(project_id, routeParam(req, "site_id"), routeParam(req, "event_id"), updateCustomEventSchema.parse(req.body)));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to update custom event");
  }
}
async function deleteCustomEventController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await deleteCustomEvent(project_id, routeParam(req, "site_id"), routeParam(req, "event_id")));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to delete custom event");
  }
}
async function getCustomEventStatsController(req, res) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await getCustomEventStats(project_id, routeParam(req, "site_id"), routeParam(req, "event_id"), parseAnalyticsRange(req.query.days)));
  } catch (error) {
    handleWebAnalyticsError(error, res, "Failed to retrieve custom event stats");
  }
}
async function report(req, res, fn, fallback) {
  try {
    const project_id = await getOwnedProjectId2(req, res);
    if (!project_id) return;
    res.status(200).json(await fn(project_id, parseAnalyticsRange(req.query.days)));
  } catch (error) {
    handleWebAnalyticsError(error, res, fallback);
  }
}
async function getOwnedProjectId2(req, res) {
  const { project_id } = req.params;
  if (!project_id || Array.isArray(project_id)) {
    res.status(400).json({ error: "project_id is required" });
    return null;
  }
  await assertProjectAccess(project_id, req.user.id);
  return project_id;
}
function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get("user-agent") ?? void 0 };
}
function routeParam(req, name) {
  const value = req.params[name];
  if (!value || Array.isArray(value)) throw new Error("INVALID_ROUTE_PARAM");
  return value;
}
function handleWebAnalyticsError(error, res, fallback) {
  if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") return void res.status(404).json({ error: "Project not found" });
  if (error instanceof Error && error.message === "SITE_NOT_FOUND") return void res.status(404).json({ error: "Analytics site not found" });
  if (error instanceof Error && error.message === "CUSTOM_EVENT_NOT_FOUND") return void res.status(404).json({ error: "Custom analytics event not found" });
  if (error instanceof Error && error.message === "INVALID_ROUTE_PARAM") return void res.status(400).json({ error: "Invalid route parameter" });
  if (error && typeof error === "object" && "issues" in error) {
    return void res.status(400).json({ error: "Invalid request body", details: error.issues });
  }
  res.status(500).json({ error: fallback });
}

// src/features/webanalytics/webanalytics_routes.ts
var router9 = (0, import_express9.Router)();
router9.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
router9.get("/tracker.js", getTrackerScriptController);
router9.post("/collect", collectAnalyticsEventController);
router9.post("/actions", collectAnalyticsActionController);
router9.get("/:project_id/sites", requireAuth, listAnalyticsSitesController);
router9.post("/:project_id/sites", requireAuth, createAnalyticsSiteController);
router9.patch("/:project_id/sites/:site_id", requireAuth, updateAnalyticsSiteController);
router9.delete("/:project_id/sites/:site_id", requireAuth, deleteAnalyticsSiteController);
router9.post("/:project_id/sites/:site_id/regenerate-key", requireAuth, regenerateAnalyticsSiteKeyController);
router9.get("/:project_id/summary", requireAuth, getAnalyticsSummaryController);
router9.get("/:project_id/facts", requireAuth, getAnalyticsFactsController);
router9.get("/:project_id/timeseries", requireAuth, getAnalyticsTimeseriesController);
router9.get("/:project_id/pages", requireAuth, getAnalyticsPagesController);
router9.get("/:project_id/referrers", requireAuth, getAnalyticsReferrersController);
router9.get("/:project_id/durations", requireAuth, getAnalyticsDurationsController);
router9.get("/:project_id/breakdowns/:dimension", requireAuth, getAnalyticsBreakdownController);
router9.get("/:project_id/events", requireAuth, getAnalyticsEventsController);
router9.get("/:project_id/sites/:site_id/custom-events", requireAuth, listCustomEventsController);
router9.post("/:project_id/sites/:site_id/custom-events", requireAuth, createCustomEventController);
router9.patch("/:project_id/sites/:site_id/custom-events/:event_id", requireAuth, updateCustomEventController);
router9.delete("/:project_id/sites/:site_id/custom-events/:event_id", requireAuth, deleteCustomEventController);
router9.get("/:project_id/sites/:site_id/custom-events/:event_id/stats", requireAuth, getCustomEventStatsController);
var webanalytics_routes_default = router9;

// src/features/subscription/subscription_routes.ts
var import_express10 = require("express");

// src/features/subscription/subscription_controller.ts
init_subscription_service();

// src/features/subscription/stripe_webhook_service.ts
init_prisma();

// src/features/subscription/billing_invoice_service.ts
init_prisma();

// src/features/subscription/billing_email_service.ts
var import_axios7 = __toESM(require("axios"), 1);
init_email_service();
function money(amount, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
}
async function invoiceAttachment(url, invoiceNumber) {
  if (!url) return void 0;
  try {
    const response = await import_axios7.default.get(url, { responseType: "arraybuffer", timeout: 15e3 });
    return [{ name: `${invoiceNumber ?? "promptpulse-invoice"}.pdf`, content: Buffer.from(response.data) }];
  } catch (error) {
    console.warn("Stripe invoice PDF attachment download failed; sending hosted link instead", error);
    return void 0;
  }
}
async function sendPaidInvoiceEmail(input) {
  const title = input.isFirstPayment ? `Welcome to DeepMention ${input.plan}` : "Your DeepMention payment was received";
  const attachment = await invoiceAttachment(input.invoicePdfUrl, input.invoiceNumber);
  return sendEmail({
    to: input.to,
    subject: input.isFirstPayment ? `Welcome to DeepMention ${input.plan} - payment confirmed` : "DeepMention payment receipt",
    text: `${title}. We received ${money(input.amountPaid, input.currency)}. ${input.hostedInvoiceUrl ?? ""}`,
    attachments: attachment,
    html: `
          <div style="background:#f5f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#101828">
            <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e4e7ec;border-radius:18px;overflow:hidden">
              <div style="background:#0b1220;padding:26px 30px;color:#fff"><div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#86efac">DeepMention</div><h1 style="margin:10px 0 0;font-size:26px">${title}</h1></div>
              <div style="padding:28px 30px"><p style="margin:0 0 20px;color:#475467;line-height:1.6">Thank you for choosing DeepMention. Your ${input.plan.toLowerCase()} plan is active and ready for your AI visibility workflow.</p>
                <div style="background:#f8fafc;border:1px solid #eaecf0;border-radius:12px;padding:18px"><div style="font-size:12px;color:#667085">Amount paid</div><div style="font-size:24px;font-weight:700;margin-top:4px">${money(input.amountPaid, input.currency)}</div><div style="font-size:13px;color:#667085;margin-top:8px">${input.interval === "annual" ? "Annual billing" : "Monthly billing"}${input.invoiceNumber ? ` \xB7 Invoice ${input.invoiceNumber}` : ""}</div></div>
                ${input.hostedInvoiceUrl ? `<p style="margin:22px 0 0"><a href="${input.hostedInvoiceUrl}" style="display:inline-block;background:#101828;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">View invoice</a></p>` : ""}
                <p style="margin:22px 0 0;color:#667085;font-size:13px;line-height:1.5">${attachment ? "A PDF copy of your Stripe invoice is attached." : "Use the invoice link above to view or download your Stripe invoice."}</p>
              </div>
            </div>
          </div>`
  });
}
async function sendPaymentFailedEmail(input) {
  return sendEmail({
    to: input.to,
    subject: "Action needed: DeepMention payment failed",
    text: "We could not process your DeepMention payment. Please update your payment method.",
    html: `<div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;background:white;border:1px solid #fecaca;border-radius:16px;padding:28px"><h1 style="margin:0;color:#991b1b">Payment needs attention</h1><p style="color:#475569;line-height:1.6">We could not process the latest payment for your ${input.plan} plan. Your data remains safe. Please update your payment method to keep scheduled monitoring active.</p>${input.hostedInvoiceUrl ? `<a href="${input.hostedInvoiceUrl}" style="display:inline-block;background:#101828;color:white;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Review payment</a>` : ""}</div></div>`
  });
}

// src/features/subscription/billing_invoice_service.ts
init_stripe_config();
init_credits_service();
function getInvoiceSubscriptionId(invoice) {
  const value = invoice;
  return getStripeId(value.subscription ?? value.parent?.subscription_details?.subscription);
}
function asDate(value) {
  return value ? new Date(value * 1e3) : null;
}
async function persistStripeInvoice(invoice) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  const localSubscription = stripeSubscriptionId ? await prisma_default.subscription.findUnique({
    where: { stripe_subscription_id: stripeSubscriptionId },
    select: { id: true, user_id: true, plan: true, billing_interval: true }
  }) : null;
  if (!localSubscription) throw new Error(`No DeepMention subscription found for Stripe invoice ${invoice.id}`);
  const record = await prisma_default.billingInvoice.upsert({
    where: { stripe_invoice_id: invoice.id },
    create: {
      user_id: localSubscription.user_id,
      subscription_id: localSubscription.id,
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: stripeSubscriptionId,
      invoice_number: invoice.number,
      status: invoice.status ?? "unknown",
      billing_reason: invoice.billing_reason,
      currency: invoice.currency,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      period_start: asDate(invoice.period_start),
      period_end: asDate(invoice.period_end),
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      paid_at: invoice.status_transitions?.paid_at ? asDate(invoice.status_transitions.paid_at) : null
    },
    update: {
      subscription_id: localSubscription.id,
      status: invoice.status ?? "unknown",
      invoice_number: invoice.number,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      paid_at: invoice.status_transitions?.paid_at ? asDate(invoice.status_transitions.paid_at) : null
    }
  });
  return { record, subscription: localSubscription };
}
async function processPaidInvoice(invoice) {
  const { record, subscription } = await persistStripeInvoice(invoice);
  if (invoice.amount_paid > 0 && subscription.billing_interval === "monthly" && invoice.billing_reason === "subscription_cycle") {
    await grantSubscriptionCredits(subscription.id, `stripe-invoice:${invoice.id}`, /* @__PURE__ */ new Date());
  }
  if (record.payment_email_sent_at || invoice.amount_paid <= 0) return record;
  const user = await prisma_default.user.findUniqueOrThrow({ where: { id: subscription.user_id }, select: { email: true } });
  try {
    const response = await sendPaidInvoiceEmail({
      to: user.email,
      plan: subscription.plan,
      interval: subscription.billing_interval,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      invoiceNumber: invoice.number,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      isFirstPayment: invoice.billing_reason === "subscription_create"
    });
    return prisma_default.billingInvoice.update({
      where: { id: record.id },
      data: { payment_email_sent_at: /* @__PURE__ */ new Date(), payment_email_message_id: response.messageId ?? null, email_error: null }
    });
  } catch (error) {
    await prisma_default.billingInvoice.update({ where: { id: record.id }, data: { email_error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
async function processFailedInvoice(invoice) {
  const { record, subscription } = await persistStripeInvoice(invoice);
  if (record.failure_email_sent_at) return record;
  const user = await prisma_default.user.findUniqueOrThrow({ where: { id: subscription.user_id }, select: { email: true } });
  try {
    const response = await sendPaymentFailedEmail({ to: user.email, plan: subscription.plan, hostedInvoiceUrl: invoice.hosted_invoice_url ?? null });
    return prisma_default.billingInvoice.update({
      where: { id: record.id },
      data: { failure_email_sent_at: /* @__PURE__ */ new Date(), failure_email_message_id: response.messageId ?? null, email_error: null }
    });
  } catch (error) {
    await prisma_default.billingInvoice.update({ where: { id: record.id }, data: { email_error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
async function listBillingInvoices(userId) {
  return prisma_default.billingInvoice.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 24,
    select: { id: true, invoice_number: true, status: true, currency: true, amount_paid: true, created_at: true, hosted_invoice_url: true, invoice_pdf_url: true }
  });
}

// src/features/subscription/stripe_webhook_service.ts
init_stripe_config();
init_subscription_service();
init_credits_service();
async function beginEvent(event) {
  const existing = await prisma_default.stripeWebhookEvent.findUnique({ where: { stripe_event_id: event.id } });
  if (existing?.status === "COMPLETE") return false;
  if (existing?.status === "PROCESSING" && Date.now() - existing.updated_at.getTime() < 5 * 60 * 1e3) return false;
  if (existing) {
    await prisma_default.stripeWebhookEvent.update({ where: { id: existing.id }, data: { status: "PROCESSING", error_reason: null } });
    return true;
  }
  try {
    await prisma_default.stripeWebhookEvent.create({ data: { stripe_event_id: event.id, event_type: event.type } });
    return true;
  } catch {
    return false;
  }
}
async function syncInvoiceSubscription(invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  await syncSubscriptionFromStripe(subscription);
}
async function processEvent(event) {
  const stripe = getStripeClient();
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode === "payment") {
      await awardCreditPackFromCheckoutSession(session);
      return;
    }
    const subscriptionId = getStripeId(session.subscription);
    if (subscriptionId) await syncSubscriptionFromStripe(await stripe.subscriptions.retrieve(subscriptionId));
    return;
  }
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscriptionFromStripe(event.data.object);
    return;
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    await syncInvoiceSubscription(invoice);
    await processPaidInvoice(invoice);
    return;
  }
  if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_action_required") {
    const invoice = event.data.object;
    await syncInvoiceSubscription(invoice);
    await processFailedInvoice(invoice);
  }
}
async function handleStripeWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is required");
  if (!signature) throw new Error("Missing Stripe signature");
  const event = getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  if (!await beginEvent(event)) return { received: true, duplicate: true, event_type: event.type };
  try {
    await processEvent(event);
    await prisma_default.stripeWebhookEvent.update({ where: { stripe_event_id: event.id }, data: { status: "COMPLETE", processed_at: /* @__PURE__ */ new Date(), error_reason: null } });
    return { received: true, duplicate: false, event_type: event.type };
  } catch (error) {
    await prisma_default.stripeWebhookEvent.update({ where: { stripe_event_id: event.id }, data: { status: "FAILED", error_reason: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// src/features/subscription/subscription_controller.ts
function fail500(res, route, error, fallback) {
  console.error(`[subscription_controller:${route}]`, error);
  res.status(500).json({ error: fallback });
}
async function createSubscriptionController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const { plan, billing_interval, request_id } = req.body;
    const checkout = await createSubscription({
      user_id: userId,
      plan,
      billing_interval: billing_interval ?? "monthly",
      request_id
    });
    res.status(201).json(checkout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create subscription";
    const statusCode = message === "Invalid subscription plan" ? 400 : message === "User not found" ? 404 : message === "User already has an active subscription" ? 409 : 500;
    if (statusCode === 500) {
      fail500(res, "createSubscription", error, "Failed to create subscription");
      return;
    }
    res.status(statusCode).json({ error: message });
  }
}
async function createBillingPortalController(req, res) {
  try {
    const { user: { id } } = req;
    res.json(await createBillingPortalSession(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "No Stripe billing account found") {
      res.status(400).json({ error: message });
      return;
    }
    console.error("[subscription_controller:createBillingPortal]", error);
    res.status(400).json({ error: "Failed to open billing portal" });
  }
}
async function verifyCheckoutController(req, res) {
  try {
    const { user: { id } } = req;
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    res.json(await verifyCheckoutSession(id, sessionId));
  } catch (error) {
    if (!(error instanceof Error && error.message === "Checkout session not found")) {
      console.error("[subscription_controller:verifyCheckout]", error);
    }
    res.status(404).json({ error: "Checkout session not found" });
  }
}
async function listBillingInvoicesController(req, res) {
  const { user: { id } } = req;
  res.json({ invoices: await listBillingInvoices(id) });
}
async function getMyPlanController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const plan = await getMyPlan(userId);
    res.status(200).json(plan);
  } catch (error) {
    fail500(res, "getMyPlan", error, "Failed to get subscription plan");
  }
}
async function getPlanLimitsController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const limits = await getPlanLimits(userId);
    res.status(200).json(limits);
  } catch (error) {
    fail500(res, "getPlanLimits", error, "Failed to get plan limits");
  }
}
async function getPlanQuotaController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const quota = await getPlanQuota(userId);
    res.status(200).json(quota);
  } catch (error) {
    fail500(res, "getPlanQuota", error, "Failed to get plan quota");
  }
}
async function stripeWebhookController(req, res) {
  try {
    const signature = req.headers["stripe-signature"];
    const result = await handleStripeWebhook(
      req.body,
      Array.isArray(signature) ? signature[0] : signature
    );
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to handle Stripe webhook";
    const isSignatureError = message.includes("signature") || message.includes("STRIPE_WEBHOOK_SECRET");
    console.error("[subscription_controller:stripeWebhook]", error);
    res.status(isSignatureError ? 400 : 500).json({
      error: isSignatureError ? "Invalid webhook signature" : "Failed to handle Stripe webhook"
    });
  }
}
async function canCreateProjectController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const result = await canCreateProject(userId);
    res.status(200).json(result);
  } catch (error) {
    fail500(res, "canCreateProject", error, "Failed to check project limit");
  }
}
async function canCreatePromptController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const result = await canCreatePrompt(userId);
    res.status(200).json(result);
  } catch (error) {
    fail500(res, "canCreatePrompt", error, "Failed to check prompt limit");
  }
}
async function canAddCompetitorController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const result = await canAddCompetitor(userId);
    res.status(200).json(result);
  } catch (error) {
    fail500(res, "canAddCompetitor", error, "Failed to check competitor limit");
  }
}
async function canRunRefreshController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const result = await canRunRefresh(userId);
    res.status(200).json(result);
  } catch (error) {
    fail500(res, "canRunRefresh", error, "Failed to check refresh limit");
  }
}
async function canExportController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const result = await canExport(userId);
    res.status(200).json(result);
  } catch (error) {
    fail500(res, "canExport", error, "Failed to check export access");
  }
}
async function refreshPlanUsageController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const usage = await refreshPlanUsage(userId);
    res.status(200).json(usage);
  } catch (error) {
    fail500(res, "refreshPlanUsage", error, "Failed to refresh plan usage");
  }
}

// src/features/subscription/subscription_routes.ts
var router10 = (0, import_express10.Router)();
router10.post("/create", createSubscriptionController);
router10.post("/portal", createBillingPortalController);
router10.get("/checkout/:sessionId", verifyCheckoutController);
router10.get("/invoices", listBillingInvoicesController);
router10.get("/me", getMyPlanController);
router10.get("/limits", getPlanLimitsController);
router10.get("/quota", getPlanQuotaController);
router10.get("/can/create-project", canCreateProjectController);
router10.get("/can/create-prompt", canCreatePromptController);
router10.get("/can/add-competitor", canAddCompetitorController);
router10.get("/can/run-refresh", canRunRefreshController);
router10.get("/can/export", canExportController);
router10.post("/usage/refresh", refreshPlanUsageController);
var subscription_routes_default = router10;

// src/features/profile/profile_routes.ts
var import_express11 = require("express");

// src/features/profile/profile_service.ts
init_prisma();
init_credits_service2();
async function getProfileData(userId) {
  const [user, projects, wallet, planUsage] = await Promise.all([
    prisma_default.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        is_verified: true,
        account_type: true,
        role: true,
        plan: true,
        created_at: true
      }
    }),
    prisma_default.project.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        brand_name: true,
        brand_url: true,
        brand_location: true,
        created_at: true,
        updated_at: true
      }
    }),
    getCreditBalance2(userId),
    prisma_default.planUsage.findFirst({
      where: { user_id: userId },
      orderBy: { period_start: "desc" },
      select: {
        prompt_count: true,
        project_count: true,
        competitor_count: true,
        monthly_runs_used: true,
        period_start: true,
        period_end: true
      }
    })
  ]);
  if (!user) {
    throw new Error("User not found");
  }
  const { getAgencyContext: getAgencyContext3 } = await Promise.resolve().then(() => (init_agency_service(), agency_service_exports));
  const agencyContext = await getAgencyContext3(userId).catch(() => null);
  return {
    user: {
      ...user,
      plan: "PAYG",
      effective_plan: "PAYG",
      agency_role: agencyContext?.role || null
    },
    projects,
    wallet: {
      balance: wallet.remaining,
      used: wallet.used
    },
    usage: planUsage ?? {
      prompt_count: 0,
      project_count: 0,
      competitor_count: 0,
      monthly_runs_used: 0,
      period_start: null,
      period_end: null
    }
  };
}

// src/features/profile/profile_controller.ts
async function getProfileController(req, res) {
  try {
    const {
      user: { id: userId }
    } = req;
    const profile = await getProfileData(userId);
    res.status(200).json(profile);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("[profile_controller:getProfile]", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
}

// src/features/profile/profile_routes.ts
var router11 = (0, import_express11.Router)();
router11.get("/", getProfileController);
router11.get("/me", getProfileController);
var profile_routes_default = router11;

// src/features/settings/settings_routes.ts
var import_express12 = require("express");

// src/features/settings/settings_controller.ts
var import_zod6 = require("zod");

// src/features/settings/settings_service.ts
var import_bcryptjs3 = __toESM(require("bcryptjs"), 1);
init_prisma();
var import_client15 = require("@prisma/client");
async function getSettings(userId) {
  const user = await prisma_default.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      is_verified: true,
      account_type: true,
      role: true,
      plan: true,
      created_at: true,
      updated_at: true
    }
  });
  if (!user) {
    throw new Error("User not found");
  }
  return {
    account: user,
    security: {
      password_enabled: true,
      email_verified: user.is_verified
    },
    product: {
      weekly_email_reports: true,
      export_notifications: true
    }
  };
}
async function updatePassword(userId, currentPassword, newPassword) {
  const user = await prisma_default.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true
    }
  });
  if (!user) {
    throw new Error("User not found");
  }
  const validPassword = await import_bcryptjs3.default.compare(currentPassword, user.password);
  if (!validPassword) {
    throw new Error("Current password is incorrect");
  }
  const reusedPassword = await import_bcryptjs3.default.compare(newPassword, user.password);
  if (reusedPassword) {
    throw new Error("New password must be different from current password");
  }
  const salt = await import_bcryptjs3.default.genSalt(10);
  const password = await import_bcryptjs3.default.hash(newPassword, salt);
  await prisma_default.user.update({
    where: { id: userId },
    data: { password }
  });
  return { message: "Password updated successfully" };
}
async function updateAccountType(userId, accountType) {
  const user = await prisma_default.user.findUnique({ where: { id: userId }, select: { account_type: true } });
  if (!user) throw new Error("User not found");
  if (user.account_type === accountType) return { account_type: accountType };
  if (user.account_type === import_client15.AccountType.AGENCY) {
    throw new Error("Agency accounts cannot be converted to individual accounts while shared workspace data exists");
  }
  const paidSubscription = await prisma_default.subscription.findFirst({
    where: { user_id: userId, plan: { not: "FREE" }, status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
    select: { id: true }
  });
  if (paidSubscription) throw new Error("Cancel the active individual subscription before converting to an agency account");
  await prisma_default.user.update({ where: { id: userId }, data: { account_type: import_client15.AccountType.AGENCY } });
  return { account_type: import_client15.AccountType.AGENCY };
}

// src/features/settings/settings_controller.ts
var passwordSchema = import_zod6.z.object({
  current_password: import_zod6.z.string().min(1, "Current password is required"),
  new_password: import_zod6.z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one number")
});
var accountTypeSchema = import_zod6.z.object({ account_type: import_zod6.z.enum(["SINGLE", "AGENCY"]) });
async function getSettingsController(req, res) {
  try {
    const {
      user: { id: userId }
    } = req;
    res.status(200).json(await getSettings(userId));
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("[settings_controller:getSettings]", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
}
async function updatePasswordController(req, res) {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid password payload",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const {
      user: { id: userId }
    } = req;
    const result = await updatePassword(
      userId,
      parsed.data.current_password,
      parsed.data.new_password
    );
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update password";
    const statusCode = message === "User not found" ? 404 : message === "Current password is incorrect" ? 400 : message === "New password must be different from current password" ? 400 : 500;
    if (statusCode === 500) {
      console.error("[settings_controller:updatePassword]", error);
      res.status(500).json({ error: "Failed to update password" });
      return;
    }
    res.status(statusCode).json({ error: message });
  }
}
async function updateAccountTypeController(req, res) {
  const parsed = accountTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "account_type must be SINGLE or AGENCY" });
    return;
  }
  try {
    const { user: { id: userId } } = req;
    res.status(200).json(await updateAccountType(userId, parsed.data.account_type));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "User not found") {
      res.status(404).json({ error: message });
      return;
    }
    if (message === "Agency accounts cannot be converted to individual accounts while shared workspace data exists" || message === "Cancel the active individual subscription before converting to an agency account") {
      res.status(409).json({ error: message });
      return;
    }
    console.error("[settings_controller:updateAccountType]", error);
    res.status(500).json({ error: "Failed to update account type" });
  }
}

// src/features/settings/settings_routes.ts
var router12 = (0, import_express12.Router)();
router12.get("/", getSettingsController);
router12.get("/me", getSettingsController);
router12.patch("/password", updatePasswordController);
router12.patch("/account-type", updateAccountTypeController);
var settings_routes_default = router12;

// src/features/help/help_routes.ts
var import_express13 = require("express");

// src/features/help/help_controller.ts
var import_zod7 = require("zod");

// src/features/help/help_service.ts
init_prisma();
async function createHelpCenterTicket(input, user_id) {
  return prisma_default.helpCenter.create({
    data: {
      user_id,
      email: input.email,
      subject: input.subject,
      message: input.message
    },
    select: {
      id: true,
      email: true,
      subject: true,
      message: true,
      is_resolved: true,
      created_at: true,
      updated_at: true
    }
  });
}
async function getUserTickets(user_id) {
  return prisma_default.helpCenter.findMany({
    where: {
      user_id
    },
    orderBy: {
      created_at: "desc"
    },
    select: {
      id: true,
      email: true,
      subject: true,
      message: true,
      is_resolved: true,
      created_at: true,
      updated_at: true
    }
  });
}

// src/features/help/help_controller.ts
var createTicketSchema = import_zod7.z.object({
  email: import_zod7.z.string().email("Invalid email address"),
  subject: import_zod7.z.string().trim().min(3, "Subject must be at least 3 characters").max(160, "Subject is too long"),
  message: import_zod7.z.string().trim().min(10, "Message must be at least 10 characters").max(5e3, "Message is too long")
});
async function createTicketController(req, res) {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError3 = Object.values(fieldErrors).flat().find(Boolean);
    res.status(400).json({
      success: false,
      error: firstError3 ?? "Invalid help ticket payload",
      errors: fieldErrors
    });
    return;
  }
  try {
    const user_id = req.user.id;
    const ticket = await createHelpCenterTicket(parsed.data, user_id);
    res.status(201).json({
      success: true,
      ticket
    });
  } catch (error) {
    console.error("[help_controller:createTicket]", error);
    res.status(500).json({ success: false, error: "Failed to create help ticket" });
  }
}
async function getTicketsController(req, res) {
  try {
    const user_id = req.user.id;
    const tickets = await getUserTickets(user_id);
    res.status(200).json({
      success: true,
      tickets
    });
  } catch (error) {
    console.error("[help_controller:getTickets]", error);
    res.status(500).json({ success: false, error: "Failed to get help tickets" });
  }
}

// src/features/help/help_routes.ts
var router13 = (0, import_express13.Router)();
router13.post("/tickets", createTicketController);
router13.get("/tickets", getTicketsController);
var help_routes_default = router13;

// src/features/exports/export_routes.ts
var import_express14 = require("express");

// src/features/exports/export_controller.ts
init_project_access();

// src/features/exports/export_service.ts
var import_exceljs2 = __toESM(require("exceljs"), 1);
var import_pdfkit2 = __toESM(require("pdfkit"), 1);
init_prisma();

// src/features/exports/overview/pdf/overview_pdf_document.ts
var import_pdfkit = __toESM(require("pdfkit"), 1);

// src/features/exports/overview/overview_export_assets.ts
function normalizeDomain3(brandUrl) {
  try {
    return new URL(brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`).hostname;
  } catch {
    return "";
  }
}
async function fetchBrandLogo(brandUrl) {
  const domain = normalizeDomain3(brandUrl);
  if (!domain) return null;
  const candidates = [
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("image/")) continue;
      return Buffer.from(await response.arrayBuffer());
    } catch {
    }
  }
  return null;
}

// src/features/exports/overview/overview_export_theme.ts
var OVERVIEW_PDF = {
  navy: "#07152D",
  navySoft: "#102B4E",
  blue: "#2F80ED",
  sky: "#61C7F2",
  mint: "#A7F3D0",
  paper: "#F8FAFC",
  white: "#FFFFFF",
  ink: "#0F172A",
  text: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  border: "#DCE5EE",
  softBlue: "#EDF7FF",
  softMint: "#ECFDF5"
};
var OVERVIEW_XL = {
  navy: "FF07152D",
  navySoft: "FF102B4E",
  blue: "FF2F80ED",
  sky: "FF61C7F2",
  mint: "FFA7F3D0",
  white: "FFFFFFFF",
  paper: "FFF8FAFC",
  ink: "FF0F172A",
  text: "FF334155",
  muted: "FF64748B",
  border: "FFDCE5EE",
  softBlue: "FFEDF7FF",
  softMint: "FFECFDF5"
};

// src/features/exports/overview/overview_export_pdf_primitives.ts
function pdfText(value) {
  return String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/\u2026/g, "...").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}
function addPageHeader(doc, brandName, title) {
  const width = doc.page.width;
  doc.rect(0, 0, width, 70).fill(OVERVIEW_PDF.white);
  doc.moveTo(42, 69).lineTo(width - 42, 69).strokeColor(OVERVIEW_PDF.border).lineWidth(0.6).stroke();
  doc.fillColor(OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(8).text(pdfText(brandName).toUpperCase(), 42, 22, { characterSpacing: 1.2 });
  doc.fillColor(OVERVIEW_PDF.ink).font("Helvetica-Bold").fontSize(18).text(pdfText(title), 42, 37);
}
function addSectionTitle(doc, title, y) {
  doc.fillColor(OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(8).text(pdfText(title).toUpperCase(), 42, y, { characterSpacing: 1 });
  return y + 20;
}
function addFooter(doc, brandName, page, total) {
  const width = doc.page.width;
  const y = doc.page.height - 30;
  doc.moveTo(42, y - 9).lineTo(width - 42, y - 9).strokeColor(OVERVIEW_PDF.border).lineWidth(0.5).stroke();
  doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(7.5).text(`Confidential - Prepared for ${pdfText(brandName)}`, 42, y, { width: 210, lineBreak: false });
  doc.fillColor(OVERVIEW_PDF.faint).text("Powered by DeepMention", width / 2 - 75, y, {
    width: 150,
    align: "center",
    lineBreak: false
  });
  doc.text(`Page ${page} of ${total}`, width - 130, y, {
    width: 88,
    align: "right",
    lineBreak: false
  });
}
function drawTable(input) {
  const { doc, headers, rows, widths } = input;
  const x0 = 42;
  const headerHeight = 28;
  const rowHeight = 25;
  let y = input.y;
  doc.roundedRect(x0, y, widths.reduce((sum, width) => sum + width, 0), headerHeight, 5).fill(OVERVIEW_PDF.navy);
  let x = x0;
  headers.forEach((header2, index) => {
    doc.fillColor("#BDD6EF").font("Helvetica-Bold").fontSize(7.5).text(pdfText(header2).toUpperCase(), x + 8, y + 8, {
      width: widths[index] - 16,
      height: headerHeight - 10,
      ellipsis: true
    });
    x += widths[index];
  });
  y += headerHeight;
  rows.forEach((row, rowIndex) => {
    if (rowIndex % 2 === 0) {
      doc.rect(x0, y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill(OVERVIEW_PDF.paper);
    }
    x = x0;
    row.forEach((cell, columnIndex) => {
      const options = {
        width: widths[columnIndex] - 16,
        height: rowHeight - 7,
        ellipsis: true
      };
      if (input.linkColumn === columnIndex && input.links?.[rowIndex]) {
        options.link = input.links[rowIndex];
        options.underline = true;
      }
      doc.fillColor(columnIndex === input.linkColumn ? OVERVIEW_PDF.blue : OVERVIEW_PDF.text).font(columnIndex === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(pdfText(cell), x + 8, y + 8, options);
      x += widths[columnIndex];
    });
    doc.moveTo(x0, y + rowHeight).lineTo(x0 + widths.reduce((sum, width) => sum + width, 0), y + rowHeight).strokeColor(OVERVIEW_PDF.border).lineWidth(0.35).stroke();
    y += rowHeight;
  });
  return y;
}
function drawMetricCard(input) {
  const { doc, x, y, width } = input;
  doc.roundedRect(x, y, width, 78, 7).fillAndStroke(OVERVIEW_PDF.white, OVERVIEW_PDF.border);
  doc.rect(x, y, width, 3).fill(input.accent ?? OVERVIEW_PDF.sky);
  doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica-Bold").fontSize(7).text(pdfText(input.label).toUpperCase(), x + 9, y + 13, { width: width - 18, ellipsis: true });
  doc.fillColor(OVERVIEW_PDF.ink).font("Helvetica-Bold").fontSize(19).text(pdfText(input.value), x + 9, y + 32, { width: width - 18, ellipsis: true });
  if (input.detail) {
    doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(6.7).text(pdfText(input.detail), x + 9, y + 57, { width: width - 18, height: 14, ellipsis: true });
  }
}
function drawHorizontalBar(input) {
  const max = Math.max(input.max ?? 100, 1);
  const ratio = Math.min(1, Math.max(0, input.value / max));
  input.doc.fillColor(OVERVIEW_PDF.text).font("Helvetica-Bold").fontSize(8).text(pdfText(input.label), input.x, input.y, { width: input.width - 52, ellipsis: true });
  input.doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(8).text(`${input.value.toFixed(1)}${input.suffix ?? ""}`, input.x + input.width - 50, input.y, { width: 50, align: "right" });
  input.doc.roundedRect(input.x, input.y + 14, input.width, 6, 3).fill(OVERVIEW_PDF.border);
  if (ratio > 0) input.doc.roundedRect(input.x, input.y + 14, Math.max(4, input.width * ratio), 6, 3).fill(input.color ?? OVERVIEW_PDF.blue);
}
function drawTrendChart(input) {
  const { doc, x, y, width, height, points } = input;
  doc.roundedRect(x, y, width, height, 8).fillAndStroke(OVERVIEW_PDF.white, OVERVIEW_PDF.border);
  const left = x + 36;
  const top = y + 20;
  const plotWidth = width - 54;
  const plotHeight = height - 52;
  for (let step = 0; step <= 4; step += 1) {
    const value = 100 - step * 25;
    const lineY = top + step / 4 * plotHeight;
    doc.moveTo(left, lineY).lineTo(left + plotWidth, lineY).strokeColor(OVERVIEW_PDF.border).lineWidth(0.35).stroke();
    doc.fillColor(OVERVIEW_PDF.faint).font("Helvetica").fontSize(6).text(String(value), x + 8, lineY - 3, { width: 22, align: "right" });
  }
  if (points.length > 1) {
    const px = (index) => left + index / (points.length - 1) * plotWidth;
    const py = (value) => top + (100 - Math.min(100, Math.max(0, value))) / 100 * plotHeight;
    doc.moveTo(px(0), py(points[0].visibility));
    for (let index = 1; index < points.length; index += 1) doc.lineTo(px(index), py(points[index].visibility));
    doc.strokeColor(OVERVIEW_PDF.blue).lineWidth(2).stroke();
    points.forEach((point, index) => {
      if (index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 6)) === 0) {
        doc.circle(px(index), py(point.visibility), 2.4).fill(OVERVIEW_PDF.blue);
      }
    });
    doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(6.5).text(points[0].date.slice(5), left, y + height - 20, { width: 50 }).text(points.at(-1).date.slice(5), left + plotWidth - 50, y + height - 20, { width: 50, align: "right" });
  } else {
    doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(9).text("More than one response date is required to draw a trend.", x + 30, y + height / 2 - 5, { width: width - 60, align: "center" });
  }
}

// src/features/exports/overview/pdf/overview_pdf_format.ts
function overviewDateLabel(date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}
function overviewMetricValue(metric2) {
  if (metric2.format === "percent") return `${metric2.value.toFixed(1)}%`;
  if (metric2.format === "position") return metric2.value ? `#${metric2.value.toFixed(1)}` : "-";
  if (metric2.format === "score") return metric2.value ? metric2.value.toFixed(1) : "-";
  return metric2.value.toLocaleString("en-US");
}
function overviewDeltaLabel(metric2) {
  if (metric2.delta === null) return "No comparison";
  const favorable = metric2.lowerIsBetter ? metric2.delta <= 0 : metric2.delta >= 0;
  const sign = metric2.delta > 0 ? "+" : "";
  return `${sign}${metric2.delta.toFixed(1)} pts | ${favorable ? "Positive" : "Watch"}`;
}
function overviewShorten(value, length) {
  const clean2 = pdfText(value);
  return clean2.length > length ? `${clean2.slice(0, Math.max(1, length - 3)).trim()}...` : clean2;
}

// src/features/exports/overview/pdf/sections/overview_pdf_actions.ts
function renderOverviewActions(doc, model2) {
  addPageHeader(doc, model2.brandName, "Prioritized action plan");
  let y = 92;
  doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(9.5).text("A practical 30/60/90-day roadmap built from measured prompt, engine, competitor, and source evidence.", 42, y, { width: 500 });
  y += 42;
  const horizonLabel = { NOW: "0-30 DAYS", NEXT: "31-60 DAYS", LATER: "61-90 DAYS" };
  for (const item of model2.actions.slice(0, 6)) {
    const height = 104;
    doc.roundedRect(42, y, 511, height, 8).fillAndStroke(OVERVIEW_PDF.white, OVERVIEW_PDF.border);
    doc.roundedRect(56, y + 14, 68, 18, 5).fill(item.priority === "HIGH" ? OVERVIEW_PDF.navy : OVERVIEW_PDF.softBlue);
    doc.fillColor(item.priority === "HIGH" ? OVERVIEW_PDF.white : OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(7).text(item.priority, 56, y + 20, { width: 68, align: "center" });
    doc.fillColor(OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(7).text(horizonLabel[item.horizon], 134, y + 20);
    doc.fillColor(OVERVIEW_PDF.ink).font("Helvetica-Bold").fontSize(10).text(overviewShorten(item.title, 62), 56, y + 42, { width: 472, height: 14, ellipsis: true });
    doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(8.3).text(pdfText(item.action), 56, y + 61, { width: 300, height: 35, ellipsis: true, lineGap: 2 });
    doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(7.8).text(pdfText(item.evidence), 374, y + 61, { width: 154, height: 34, ellipsis: true, lineGap: 2 });
    y += height + 10;
  }
}

// src/features/exports/overview/pdf/sections/overview_pdf_competition.ts
function renderOverviewCompetition(doc, model2) {
  addPageHeader(doc, model2.brandName, "Competitive landscape");
  let y = 92;
  const own = model2.brands.find((brand) => brand.isOwnBrand);
  const strongest = model2.brands.find((brand) => !brand.isOwnBrand);
  if (own && strongest) {
    const gap = own.visibility - strongest.visibility;
    doc.roundedRect(42, y, 511, 62, 8).fill(gap >= 0 ? OVERVIEW_PDF.softMint : "#FFF7ED");
    doc.fillColor(OVERVIEW_PDF.ink).font("Helvetica-Bold").fontSize(11).text(gap >= 0 ? `${model2.brandName} leads ${strongest.brand}` : `${strongest.brand} leads ${model2.brandName}`, 58, y + 15);
    doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(9).text(`${Math.abs(gap).toFixed(1)} percentage points separate the two brands in measured AI visibility.`, 58, y + 36);
    y += 86;
  }
  const max = Math.max(100, ...model2.brands.map((item) => item.visibility));
  model2.brands.slice(0, 7).forEach((brand, index) => {
    drawHorizontalBar({
      doc,
      x: 42,
      y: y + index * 40,
      width: 511,
      label: `${brand.rank}. ${brand.brand}${brand.isOwnBrand ? " (tracked brand)" : ""}`,
      value: brand.visibility,
      max,
      suffix: "%",
      color: brand.isOwnBrand ? OVERVIEW_PDF.blue : OVERVIEW_PDF.sky
    });
  });
  y += Math.min(7, model2.brands.length) * 40 + 24;
  y = addSectionTitle(doc, "Competitive benchmark", y);
  drawTable({
    doc,
    y,
    headers: ["#", "Brand", "Visibility", "Mentions", "Avg. position", "Sentiment"],
    widths: [34, 185, 79, 66, 84, 63],
    rows: model2.brands.slice(0, 9).map((row) => [
      String(row.rank),
      `${row.brand}${row.isOwnBrand ? " *" : ""}`,
      `${row.visibility.toFixed(1)}%`,
      String(row.mentions),
      row.position === null ? "-" : `#${row.position.toFixed(1)}`,
      row.sentiment === null ? "-" : row.sentiment.toFixed(1)
    ])
  });
}

// src/features/exports/overview/pdf/sections/overview_pdf_cover.ts
function renderOverviewCover(doc, model2, logo) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill(OVERVIEW_PDF.navy);
  doc.circle(width + 8, 30, 160).fill(OVERVIEW_PDF.navySoft);
  doc.circle(width - 30, height - 20, 115).fill("#153B68");
  doc.roundedRect(48, 52, 62, 62, 13).fill(OVERVIEW_PDF.white);
  if (logo) {
    try {
      doc.image(logo, 61, 65, { fit: [36, 36], align: "center", valign: "center" });
    } catch {
      drawInitial(doc, model2.brandName);
    }
  } else {
    drawInitial(doc, model2.brandName);
  }
  doc.fillColor("#A8D8F5").font("Helvetica-Bold").fontSize(9).text("AI VISIBILITY INTELLIGENCE REPORT", 48, 154, { characterSpacing: 1.5 });
  doc.fillColor(OVERVIEW_PDF.white).font("Helvetica-Bold").fontSize(31).text(`${pdfText(model2.brandName)} visibility report`, 48, 194, { width: width - 96, lineGap: 4 });
  doc.fillColor("#C6D7E9").font("Helvetica").fontSize(12).text("Executive performance, buyer prompts, competitive position, source influence, and an evidence-led action plan.", 48, 280, { width: 430, lineGap: 4 });
  doc.roundedRect(48, 355, 210, 58, 8).fill("#102844");
  doc.fillColor("#8EBBE2").font("Helvetica-Bold").fontSize(7.5).text("REPORTING PERIOD", 64, 370);
  doc.fillColor(OVERVIEW_PDF.white).font("Helvetica-Bold").fontSize(14).text(pdfText(model2.periodLabel), 64, 388);
  const visibility = model2.metrics.find((item) => item.label === "Brand visibility");
  doc.moveTo(48, height - 190).lineTo(width - 48, height - 190).strokeColor("#315478").lineWidth(0.7).stroke();
  doc.fillColor("#8EBBE2").font("Helvetica-Bold").fontSize(8).text("PREPARED FOR", 48, height - 158);
  doc.fillColor(OVERVIEW_PDF.white).font("Helvetica").fontSize(13).text(pdfText(model2.brandName), 48, height - 137);
  doc.fillColor("#8EBBE2").font("Helvetica-Bold").fontSize(8).text("GENERATED", 300, height - 158);
  doc.fillColor(OVERVIEW_PDF.white).font("Helvetica").fontSize(11).text(overviewDateLabel(model2.generatedAt), 300, height - 137);
  doc.fillColor(OVERVIEW_PDF.sky).font("Helvetica-Bold").fontSize(8).text("CURRENT VISIBILITY", 48, height - 86);
  doc.fillColor(OVERVIEW_PDF.white).font("Helvetica-Bold").fontSize(27).text(`${(visibility?.value ?? 0).toFixed(1)}%`, 48, height - 62);
  doc.fillColor("#9CB6D0").font("Helvetica").fontSize(8).text("Powered by DeepMention", width - 180, height - 31, { width: 132, align: "right" });
}
function drawInitial(doc, brandName) {
  doc.fillColor(OVERVIEW_PDF.navy).font("Helvetica-Bold").fontSize(23).text(pdfText(brandName).slice(0, 1).toUpperCase(), 68, 70);
}

// src/features/exports/overview/pdf/sections/overview_pdf_coverage.ts
function renderOverviewCoverage(doc, model2) {
  addPageHeader(doc, model2.brandName, "Data coverage and reliability");
  let y = 92;
  const cards = [
    ["Prompts represented", model2.coverage.representedPrompts, "Included response set"],
    ["Currently active", model2.coverage.activePrompts, "Active project prompts"],
    ["Responses", model2.coverage.responses, "Included after filters"],
    ["Successful runs", model2.coverage.successfulRuns, "Completed visibility runs"],
    ["Partial runs", model2.coverage.partialRuns, "Completed with some gaps"],
    ["Failed jobs", model2.coverage.failedJobs, "Checks requiring review"]
  ];
  cards.forEach((item, index) => drawMetricCard({
    doc,
    x: 42 + index % 3 * 174,
    y: y + Math.floor(index / 3) * 94,
    width: 164,
    label: item[0],
    value: item[1].toLocaleString("en-US"),
    detail: item[2],
    accent: item[0].includes("Failed") ? "#F59E0B" : OVERVIEW_PDF.sky
  }));
  y += 214;
  y = addSectionTitle(doc, "Coverage window", y);
  drawTable({
    doc,
    y,
    headers: ["Selected period", "First response", "Last response", "Comparison"],
    widths: [132, 132, 132, 115],
    rows: [[
      model2.periodLabel,
      model2.coverage.firstResponseAt ? overviewDateLabel(model2.coverage.firstResponseAt) : "Unavailable",
      model2.coverage.lastResponseAt ? overviewDateLabel(model2.coverage.lastResponseAt) : "Unavailable",
      model2.comparisonLabel ?? "Not available"
    ]]
  });
  y += 84;
  y = addSectionTitle(doc, "How to interpret this report", y);
  model2.methodology.slice(0, 6).forEach((item, index) => {
    doc.circle(48, y + 5, 2).fill(index < 2 ? OVERVIEW_PDF.blue : OVERVIEW_PDF.sky);
    doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(8.8).text(pdfText(item), 58, y, { width: doc.page.width - 105, lineGap: 2 });
    y += 38;
  });
}

// src/features/exports/overview/pdf/sections/overview_pdf_evidence.ts
function renderOverviewEvidence(doc, model2) {
  addPageHeader(doc, model2.brandName, "Response evidence appendix");
  let y = 92;
  doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(9.5).text("A compact audit trail of recent stored responses included in this report.", 42, y, { width: 500 });
  y += 42;
  drawTable({
    doc,
    y,
    headers: ["Date", "Engine", "Prompt", "Mentioned", "Rank", "Sentiment", "Top source"],
    widths: [61, 62, 192, 55, 38, 51, 52],
    rows: model2.evidence.slice(0, 12).map((row) => [
      overviewDateLabel(row.date).replace(/ \d{4}$/, ""),
      row.engine,
      overviewShorten(row.prompt, 48),
      row.mentioned ? "Yes" : "No",
      row.position === null ? "-" : `#${row.position}`,
      row.sentiment === null ? "-" : row.sentiment.toFixed(0),
      overviewShorten(row.source || "-", 14)
    ])
  });
}

// src/features/exports/overview/pdf/sections/overview_pdf_executive.ts
function renderOverviewExecutive(doc, model2) {
  addPageHeader(doc, model2.brandName, "Executive summary");
  let y = 92;
  doc.fillColor(OVERVIEW_PDF.muted).font("Helvetica").fontSize(8.5).text(`${pdfText(model2.periodLabel)}${model2.comparisonLabel ? ` | Compared with ${pdfText(model2.comparisonLabel).toLowerCase()}` : ""}`, 42, y);
  y += 23;
  const cardWidth = 98;
  model2.metrics.slice(0, 5).forEach((item, index) => drawMetricCard({
    doc,
    x: 42 + index * (cardWidth + 9),
    y,
    width: cardWidth,
    label: item.label,
    value: overviewMetricValue(item),
    detail: overviewDeltaLabel(item),
    accent: index === 1 ? OVERVIEW_PDF.mint : OVERVIEW_PDF.sky
  }));
  y += 105;
  doc.roundedRect(42, y, doc.page.width - 84, 76, 8).fill(OVERVIEW_PDF.softBlue);
  doc.fillColor(OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(8).text("EXECUTIVE READOUT", 58, y + 15);
  doc.fillColor(OVERVIEW_PDF.ink).font("Helvetica-Bold").fontSize(13).text(pdfText(model2.executiveHeadline), 58, y + 34, { width: doc.page.width - 116, lineGap: 3 });
  y += 100;
  y = addSectionTitle(doc, "What leadership should know", y);
  model2.executivePoints.slice(0, 4).forEach((item, index) => {
    doc.circle(52, y + 7, 7).fill(index === 0 ? OVERVIEW_PDF.navy : OVERVIEW_PDF.softBlue);
    doc.fillColor(index === 0 ? OVERVIEW_PDF.white : OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(7).text(String(index + 1), 48, y + 3.5, { width: 8, align: "center" });
    doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(9.5).text(pdfText(item), 70, y, { width: doc.page.width - 118, lineGap: 2 });
    y += 38;
  });
  y += 8;
  y = addSectionTitle(doc, "Measured sentiment mix", y);
  const sentiment = model2.sentiment;
  const total = Math.max(1, sentiment.scoredResponses);
  const segments = [
    { label: "Positive", value: sentiment.positive, color: "#10B981" },
    { label: "Neutral", value: sentiment.neutral, color: OVERVIEW_PDF.sky },
    { label: "Negative", value: sentiment.negative, color: "#F59E0B" }
  ];
  let x = 42;
  for (const segment of segments) {
    const width = 511 * (segment.value / total);
    if (width > 0) doc.rect(x, y, width, 16).fill(segment.color);
    x += width;
  }
  y += 27;
  segments.forEach((segment, index) => {
    doc.circle(48 + index * 150, y + 4, 3).fill(segment.color);
    doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(8.5).text(`${segment.label}: ${segment.value}`, 57 + index * 150, y);
  });
}

// src/features/exports/overview/pdf/sections/overview_pdf_performance.ts
function renderOverviewPerformance(doc, model2) {
  addPageHeader(doc, model2.brandName, "Visibility trend and AI engines");
  let y = 94;
  y = addSectionTitle(doc, "Visibility over time", y);
  drawTrendChart({ doc, x: 42, y, width: doc.page.width - 84, height: 218, points: model2.trend });
  y += 242;
  y = addSectionTitle(doc, "Engine performance", y);
  drawTable({
    doc,
    y,
    headers: ["AI engine", "Responses", "Visibility", "Avg. position", "Sentiment", "Domains"],
    widths: [126, 72, 82, 88, 74, 69],
    rows: model2.engines.slice(0, 8).map((row) => [
      row.engine,
      String(row.responses),
      `${row.visibility.toFixed(1)}%`,
      row.position === null ? "-" : `#${row.position.toFixed(1)}`,
      row.sentiment === null ? "-" : row.sentiment.toFixed(1),
      String(row.sourceDomains)
    ])
  });
}

// src/features/exports/overview/pdf/sections/overview_pdf_prompts.ts
function renderOverviewPrompts(doc, model2) {
  addPageHeader(doc, model2.brandName, "Buyer prompt and topic intelligence");
  let y = 92;
  const gaps = model2.prompts.filter((prompt) => prompt.status === "GAP");
  const opportunities = model2.prompts.filter((prompt) => prompt.status === "OPPORTUNITY");
  const leaders = [...model2.prompts].filter((prompt) => prompt.status === "LEADER").sort((a, b) => b.visibility - a.visibility);
  const summary = [
    ["Prompts represented", model2.coverage.representedPrompts, OVERVIEW_PDF.sky],
    ["Visibility gaps", gaps.length, "#F59E0B"],
    ["Leading prompts", leaders.length, OVERVIEW_PDF.mint]
  ];
  summary.forEach((item, index) => drawMetricCard({
    doc,
    x: 42 + index * 174,
    y,
    width: 164,
    label: item[0],
    value: String(item[1]),
    detail: "Measured in this report",
    accent: item[2]
  }));
  y += 106;
  y = addSectionTitle(doc, "Priority buyer prompts", y);
  y = drawTable({
    doc,
    y,
    headers: ["Prompt", "Topic", "Checks", "Visibility", "Position", "Status"],
    widths: [218, 86, 58, 64, 52, 63],
    rows: [...gaps, ...opportunities, ...leaders].slice(0, 8).map((row) => [
      overviewShorten(row.prompt, 55),
      overviewShorten(row.topic, 18),
      String(row.responses),
      `${row.visibility.toFixed(1)}%`,
      row.position === null ? "-" : `#${row.position.toFixed(1)}`,
      row.status === "OPPORTUNITY" ? "IMPROVE" : row.status
    ])
  });
  y += 28;
  y = addSectionTitle(doc, "Topic coverage", y);
  drawTable({
    doc,
    y,
    headers: ["Topic", "Prompts", "Responses", "Visibility", "Avg. position"],
    widths: [210, 70, 80, 76, 75],
    rows: model2.topics.slice(0, 7).map((row) => [
      overviewShorten(row.topic, 38),
      String(row.prompts),
      String(row.responses),
      `${row.visibility.toFixed(1)}%`,
      row.position === null ? "-" : `#${row.position.toFixed(1)}`
    ])
  });
}

// src/features/exports/overview/pdf/sections/overview_pdf_sources.ts
function renderOverviewSources(doc, model2) {
  addPageHeader(doc, model2.brandName, "Source influence and authority gaps");
  let y = 92;
  const confirmed = model2.sources.filter((source) => source.brandPresence === "CONFIRMED").length;
  const unconfirmed = model2.sources.length - confirmed;
  const summary = [
    ["Source domains", model2.sources.length, OVERVIEW_PDF.sky],
    ["Brand confirmed", confirmed, OVERVIEW_PDF.mint],
    ["Presence gaps", unconfirmed, "#F59E0B"]
  ];
  summary.forEach((item, index) => drawMetricCard({
    doc,
    x: 42 + index * 174,
    y,
    width: 164,
    label: item[0],
    value: String(item[1]),
    detail: index === 2 ? "No structured brand confirmation" : "Measured source evidence",
    accent: item[2]
  }));
  y += 108;
  y = addSectionTitle(doc, "Source mix", y);
  y = drawTable({
    doc,
    y,
    headers: ["Source type", "Domains", "Citations", "Brand confirmed"],
    widths: [230, 80, 92, 109],
    rows: model2.sourceTypes.slice(0, 6).map((row) => [
      row.sourceType,
      String(row.domains),
      String(row.citations),
      String(row.confirmedDomains)
    ])
  });
  y += 28;
  y = addSectionTitle(doc, "Highest-influence domains", y);
  const rows = model2.sources.slice(0, 10);
  drawTable({
    doc,
    y,
    headers: ["#", "Domain", "Used", "Type", "Citations", "Brand"],
    widths: [30, 224, 57, 76, 60, 64],
    rows: rows.map((row) => [
      String(row.rank),
      overviewShorten(row.domain, 34),
      `${row.usedPct.toFixed(1)}%`,
      row.sourceType,
      String(row.citations),
      row.brandPresence === "CONFIRMED" ? "Confirmed" : "Gap"
    ]),
    linkColumn: 1,
    links: rows.map((row) => row.url)
  });
  const gap = model2.sources.find((source) => source.brandPresence === "NOT_CONFIRMED");
  if (gap) {
    const noteY = Math.min(doc.page.height - 105, y + 278);
    doc.roundedRect(42, noteY, 511, 48, 7).fill(OVERVIEW_PDF.softBlue);
    doc.fillColor(OVERVIEW_PDF.blue).font("Helvetica-Bold").fontSize(8).text("NEXT SOURCE MOVE", 56, noteY + 11);
    doc.fillColor(OVERVIEW_PDF.text).font("Helvetica").fontSize(8.5).text(pdfText(`Prioritize ${gap.domain}: it appears in ${gap.usedPct.toFixed(1)}% of measured responses without confirmed brand presence.`), 56, noteY + 27, { width: 470 });
  }
}

// src/features/exports/overview/pdf/overview_pdf_document.ts
async function buildOverviewPdfDocument(model2) {
  const logo = await fetchBrandLogo(model2.brandUrl);
  return await new Promise((resolve, reject) => {
    const doc = new import_pdfkit.default({
      margin: 0,
      size: "A4",
      bufferPages: true,
      info: {
        Title: `${model2.brandName} AI Visibility Intelligence Report`,
        Author: model2.brandName,
        Subject: "AI visibility, buyer prompt, competitor, source, and action intelligence"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    renderOverviewCover(doc, model2, logo);
    doc.addPage();
    renderOverviewExecutive(doc, model2);
    doc.addPage();
    renderOverviewPerformance(doc, model2);
    doc.addPage();
    renderOverviewPrompts(doc, model2);
    doc.addPage();
    renderOverviewCompetition(doc, model2);
    doc.addPage();
    renderOverviewSources(doc, model2);
    doc.addPage();
    renderOverviewActions(doc, model2);
    doc.addPage();
    renderOverviewCoverage(doc, model2);
    if (model2.evidence.length) {
      doc.addPage();
      renderOverviewEvidence(doc, model2);
    }
    const range = doc.bufferedPageRange();
    for (let index = 1; index < range.count; index += 1) {
      doc.switchToPage(index);
      addFooter(doc, model2.brandName, index + 1, range.count);
    }
    doc.end();
  });
}

// src/features/exports/overview/overview_export_excel.ts
var import_exceljs = __toESM(require("exceljs"), 1);
function header(cell) {
  cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: OVERVIEW_XL.white } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVERVIEW_XL.navy } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}
function titleBand(sheet, title, subtitle, columns) {
  const last = sheet.getColumn(columns).letter;
  sheet.mergeCells(`A1:${last}1`);
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { name: "Aptos Display", size: 20, bold: true, color: { argb: OVERVIEW_XL.white } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVERVIEW_XL.navy } };
  sheet.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 38;
  sheet.mergeCells(`A2:${last}2`);
  sheet.getCell("A2").value = subtitle;
  sheet.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: OVERVIEW_XL.muted } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVERVIEW_XL.paper } };
  sheet.getCell("A2").alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(2).height = 25;
  sheet.views = [{ state: "frozen", ySplit: 4, topLeftCell: "A5", activeCell: "A5", showGridLines: false }];
}
function addHeaders(sheet, labels) {
  labels.forEach((label, index) => {
    const cell = sheet.getCell(4, index + 1);
    cell.value = label;
    header(cell);
  });
  sheet.getRow(4).height = 28;
}
function styleRows(sheet, start, end, columns) {
  for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.height = 23;
    for (let columnIndex = 1; columnIndex <= columns; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      cell.font = { name: "Aptos", size: 10, color: { argb: OVERVIEW_XL.text } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIndex % 2 === 0 ? OVERVIEW_XL.paper : OVERVIEW_XL.white } };
      cell.border = { bottom: { style: "hair", color: { argb: OVERVIEW_XL.border } } };
      cell.alignment = { vertical: "middle", wrapText: false };
    }
  }
}
function addDataSheet(workbook, input) {
  const sheet = workbook.addWorksheet(input.name, { properties: { tabColor: { argb: input.tabColor } } });
  sheet.columns = input.widths.map((width) => ({ width }));
  titleBand(sheet, input.title, input.subtitle, input.headers.length);
  addHeaders(sheet, input.headers);
  input.rows.forEach((values, index) => {
    sheet.getRow(index + 5).values = values;
  });
  styleRows(sheet, 5, input.rows.length + 4, input.headers.length);
  sheet.autoFilter = { from: "A4", to: `${sheet.getColumn(input.headers.length).letter}${Math.max(5, input.rows.length + 4)}` };
  return sheet;
}
async function buildOverviewExcel(model2) {
  const workbook = new import_exceljs.default.Workbook();
  workbook.creator = model2.brandName;
  workbook.created = model2.generatedAt;
  workbook.modified = model2.generatedAt;
  const summary = workbook.addWorksheet("Executive Summary", { properties: { tabColor: { argb: OVERVIEW_XL.blue } } });
  summary.views = [{ state: "normal", showGridLines: false }];
  summary.columns = [{ width: 24 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];
  summary.mergeCells("A1:F2");
  summary.getCell("A1").value = `${model2.brandName}
AI Visibility Intelligence Report`;
  summary.getCell("A1").font = { name: "Aptos Display", size: 20, bold: true, color: { argb: OVERVIEW_XL.white } };
  summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVERVIEW_XL.navy } };
  summary.getCell("A1").alignment = { vertical: "middle", indent: 1, wrapText: true };
  summary.getRow(1).height = 34;
  summary.getRow(2).height = 34;
  const logo = await fetchBrandLogo(model2.brandUrl);
  if (logo) {
    try {
      const imageId = workbook.addImage({ base64: `data:image/png;base64,${logo.toString("base64")}`, extension: "png" });
      summary.addImage(imageId, { tl: { col: 5.1, row: 0.2 }, ext: { width: 56, height: 56 } });
    } catch {
    }
  }
  summary.mergeCells("A4:F4");
  summary.getCell("A4").value = model2.executiveHeadline;
  summary.getCell("A4").font = { name: "Aptos", size: 12, bold: true, color: { argb: OVERVIEW_XL.ink } };
  summary.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVERVIEW_XL.softBlue } };
  summary.getCell("A4").alignment = { vertical: "middle", wrapText: true, indent: 1 };
  summary.getRow(4).height = 48;
  model2.metrics.forEach((item, index) => {
    const column = index + 1;
    summary.getCell(6, column).value = item.label.toUpperCase();
    summary.getCell(6, column).font = { name: "Aptos", size: 8, bold: true, color: { argb: OVERVIEW_XL.muted } };
    summary.getCell(7, column).value = item.value;
    summary.getCell(7, column).font = { name: "Aptos Display", size: 18, bold: true, color: { argb: OVERVIEW_XL.ink } };
    summary.getCell(7, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVERVIEW_XL.paper } };
    summary.getCell(8, column).value = item.delta === null ? "No comparison" : `${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)} vs previous`;
    summary.getCell(8, column).font = { name: "Aptos", size: 8, color: { argb: OVERVIEW_XL.muted } };
    if (item.format === "percent") summary.getCell(7, column).numFmt = '0.0"%"';
    if (item.format === "position") summary.getCell(7, column).numFmt = '"#"0.0';
  });
  summary.getCell("A10").value = "Reporting period";
  summary.getCell("B10").value = model2.periodLabel;
  summary.getCell("A11").value = "Generated";
  summary.getCell("B11").value = model2.generatedAt;
  summary.getCell("B11").numFmt = "dd mmm yyyy";
  summary.getCell("A13").value = "LEADERSHIP READOUT";
  summary.getCell("A13").font = { name: "Aptos", size: 9, bold: true, color: { argb: OVERVIEW_XL.blue } };
  model2.executivePoints.forEach((point, index) => {
    summary.mergeCells(`A${14 + index}:F${14 + index}`);
    summary.getCell(14 + index, 1).value = `${index + 1}. ${point}`;
    summary.getCell(14 + index, 1).alignment = { wrapText: true, vertical: "middle", indent: 1 };
    summary.getRow(14 + index).height = 28;
  });
  const trend = addDataSheet(workbook, {
    name: "Visibility Trend",
    title: "Visibility trend",
    subtitle: `${model2.periodLabel} - daily measured visibility`,
    tabColor: OVERVIEW_XL.sky,
    widths: [18, 20, 20],
    headers: ["Date", "Visibility %", "Responses"],
    rows: model2.trend.map((item) => [item.date, item.visibility / 100, item.responses])
  });
  trend.getColumn(2).numFmt = "0.0%";
  const engines = addDataSheet(workbook, {
    name: "AI Engines",
    title: "AI engine performance",
    subtitle: "Response coverage, visibility, rank, sentiment, and source diversity",
    tabColor: OVERVIEW_XL.blue,
    widths: [22, 16, 18, 18, 18, 18],
    headers: ["AI Engine", "Responses", "Visibility %", "Avg. Position", "Sentiment", "Source Domains"],
    rows: model2.engines.map((item) => [item.engine, item.responses, item.visibility / 100, item.position, item.sentiment, item.sourceDomains])
  });
  engines.getColumn(3).numFmt = "0.0%";
  const prompts = addDataSheet(workbook, {
    name: "Prompt Intelligence",
    title: "Prompt intelligence",
    subtitle: "Prompt-level performance ranked by the clearest visibility gaps first",
    tabColor: OVERVIEW_XL.sky,
    widths: [52, 22, 14, 18, 16, 16, 18],
    headers: ["Prompt", "Topic", "Responses", "Visibility %", "Avg. Position", "Sentiment", "Status"],
    rows: model2.prompts.map((item) => [item.prompt, item.topic, item.responses, item.visibility / 100, item.position, item.sentiment, item.status])
  });
  prompts.getColumn(4).numFmt = "0.0%";
  const brands = addDataSheet(workbook, {
    name: "Competitive Landscape",
    title: "Competitive landscape",
    subtitle: "Case-insensitive normalized brand visibility, mentions, position, and sentiment",
    tabColor: OVERVIEW_XL.navySoft,
    widths: [9, 34, 18, 15, 18, 18, 16],
    headers: ["Rank", "Brand", "Visibility %", "Mentions", "Avg. Position", "Sentiment", "Status"],
    rows: model2.brands.map((item) => [item.rank, item.brand, item.visibility / 100, item.mentions, item.position, item.sentiment, item.isOwnBrand ? "Tracked brand" : "Competitor"])
  });
  brands.getColumn(3).numFmt = "0.0%";
  const sources = addDataSheet(workbook, {
    name: "Source Influence",
    title: "Source influence",
    subtitle: "Exact source links, usage, citation counts, and confirmed brand presence",
    tabColor: OVERVIEW_XL.mint,
    widths: [9, 30, 44, 18, 18, 16, 20, 58],
    headers: ["Rank", "Domain", "Title", "Used %", "Source Type", "Citations", "Brand Presence", "URL"],
    rows: model2.sources.map((item) => [
      item.rank,
      item.domain,
      item.title,
      item.usedPct / 100,
      item.sourceType,
      item.citations,
      item.brandPresence === "CONFIRMED" ? "Confirmed" : "Not confirmed",
      { text: item.url, hyperlink: item.url }
    ])
  });
  sources.getColumn(4).numFmt = "0.0%";
  for (let row = 5; row < model2.sources.length + 5; row += 1) {
    sources.getCell(row, 8).font = { name: "Aptos", size: 10, color: { argb: OVERVIEW_XL.blue }, underline: true };
  }
  addDataSheet(workbook, {
    name: "Opportunities",
    title: "Evidence-backed opportunities",
    subtitle: "Prioritized actions derived from stored response evidence",
    tabColor: OVERVIEW_XL.blue,
    widths: [38, 52, 26, 14, 14, 12, 70],
    headers: ["Opportunity", "Prompt", "Competitor", "Impact", "Effort", "Score", "Next Step"],
    rows: model2.opportunities.map((item) => [item.title, item.prompt, item.competitor, item.impact, item.effort, item.score, item.nextStep])
  });
  const evidence = addDataSheet(workbook, {
    name: "Response Evidence",
    title: "Response evidence appendix",
    subtitle: "Recent stored responses included in this report",
    tabColor: OVERVIEW_XL.navySoft,
    widths: [20, 18, 58, 14, 12, 14, 30],
    headers: ["Date", "AI Engine", "Prompt", "Mentioned", "Position", "Sentiment", "Top Source"],
    rows: model2.evidence.map((item) => [item.date, item.engine, item.prompt, item.mentioned ? "Yes" : "No", item.position, item.sentiment, item.source])
  });
  evidence.getColumn(1).numFmt = "dd mmm yyyy";
  const methodology = workbook.addWorksheet("Methodology", { properties: { tabColor: { argb: OVERVIEW_XL.navySoft } } });
  methodology.columns = [{ width: 8 }, { width: 100 }];
  titleBand(methodology, "Methodology and coverage", "Definitions, limits, and data coverage", 2);
  const coverageRows = [
    ["Reporting period", model2.periodLabel],
    ["Active prompts", model2.coverage.activePrompts],
    ["Responses", model2.coverage.responses],
    ["Successful runs", model2.coverage.successfulRuns],
    ["Failed runs", model2.coverage.failedRuns],
    ["Completed jobs", model2.coverage.completedJobs],
    ["Failed jobs", model2.coverage.failedJobs]
  ];
  coverageRows.forEach((item, index) => {
    methodology.getCell(index + 4, 1).value = item[0];
    methodology.getCell(index + 4, 1).font = { name: "Aptos", size: 9, bold: true, color: { argb: OVERVIEW_XL.blue } };
    methodology.getCell(index + 4, 2).value = item[1];
  });
  model2.methodology.forEach((item, index) => {
    const row = methodology.getRow(index + 13);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = item;
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.height = 34;
  });
  methodology.views = [{ state: "normal", showGridLines: false }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// src/features/exports/overview/overview_export_data.ts
init_prisma();

// src/features/opportunities/opportunity_service.ts
init_prisma();

// src/features/opportunities/buyer_intent.ts
var RULES = [
  {
    key: "urgent_local",
    label: "Urgent local decision",
    stage: "DECISION",
    value: "HIGH",
    pattern: /\b(emergency|urgent|today|tonight|open now|near me)\b/i,
    reason: "The buyer is looking for an immediate local provider."
  },
  {
    key: "comparison",
    label: "Brand comparison",
    stage: "DECISION",
    value: "HIGH",
    pattern: /\b(compare|comparison|versus|\bvs\b|better than|alternative|alternatives)\b/i,
    reason: "The buyer is actively choosing between providers."
  },
  {
    key: "price",
    label: "Price and value",
    stage: "DECISION",
    value: "HIGH",
    pattern: /\b(price|pricing|cost|affordable|budget|insurance|cashless|quote)\b/i,
    reason: "The buyer is evaluating affordability and purchase conditions."
  },
  {
    key: "recommendation",
    label: "Best-provider recommendation",
    stage: "CONSIDERATION",
    value: "HIGH",
    pattern: /\b(best|top|recommend|recommended|which .* should|which .* choose)\b/i,
    reason: "The buyer wants an AI-generated shortlist or recommendation."
  },
  {
    key: "trust",
    label: "Trust and reputation",
    stage: "REPUTATION",
    value: "MEDIUM",
    pattern: /\b(review|reviews|trusted|reliable|experienced|safe|good|reputation)\b/i,
    reason: "The buyer is validating trust, proof, and reputation."
  },
  {
    key: "service",
    label: "Service discovery",
    stage: "CONSIDERATION",
    value: "MEDIUM",
    pattern: /\b(service|treatment|solution|provider|company|hospital|clinic|software|agency)\b/i,
    reason: "The buyer is researching providers for a defined need."
  }
];
function classifyBuyerIntent(promptText, promptType) {
  const haystack = `${promptText} ${promptType ?? ""}`;
  const matched = RULES.find((rule) => rule.pattern.test(haystack));
  if (matched) {
    return {
      key: matched.key,
      label: matched.label,
      stage: matched.stage,
      value: matched.value,
      reason: matched.reason
    };
  }
  return {
    key: "informational",
    label: "Category discovery",
    stage: "DISCOVERY",
    value: "LOW",
    reason: "The buyer is learning about the category before forming a shortlist."
  };
}

// src/features/opportunities/opportunity_outcome.ts
function recommendationOutcome(input) {
  if (input.visibility <= 0) return "ABSENT";
  if (input.sentiment !== null && input.sentiment < 45) return "NEGATIVE";
  if (input.position !== null && input.position <= 2.5) return "RECOMMENDED";
  return "LISTED";
}
function outcomeExplanation(outcome) {
  if (outcome === "RECOMMENDED") return "AI places the brand near the top of the answer.";
  if (outcome === "LISTED") return "AI mentions the brand but does not strongly recommend it.";
  if (outcome === "NEGATIVE") return "AI mentions the brand with weak or negative sentiment.";
  return "AI does not include the brand in matching answers.";
}

// src/features/opportunities/opportunity_targeting.ts
var STOP_WORDS = /* @__PURE__ */ new Set([
  "what",
  "which",
  "where",
  "when",
  "with",
  "from",
  "that",
  "this",
  "your",
  "their",
  "best",
  "good",
  "should",
  "choose",
  "near",
  "about",
  "into",
  "have",
  "does",
  "more",
  "hospital",
  "hospitals",
  "clinic",
  "clinics",
  "company",
  "companies",
  "service",
  "services",
  "provider",
  "providers",
  "solution",
  "solutions"
]);
function tokens(value) {
  return new Set(
    value.toLowerCase().replace(/https?:\/\/|www\./g, " ").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
  );
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function selectOpportunityTargetPage(input) {
  const queryTokens = tokens(`${input.promptText} ${input.topic ?? ""}`);
  const topicTokens = tokens(input.topic ?? "");
  const ranked = input.pages.map((page) => {
    const pageTokens = tokens([
      page.url,
      page.title ?? "",
      page.h1 ?? "",
      ...stringArray(page.detected_services),
      ...stringArray(page.detected_locations)
    ].join(" "));
    const overlap = [...queryTokens].filter((token) => pageTokens.has(token)).length;
    const topicOverlap = [...topicTokens].filter((token) => pageTokens.has(token)).length;
    return { page, overlap, topicOverlap };
  }).sort((a, b) => b.topicOverlap - a.topicOverlap || b.overlap - a.overlap);
  const best = ranked[0];
  if (best && (best.topicOverlap >= 1 || best.overlap >= 2)) {
    return {
      status: "EXISTING_PAGE",
      url: best.page.url,
      label: best.page.title || best.page.h1 || best.page.url,
      reason: input.action === "CREATE" ? `A relevant owned page already exists (${best.overlap} matching signals), so improve it instead of creating duplicate content.` : `Closest owned-page match based on ${best.overlap} shared intent signal${best.overlap === 1 ? "" : "s"}.`
    };
  }
  if (input.action === "CREATE") {
    return {
      status: "NEW_PAGE",
      url: null,
      label: "New page on your website",
      reason: "The latest site audit did not find a relevant owned page for this missing buyer intent."
    };
  }
  return {
    status: "REVIEW",
    url: input.brandUrl,
    label: "Review the closest page",
    reason: "The latest site audit did not find a confident page match for this buyer intent."
  };
}

// src/features/opportunities/opportunity_service.ts
function cleanText(value, max = 260) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
function rounded(value) {
  return Number(value.toFixed(1));
}
function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function impactLabel(score) {
  if (score >= 72) return "HIGH";
  if (score >= 42) return "MEDIUM";
  return "LOW";
}
function capImpactForConfidence(score, confidence) {
  if (confidence === "NEEDS_REVIEW") return Math.min(score, 34);
  if (confidence === "LOW") return Math.min(score, 41);
  if (confidence === "MEDIUM") return Math.min(score, 78);
  return score;
}
function effortFor(type, sourceCount) {
  if (type === "MISSING") return "LOW";
  if (type === "SOURCE_GAP" && sourceCount > 2) return "HIGH";
  if (type === "OUTRANKED") return "MEDIUM";
  return "LOW";
}
function opportunityTitle(type, competitor) {
  if (type === "MISSING") return `${competitor} appears where you are missing`;
  if (type === "OUTRANKED") return `${competitor} is ranking ahead`;
  if (type === "SOURCE_GAP") return `Source gap behind ${competitor}`;
  return `${competitor} has stronger sentiment`;
}
function isNoisySearchResult(rawResponse) {
  if (!rawResponse) return false;
  const text = rawResponse.toLowerCase();
  const signals = [
    /\b(videos?|youtube|people also ask|related searches|search results?|sponsored|key moments)\b/.test(text),
    /\b(view all|more results|results for|site links?)\b/.test(text),
    /(?:https?:\/\/|www\.)\S+/.test(text),
    /[a-z0-9-]+\.(com|ai|io|co|org|net|in)\s*[>\u203a]/i.test(rawResponse),
    (rawResponse.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}\b/gi) ?? []).length >= 2,
    (rawResponse.match(/\b(?:google|youtube|linkedin|reddit|g2|capterra)\.[a-z.]+\b/gi) ?? []).length >= 2
  ];
  return signals.filter(Boolean).length >= 2;
}
function hasCompetitorMention(chat, competitorName) {
  return chat.brand_mentions.some((mention) => sameBrandEntity(mention.brand_name, competitorName));
}
function promptIntentWarning(promptText) {
  const text = promptText.toLowerCase();
  if (!/\bgeo\b/.test(text)) return null;
  const aiIntent = /\b(ai visibility|generative engine|answer engine|llm|chatgpt|perplexity|ai search|ai overview|prompt)\b/.test(text);
  const geospatialIntent = /\b(gis|geospatial|map|maps|mapping|location intelligence|spatial|coordinates|wgs84)\b/.test(text);
  if (!aiIntent && !geospatialIntent) {
    return "Prompt intent is ambiguous: GEO could mean generative engine optimization or geospatial software.";
  }
  if (aiIntent && geospatialIntent) {
    return "Prompt mixes AI visibility and geospatial language, so review the raw answer before creating competitor-specific content.";
  }
  return null;
}
function isLowSignalDomain(domain) {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  return /^google\./.test(normalized) || ["youtube.com", "youtu.be"].includes(normalized);
}
function normalizeDomain4(domain) {
  return domain.toLowerCase().replace(/^www\./, "").trim();
}
function classifySource(domain, title, ownBrand, competitorName) {
  const normalized = normalizeDomain4(domain);
  const titleText = (title ?? "").toLowerCase();
  const own = ownBrand.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const competitor = competitorName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const compactDomain = normalized.replace(/[^a-z0-9]+/g, "");
  const noisyDomains = [
    "google.",
    "chatgpt.com",
    "openai.com",
    "gemini.google.com",
    "perplexity.ai",
    "copilot.microsoft.com",
    "bing.com",
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "accounts.google.com",
    "login.",
    "cdn.",
    "cloudfront.net"
  ];
  if (noisyDomains.some((item) => normalized.includes(item))) {
    return {
      actionability: "NOT_ACTIONABLE",
      pattern: "Platform / noisy source",
      recommended_action: "Monitor only. Do not spend time trying to influence this source directly."
    };
  }
  if (own && compactDomain.includes(own) || competitor && compactDomain.includes(competitor)) {
    return {
      actionability: "NOT_ACTIONABLE",
      pattern: compactDomain.includes(own) ? "Owned domain" : "Competitor-owned domain",
      recommended_action: compactDomain.includes(own) ? "Use this as proof your owned content is being found; improve the page if rank is weak." : "Monitor only. Do not try to publish on competitor-owned pages."
    };
  }
  const highIntentDirectories = [
    "google.com/maps",
    "business.google.com",
    "practo.com",
    "justdial.com",
    "sulekha.com",
    "lybrate.com",
    "credihealth.com",
    "apollo247.com",
    "medindia.net",
    "mouthshut.com",
    "indiamart.com",
    "tradeindia.com",
    "g2.com",
    "capterra.com",
    "trustradius.com",
    "producthunt.com",
    "clutch.co",
    "goodfirms.co",
    "trustpilot.com",
    "softwareadvice.com"
  ];
  if (highIntentDirectories.some((item) => normalized.includes(item))) {
    return {
      actionability: "HIGH",
      pattern: "Directory / review source",
      recommended_action: "Claim or optimize the profile, add services/categories, collect reviews, and keep NAP/proof details fresh."
    };
  }
  const communityOrEditorial = [
    "reddit.com",
    "quora.com",
    "medium.com",
    "substack.com",
    "linkedin.com",
    "news18.com",
    "yourstory.com",
    "entrepreneur.com",
    "forbes.com",
    "inc.com",
    "economictimes.indiatimes.com",
    "timesofindia.indiatimes.com",
    "hindustantimes.com",
    "thehindu.com",
    "business-standard.com"
  ];
  if (communityOrEditorial.some((item) => normalized.includes(item)) || /\b(best|top|compare|review|alternatives|guide)\b/.test(titleText)) {
    return {
      actionability: "MEDIUM",
      pattern: "Editorial / community source",
      recommended_action: "Earn mentions through useful comparisons, expert quotes, case studies, PR, or founder/community participation."
    };
  }
  if (/\.(gov|edu)(\.|$)/.test(normalized) || normalized.endsWith(".gov.in") || normalized.endsWith(".edu.in") || titleText.includes("pdf")) {
    return {
      actionability: "LOW",
      pattern: "Authority reference",
      recommended_action: "Use as context and cite it in your own content. Direct influence is usually slow or not practical."
    };
  }
  return {
    actionability: "MEDIUM",
    pattern: "Relevant web source",
    recommended_action: "Review whether the page accepts updates, citations, partnerships, comments, listings, or source-backed outreach."
  };
}
function actionabilityWeight(actionability) {
  if (actionability === "HIGH") return 4;
  if (actionability === "MEDIUM") return 3;
  if (actionability === "LOW") return 2;
  return 1;
}
function overallActionability(sources, type) {
  if (sources.some((source) => source.actionability === "HIGH")) return "HIGH";
  if (sources.some((source) => source.actionability === "MEDIUM")) return "MEDIUM";
  if (type === "MISSING") return "MEDIUM";
  if (sources.some((source) => source.actionability === "LOW")) return "LOW";
  return "NOT_ACTIONABLE";
}
function opportunityBucket(input) {
  if (input.confidence === "NEEDS_REVIEW" || input.actionability === "NOT_ACTIONABLE") return "MONITOR";
  if (input.impact !== "LOW" && input.effort === "LOW" && (input.actionability === "HIGH" || input.type === "MISSING")) return "QUICK_WIN";
  if (input.type === "SOURCE_GAP" || input.sources.some((source) => source.actionability === "HIGH")) return "SOURCE_GAP";
  if (input.sources.some((source) => source.actionability === "LOW")) return "AUTHORITY_GAP";
  return "CONTENT_GAP";
}
function sourcePattern(sources) {
  if (!sources.length) return null;
  const best = [...sources].sort((a, b) => {
    const actionGap = actionabilityWeight(b.actionability) - actionabilityWeight(a.actionability);
    if (actionGap) return actionGap;
    return b.mentions - a.mentions;
  })[0];
  if (!best) return null;
  const rank = best.avg_rank ? ` around rank #${best.avg_rank}` : "";
  return `${best.source_type ?? "Source"} pattern: ${best.domain} appears ${best.mentions} time${best.mentions === 1 ? "" : "s"}${rank}.`;
}
function inferContentType(promptText, type) {
  const text = promptText.toLowerCase();
  if (text.includes("alternative") || text.includes("alternatives")) return "Alternatives page";
  if (text.includes("compare") || text.includes(" vs ") || text.includes("versus")) return "Comparison page";
  if (text.includes("best") || text.includes("top")) return "Best tools / category list";
  if (text.includes("pricing") || text.includes("cost")) return "Pricing and value page";
  if (text.includes("how") || text.includes("what") || text.includes("why")) return "Educational answer page";
  if (type === "SOURCE_GAP") return "Source-backed category page";
  return "Category landing page";
}
function suggestedTitle(promptText, brandName, type) {
  const cleaned = cleanText(promptText, 90).replace(/[?.!]+$/, "");
  const contentType = inferContentType(promptText, type);
  if (contentType === "Alternatives page") return `${brandName} alternatives for ${cleaned.toLowerCase()}`;
  if (contentType === "Comparison page") return `${brandName} vs competitors: ${cleaned}`;
  if (contentType === "Best tools / category list") return `${cleaned}: where ${brandName} fits`;
  if (contentType === "Pricing and value page") return `${brandName} pricing and value for ${cleaned.toLowerCase()}`;
  return `${cleaned}: a practical guide from ${brandName}`;
}
function contentAction(type) {
  if (type === "MISSING") return "CREATE";
  if (type === "SOURCE_GAP") return "REFRESH";
  return "OPTIMIZE";
}
function missingAngles(input) {
  const sourceDomains = input.sources.slice(0, 2).map((source) => source.domain);
  const angles = /* @__PURE__ */ new Set();
  if (input.type === "MISSING") {
    angles.add("Direct answer to the prompt intent");
    if (input.canUseCompetitor) angles.add(`Why buyers compare you with ${input.competitorName}`);
    else angles.add("Buyer criteria: pricing, features, use cases, and proof");
  }
  if (input.type === "OUTRANKED") {
    angles.add("Clearer comparison proof");
    angles.add("Stronger use-case positioning");
  }
  if (input.type === "SOURCE_GAP") {
    angles.add("Third-party source and citation coverage");
    if (sourceDomains.length) angles.add(`Evidence from ${sourceDomains.join(" and ")}`);
  }
  if (input.type === "SENTIMENT_GAP") {
    angles.add("Trust proof, reviews, outcomes, and customer evidence");
  }
  if (input.promptWarning) angles.add("Clarified prompt intent before writing");
  angles.add("Short FAQ answers for AI snippets");
  return Array.from(angles).slice(0, 4);
}
function optimizationFocus(type, sources = []) {
  if (sources.some((source) => source.actionability === "HIGH")) {
    return ["Optimize high-actionability profiles", "Add review proof", "Match service/category language"];
  }
  if (type === "MISSING") {
    return ["Create one focused page", "Add FAQs", "Mention category and use cases"];
  }
  if (type === "OUTRANKED") {
    return ["Improve comparison copy", "Add proof points", "Clarify differentiation"];
  }
  if (type === "SOURCE_GAP") {
    return ["Add credible citations", "Reference source domains", "Improve external proof"];
  }
  return ["Improve tone", "Add customer evidence", "Reduce vague claims"];
}
function buildContentGapPlan(input) {
  const action = contentAction(input.type);
  const contentType = inferContentType(input.promptText, input.type);
  const sourceLabel = input.sources.length ? ` Sources like ${input.sources.slice(0, 2).map((source) => source.domain).join(" and ")} are reinforcing competitor answers.` : "";
  const canUseCompetitor = input.confidence === "HIGH" || input.confidence === "MEDIUM" && input.cleanEvidenceCount >= 2;
  const gapReason = input.promptWarning ? `${input.promptWarning} Treat this as a review item before writing competitor-specific copy.` : input.cleanEvidenceCount === 0 ? `Detected competitor visibility is based on low-confidence answer evidence. Review the raw chats before acting.` : input.type === "MISSING" ? `${input.competitorName} appears for this intent while ${input.brandName} is missing or weak.` : `${input.competitorName} has stronger AI-answer evidence for this intent.${sourceLabel}`;
  return {
    gap_reason: gapReason,
    recommended_content_type: contentType,
    suggested_title: suggestedTitle(input.promptText, input.brandName, input.type),
    action,
    priority_reason: `Impact score ${input.impactScore}; confidence ${input.confidence.toLowerCase()}; competitor visibility ${rounded(input.competitorVisibility)}% vs your ${rounded(input.ownVisibility)}%.`,
    missing_angles: missingAngles({ type: input.type, competitorName: input.competitorName, sources: input.sources, canUseCompetitor, promptWarning: input.promptWarning }),
    optimization_focus: optimizationFocus(input.type, input.sources),
    source_actions: input.sources.filter((source) => source.actionability !== "NOT_ACTIONABLE").slice(0, 3).map((source) => `${source.domain}: ${source.recommended_action}`)
  };
}
function opportunityDescription(input) {
  const competitorVisibility = rounded(input.competitorVisibility);
  const ownVisibility = rounded(input.ownVisibility);
  if (input.type === "OUTRANKED" && input.ownPosition && input.competitorPosition) {
    return `${input.competitorName} ranks at #${rounded(input.competitorPosition)} while your brand ranks at #${rounded(input.ownPosition)} for this prompt.`;
  }
  if (input.type === "SENTIMENT_GAP" && input.ownSentiment && input.competitorSentiment) {
    return `${input.competitorName} has ${rounded(input.competitorSentiment)} sentiment versus your ${rounded(input.ownSentiment)} for matching answers.`;
  }
  if (input.type === "SOURCE_GAP") {
    return `${input.competitorName} is reinforced by stronger source evidence across ${competitorVisibility}% of matching answers.`;
  }
  return `${input.competitorName} is visible in ${competitorVisibility}% of matching answers while your brand appears in ${ownVisibility}%.`;
}
function nextStep(input) {
  const canUseCompetitor = input.confidence === "HIGH" || input.confidence === "MEDIUM" && input.cleanEvidenceCount >= 2;
  if (input.promptWarning) {
    return "Clarify whether this prompt means AI visibility/GEO or geospatial SaaS before creating content. If targeting AI visibility, create a focused best-tools page with pricing/value, supported engines, FAQs, and credible citations.";
  }
  if (input.cleanEvidenceCount === 0) {
    return "Review the raw answers first. If the competitor mention is valid, create a focused page that answers the prompt with buyer criteria, pricing/value, proof, FAQs, and credible citations.";
  }
  if (input.type === "SOURCE_GAP" && input.sources.length) {
    const actionable = input.sources.find((source) => source.actionability === "HIGH" || source.actionability === "MEDIUM") ?? input.sources[0];
    return `Prioritize ${actionable.domain}: ${actionable.recommended_action}`;
  }
  if (input.type === "MISSING" && canUseCompetitor) {
    return `Create or refresh a page that directly answers this prompt, then make sure ${input.competitor} comparison language is covered honestly.`;
  }
  if (input.type === "OUTRANKED" && canUseCompetitor) {
    return `Strengthen the prompt intent with clearer positioning, proof points, and comparison copy against ${input.competitor}.`;
  }
  return "Create or refresh a focused page that directly answers this prompt, covers buyer criteria, pricing/value, use cases, proof, FAQs, and cites credible sources.";
}
async function loadOpportunityChats(project_id, filters) {
  return prisma_default.chat.findMany({
    where: buildChatWhere(project_id, filters),
    include: {
      prompt: {
        select: {
          id: true,
          text: true,
          topic: true,
          type: true
        }
      },
      brand_mentions: {
        select: {
          brand_name: true,
          domain: true,
          position: true,
          sentiment_score: true
        }
      },
      sources: {
        select: {
          url: true,
          domain: true,
          title: true,
          source_type: true,
          is_cited: true,
          source_kind: true,
          source_position: true,
          answer_position: true
        }
      }
    },
    orderBy: { created_at: "desc" }
  });
}
function cleanCompetitorChats(chats, competitorName) {
  return chats.filter((chat) => hasCompetitorMention(chat, competitorName) && !isNoisySearchResult(chat.raw_response));
}
function confidenceForOpportunity(input) {
  const reasons = [];
  let confidence = "HIGH";
  if (input.promptWarning) reasons.push(input.promptWarning);
  if (input.cleanEvidenceCount === 0) reasons.push("Competitor appears only in noisy or low-confidence answer evidence.");
  if (input.noisyEvidenceCount > 0) reasons.push(`${input.noisyEvidenceCount} answer${input.noisyEvidenceCount === 1 ? "" : "s"} look like search-result scrape noise.`);
  if (input.sourceCount === 0) reasons.push("No clean cited source pattern supports this competitor gap yet.");
  if (input.evidenceCount < 2) reasons.push("Only one matching answer supports this opportunity.");
  if (input.promptWarning || input.cleanEvidenceCount === 0) confidence = "NEEDS_REVIEW";
  else if (input.cleanEvidenceCount === 1 || input.evidenceCount < 3 || input.sourceCount === 0) confidence = "LOW";
  else if (input.cleanEvidenceCount < Math.max(2, Math.ceil(input.totalChats * 0.4))) confidence = "MEDIUM";
  return {
    confidence,
    reasons: reasons.slice(0, 3)
  };
}
function sourceEvidence(chats, competitorName, brandName, cleanOnly = false) {
  const domainMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const competitorWasMentioned = hasCompetitorMention(chat, competitorName);
    if (!competitorWasMentioned) continue;
    if (cleanOnly && isNoisySearchResult(chat.raw_response)) continue;
    const uniqueDomains = /* @__PURE__ */ new Set();
    for (const source of chat.sources) {
      if (!source.domain || uniqueDomains.has(source.domain)) continue;
      if (cleanOnly && isLowSignalDomain(source.domain)) continue;
      uniqueDomains.add(source.domain);
      const existing = domainMap.get(source.domain);
      const classified = classifySource(source.domain, source.title, brandName, competitorName);
      const rank = source.answer_position ?? source.source_position ?? null;
      domainMap.set(source.domain, {
        domain: source.domain,
        url: existing?.url ?? source.url ?? null,
        title: existing?.title ?? source.title ?? null,
        source_type: existing?.source_type ?? source.source_type ?? classified.pattern,
        mentions: (existing?.mentions ?? 0) + 1,
        citations: (existing?.citations ?? 0) + (source.is_cited ? 1 : 0),
        avg_rank: null,
        source_kind: existing?.source_kind ?? source.source_kind ?? null,
        actionability: existing?.actionability ?? classified.actionability,
        recommended_action: existing?.recommended_action ?? classified.recommended_action,
        rankTotal: (existing?.rankTotal ?? 0) + (rank ?? 0),
        rankCount: (existing?.rankCount ?? 0) + (rank !== null ? 1 : 0)
      });
    }
  }
  return Array.from(domainMap.values()).map((source) => ({
    domain: source.domain,
    url: source.url,
    title: source.title,
    source_type: source.source_type,
    mentions: source.mentions,
    citations: source.citations,
    avg_rank: source.rankCount ? rounded(source.rankTotal / source.rankCount) : null,
    source_kind: source.source_kind,
    actionability: source.actionability,
    recommended_action: source.recommended_action
  })).sort((a, b) => {
    const actionGap = actionabilityWeight(b.actionability) - actionabilityWeight(a.actionability);
    if (actionGap) return actionGap;
    const citationGap = b.citations - a.citations;
    if (citationGap) return citationGap;
    return b.mentions - a.mentions;
  }).slice(0, 4);
}
function buildOpportunity(input) {
  const sources = sourceEvidence(input.promptChats, input.competitorName, input.brandName, true);
  const cleanChats = cleanCompetitorChats(input.promptChats, input.competitorName);
  const noisyEvidenceCount = input.promptChats.filter((chat) => hasCompetitorMention(chat, input.competitorName) && isNoisySearchResult(chat.raw_response)).length;
  const promptWarning = promptIntentWarning(input.prompt.text);
  const confidenceResult = confidenceForOpportunity({
    promptWarning,
    totalChats: input.totalChats,
    cleanEvidenceCount: cleanChats.length,
    evidenceCount: input.totalChats,
    sourceCount: sources.length,
    noisyEvidenceCount
  });
  const visibilityGap = Math.max(0, input.competitorVisibility - input.ownVisibility);
  const rankGap = input.ownPosition && input.competitorPosition ? Math.max(0, input.ownPosition - input.competitorPosition) * 8 : 0;
  const sentimentGap = input.ownSentiment && input.competitorSentiment ? Math.max(0, input.competitorSentiment - input.ownSentiment) * 0.4 : 0;
  const evidenceBoost = Math.min(16, input.totalChats * 3);
  const rawImpactScore = Math.min(100, Math.round(visibilityGap * 1.15 + rankGap + sentimentGap + evidenceBoost + sources.length * 3));
  const impactScore = capImpactForConfidence(rawImpactScore, confidenceResult.confidence);
  const effort = effortFor(input.type, sources.filter((source) => source.actionability !== "NOT_ACTIONABLE").length);
  const actionability = overallActionability(sources, input.type);
  const impact = impactLabel(impactScore);
  const bucket = opportunityBucket({
    type: input.type,
    effort,
    impact,
    actionability,
    sources,
    confidence: confidenceResult.confidence
  });
  const sample = input.promptChats.find(
    (chat) => hasCompetitorMention(chat, input.competitorName)
  )?.raw_response;
  const buyerIntent = classifyBuyerIntent(input.prompt.text, input.prompt.type);
  const brandOutcome = recommendationOutcome({
    visibility: input.ownVisibility,
    position: input.ownPosition,
    sentiment: input.ownSentiment
  });
  const competitorOutcome = recommendationOutcome({
    visibility: input.competitorVisibility,
    position: input.competitorPosition,
    sentiment: input.competitorSentiment
  });
  const contentGap = buildContentGapPlan({
    type: input.type,
    promptText: input.prompt.text,
    brandName: input.brandName,
    competitorName: input.competitorName,
    ownVisibility: input.ownVisibility,
    competitorVisibility: input.competitorVisibility,
    sources,
    impactScore,
    confidence: confidenceResult.confidence,
    confidenceReasons: confidenceResult.reasons,
    cleanEvidenceCount: cleanChats.length,
    promptWarning
  });
  const targetPage = selectOpportunityTargetPage({
    promptText: input.prompt.text,
    topic: input.prompt.topic,
    action: contentGap.action,
    brandUrl: input.brandUrl,
    pages: input.sitePages
  });
  if (targetPage.status === "EXISTING_PAGE" && contentGap.action === "CREATE") {
    contentGap.action = "OPTIMIZE";
    contentGap.priority_reason = `${contentGap.priority_reason} A relevant owned page already exists, so optimize that page instead of creating a duplicate.`;
  }
  const supportingUrls = [...new Set(sources.map((source) => source.url).filter((url) => Boolean(url)))].slice(0, 5);
  return {
    id: `${input.prompt.id}-${input.competitorName}-${input.type}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    type: input.type,
    title: opportunityTitle(input.type, input.competitorName),
    description: opportunityDescription(input),
    prompt_id: input.prompt.id,
    prompt_text: input.prompt.text,
    topic: input.prompt.topic,
    buyer_intent: buyerIntent,
    competitor_name: input.competitorName,
    brand_outcome: brandOutcome,
    competitor_outcome: competitorOutcome,
    outcome_explanation: outcomeExplanation(brandOutcome),
    own_visibility: rounded(input.ownVisibility),
    competitor_visibility: rounded(input.competitorVisibility),
    own_position: input.ownPosition ? rounded(input.ownPosition) : null,
    competitor_position: input.competitorPosition ? rounded(input.competitorPosition) : null,
    own_sentiment: input.ownSentiment ? rounded(input.ownSentiment) : null,
    competitor_sentiment: input.competitorSentiment ? rounded(input.competitorSentiment) : null,
    impact_score: impactScore,
    impact,
    effort,
    evidence_count: input.totalChats,
    clean_evidence_count: cleanChats.length,
    confidence: confidenceResult.confidence,
    confidence_reasons: confidenceResult.reasons,
    prompt_intent_warning: promptWarning,
    opportunity_bucket: bucket,
    actionability,
    source_pattern: sourcePattern(sources),
    top_sources: sources,
    content_gap: contentGap,
    target_page: targetPage,
    supporting_urls: supportingUrls,
    business_reason: buyerIntent.value === "HIGH" ? `This ${buyerIntent.label.toLowerCase()} prompt can influence a near-term buyer decision. ${input.competitorName} currently has the stronger AI outcome.` : `This prompt shapes ${buyerIntent.stage.toLowerCase()} visibility and can influence which brands enter the buyer's shortlist.`,
    verification: {
      baseline: {
        visibility: rounded(input.ownVisibility),
        position: input.ownPosition ? rounded(input.ownPosition) : null,
        outcome: brandOutcome
      },
      success_metric: brandOutcome === "ABSENT" ? "Move from absent to listed or recommended in the tracked AI answers." : `Improve visibility above ${rounded(input.ownVisibility)}% or average position above ${input.ownPosition ? `#${rounded(input.ownPosition)}` : "the current baseline"}.`,
      recheck_after_days: contentGap.action === "CREATE" ? 14 : 7
    },
    next_step: nextStep({
      type: input.type,
      competitor: input.competitorName,
      sources,
      confidence: confidenceResult.confidence,
      cleanEvidenceCount: cleanChats.length,
      promptWarning
    }),
    sample_response: sample ? cleanText(sample, 320) : null
  };
}
async function getOpportunities(project_id, filters = {}) {
  const [project, chats] = await Promise.all([
    prisma_default.project.findUniqueOrThrow({
      where: { id: project_id },
      include: {
        competitors: { select: { name: true } },
        seo_audits: {
          take: 1,
          orderBy: { created_at: "desc" },
          select: {
            pages: {
              select: {
                url: true,
                title: true,
                h1: true,
                detected_services: true,
                detected_locations: true
              }
            }
          }
        }
      }
    }),
    loadOpportunityChats(project_id, filters)
  ]);
  if (!chats.length) {
    return {
      summary: { total: 0, high_impact: 0, quick_wins: 0, create_pages: 0, refresh_pages: 0, competitor_gaps: 0, source_gaps: 0, sentiment_gaps: 0 },
      opportunities: []
    };
  }
  const trackedCompetitors = project.competitors.map((competitor) => competitor.name);
  const promptMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const rows = promptMap.get(chat.prompt.id) ?? [];
    rows.push(chat);
    promptMap.set(chat.prompt.id, rows);
  }
  const opportunities = [];
  for (const promptChats of promptMap.values()) {
    const total = promptChats.length;
    const prompt = promptChats[0].prompt;
    const ownMentionChats = promptChats.filter((chat) => chat.brand_mentioned);
    const ownVisibility = ownMentionChats.length / total * 100;
    const ownPosition = avg(ownMentionChats.map((chat) => chat.brand_position).filter((value) => value !== null));
    const ownSentiment = avg(ownMentionChats.map((chat) => chat.sentiment_score).filter((value) => value !== null));
    const competitorMap = /* @__PURE__ */ new Map();
    for (const chat of promptChats) {
      const seenInChat = /* @__PURE__ */ new Set();
      for (const mention of chat.brand_mentions) {
        const name = sanitizeDiscoveredBrandName(mention.brand_name);
        if (!name || !isEligibleCompetitorEntity({
          name,
          domain: mention.domain,
          ownBrandName: project.brand_name,
          ownBrandUrl: project.brand_url
        })) continue;
        const trackedName = trackedCompetitors.find((competitor) => sameBrandEntity(name, competitor));
        if (trackedCompetitors.length && !trackedName) continue;
        const canonicalName = trackedName ?? name;
        const canonicalKey = canonicalName.toLowerCase();
        if (seenInChat.has(canonicalKey)) continue;
        seenInChat.add(canonicalKey);
        const current = competitorMap.get(canonicalName) ?? { count: 0, positions: [], sentiments: [] };
        current.count += 1;
        if (mention.position !== null) current.positions.push(mention.position);
        if (mention.sentiment_score !== null) current.sentiments.push(mention.sentiment_score);
        competitorMap.set(canonicalName, current);
      }
    }
    for (const [competitorName, competitor] of competitorMap.entries()) {
      const competitorVisibility = competitor.count / total * 100;
      const competitorPosition = avg(competitor.positions);
      const competitorSentiment = avg(competitor.sentiments);
      const sourceCount = sourceEvidence(promptChats, competitorName, project.brand_name, true).filter((source) => source.actionability !== "NOT_ACTIONABLE").length;
      const visibilityGap = competitorVisibility - ownVisibility;
      const rankGap = ownPosition !== null && competitorPosition !== null ? ownPosition - competitorPosition : 0;
      const sentimentGap = ownSentiment !== null && competitorSentiment !== null ? competitorSentiment - ownSentiment : 0;
      let type = null;
      if (ownVisibility === 0 && competitorVisibility > 0) type = "MISSING";
      else if (rankGap >= 0.75) type = "OUTRANKED";
      else if (sourceCount >= 2 && visibilityGap >= 8) type = "SOURCE_GAP";
      else if (sentimentGap >= 10) type = "SENTIMENT_GAP";
      else if (visibilityGap >= 18) type = "SOURCE_GAP";
      if (!type) continue;
      opportunities.push(buildOpportunity({
        type,
        promptChats,
        prompt,
        brandName: project.brand_name,
        competitorName,
        ownVisibility,
        competitorVisibility,
        ownPosition,
        competitorPosition,
        ownSentiment,
        competitorSentiment,
        totalChats: total,
        brandUrl: project.brand_url,
        sitePages: project.seo_audits[0]?.pages ?? []
      }));
    }
  }
  const unique2 = Array.from(new Map(opportunities.map((item) => [item.id, item])).values()).sort((a, b) => b.impact_score - a.impact_score).slice(0, 60);
  return {
    summary: {
      total: unique2.length,
      high_impact: unique2.filter((item) => item.impact === "HIGH").length,
      quick_wins: unique2.filter((item) => item.impact !== "LOW" && item.effort === "LOW").length,
      create_pages: unique2.filter((item) => item.content_gap.action === "CREATE").length,
      refresh_pages: unique2.filter((item) => item.content_gap.action === "REFRESH" || item.content_gap.action === "OPTIMIZE").length,
      competitor_gaps: unique2.filter((item) => item.type === "MISSING" || item.type === "OUTRANKED").length,
      source_gaps: unique2.filter((item) => item.type === "SOURCE_GAP").length,
      sentiment_gaps: unique2.filter((item) => item.type === "SENTIMENT_GAP").length
    },
    opportunities: unique2
  };
}

// src/features/exports/overview/overview_export_model.ts
function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function buildActionPlan(input) {
  const actions = [];
  const weakestPrompt = [...input.prompts].sort((a, b) => a.visibility - b.visibility)[0];
  const weakestEngine = [...input.engines].sort((a, b) => a.visibility - b.visibility)[0];
  const topUnconfirmed = input.sources.find((source) => source.brandPresence === "NOT_CONFIRMED");
  const own = input.competitors.find((brand) => brand.isOwnBrand);
  const topCompetitor = input.competitors.find((brand) => !brand.isOwnBrand);
  for (const opportunity of input.opportunities.slice(0, 2)) {
    actions.push({
      priority: opportunity.score >= 70 ? "HIGH" : "MEDIUM",
      horizon: actions.length ? "NEXT" : "NOW",
      title: opportunity.title,
      rationale: opportunity.prompt,
      action: opportunity.nextStep,
      evidence: `Evidence-backed opportunity score ${Math.round(opportunity.score)}.`
    });
  }
  if (weakestPrompt) {
    actions.push({
      priority: weakestPrompt.visibility < 35 ? "HIGH" : "MEDIUM",
      horizon: "NOW",
      title: `Improve coverage for \u201C${weakestPrompt.prompt}\u201D`,
      rationale: `This prompt has ${weakestPrompt.visibility.toFixed(1)}% visibility across ${weakestPrompt.responses} measured responses.`,
      action: "Create or strengthen the page that directly answers this buyer question, then reinforce it with proof, comparisons, FAQs, and structured data.",
      evidence: `Average position ${weakestPrompt.position === null ? "not established" : `#${weakestPrompt.position.toFixed(1)}`}; topic ${weakestPrompt.topic || "Uncategorized"}.`
    });
  }
  if (weakestEngine) {
    actions.push({
      priority: weakestEngine.visibility < 35 ? "HIGH" : "MEDIUM",
      horizon: "NEXT",
      title: `Close the ${weakestEngine.engine} visibility gap`,
      rationale: `${weakestEngine.engine} is the weakest measured engine at ${weakestEngine.visibility.toFixed(1)}% visibility.`,
      action: "Review the sources and answer patterns used by this engine, then target the most repeated third-party domains and missing answer themes.",
      evidence: `${weakestEngine.responses} responses and ${weakestEngine.sourceDomains} distinct source domains measured.`
    });
  }
  if (topUnconfirmed) {
    actions.push({
      priority: "MEDIUM",
      horizon: "NEXT",
      title: `Build verified presence on ${topUnconfirmed.domain}`,
      rationale: `The domain appears in ${topUnconfirmed.usedPct.toFixed(1)}% of measured responses, but structured source evidence does not confirm the tracked brand.`,
      action: "Pursue an editorial mention, profile, comparison inclusion, review, or evidence-led contribution appropriate to the domain.",
      evidence: "Source priority is based on measured citation frequency, not inferred brand presence."
    });
  }
  if (own && topCompetitor) {
    actions.push({
      priority: topCompetitor.visibility >= own.visibility ? "HIGH" : "MEDIUM",
      horizon: "LATER",
      title: `Defend the lead against ${topCompetitor.brand}`,
      rationale: `${input.brandName} is at ${own.visibility.toFixed(1)}% visibility versus ${topCompetitor.brand} at ${topCompetitor.visibility.toFixed(1)}%.`,
      action: "Track the prompts and sources where the competitor appears without the brand, then turn the highest-value gaps into content and authority campaigns.",
      evidence: `${Math.abs(own.visibility - topCompetitor.visibility).toFixed(1)} percentage-point visibility difference.`
    });
  }
  const unique2 = new Map(actions.map((action) => [action.title, action]));
  return [...unique2.values()].slice(0, 6);
}
function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return usable.length ? round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : null;
}
function percent(part, total) {
  return total > 0 ? round(part / total * 100) : 0;
}
function canonicalBrandKey(value) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
function displayEngine(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("chatgpt") || normalized.includes("openai")) return "ChatGPT";
  if (normalized.includes("gemini") || normalized.includes("google")) return "Gemini";
  if (normalized.includes("perplexity")) return "Perplexity";
  if (normalized.includes("copilot") || normalized.includes("bing")) return "Copilot";
  return value.trim() || "Unknown";
}
function promptStatus(visibility) {
  if (visibility >= 70) return "LEADER";
  if (visibility >= 35) return "OPPORTUNITY";
  return "GAP";
}
function metric(input) {
  const rawDelta = input.previous === null ? null : input.value - input.previous;
  return { ...input, delta: rawDelta === null ? null : round(rawDelta) };
}
function buildExecutiveNarrative(input) {
  const visibility = input.metrics.find((item) => item.label === "Brand visibility");
  const position = input.metrics.find((item) => item.label === "Average position");
  const bestEngine = [...input.engines].sort((a, b) => b.visibility - a.visibility)[0];
  const gaps = input.prompts.filter((prompt) => prompt.status === "GAP").length;
  const movement = visibility?.delta ?? null;
  const direction = movement === null ? "No previous-period comparison is available." : movement >= 0 ? `Visibility improved by ${Math.abs(movement).toFixed(1)} points versus the previous period.` : `Visibility declined by ${Math.abs(movement).toFixed(1)} points versus the previous period.`;
  return {
    executiveHeadline: `${input.brandName} is visible in ${(visibility?.value ?? 0).toFixed(1)}% of analyzed AI responses${position ? ` at an average position of #${position.value.toFixed(1)}` : ""}.`,
    executivePoints: [
      direction,
      bestEngine ? `${bestEngine.engine} is the strongest measured engine at ${bestEngine.visibility.toFixed(1)}% visibility.` : "No engine-level response data is available for this period.",
      gaps ? `${gaps} tracked prompt${gaps === 1 ? "" : "s"} currently sit in the visibility gap tier.` : "No tracked prompts fall into the visibility gap tier.",
      input.competitorName ? `${input.competitorName} is the strongest measured competitor in this response set.` : "No competitor has enough measured evidence for comparison.",
      input.opportunities ? `${input.opportunities} evidence-backed opportunities are ready for prioritization.` : "Continue collecting responses before prioritizing opportunity work."
    ]
  };
}

// src/features/exports/overview/overview_export_data.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function periodStart(days) {
  return days ? new Date(Date.now() - days * DAY_MS) : null;
}
function chatWhere(projectId, filters, dateRange) {
  return {
    prompt: {
      project_id: projectId,
      ...filters.topic ? { topic: filters.topic } : {}
    },
    ...dateRange ? { created_at: dateRange } : filters.days ? { created_at: { gte: periodStart(filters.days) } } : {},
    ...filters.model ? { ai_model: { contains: filters.model, mode: "insensitive" } } : {},
    ...filters.q ? {
      OR: [
        { prompt: { text: { contains: filters.q, mode: "insensitive" } } },
        { raw_response: { contains: filters.q, mode: "insensitive" } },
        { sources: { some: { domain: { contains: filters.q, mode: "insensitive" } } } }
      ]
    } : {}
  };
}
function ownStats(chats) {
  const mentioned = chats.filter((chat) => chat.brand_mentioned);
  return {
    total: chats.length,
    mentioned: mentioned.length,
    visibility: percent(mentioned.length, chats.length),
    position: average(mentioned.map((chat) => chat.brand_position)),
    sentiment: average(mentioned.map((chat) => chat.sentiment_score)),
    domains: new Set(chats.flatMap((chat) => chat.sources.map((source) => source.domain))).size
  };
}
function toBrandList(chats, ownBrand, ownBrandUrl) {
  const total = chats.length;
  const ownKey = canonicalBrandKey(ownBrand);
  const map = /* @__PURE__ */ new Map();
  const ensure = (label, own2 = false) => {
    const key = own2 ? ownKey : canonicalBrandKey(label);
    const existing = map.get(key);
    if (existing) {
      if (own2) existing.own = true;
      return existing;
    }
    const created = { label: own2 ? ownBrand : label.trim(), chats: /* @__PURE__ */ new Set(), positions: [], sentiments: [], own: own2 };
    map.set(key, created);
    return created;
  };
  const own = ensure(ownBrand, true);
  for (const chat of chats) {
    if (chat.brand_mentioned) {
      own.chats.add(chat.id);
      if (chat.brand_position !== null) own.positions.push(chat.brand_position);
      if (chat.sentiment_score !== null) own.sentiments.push(chat.sentiment_score);
    }
    for (const mention of chat.brand_mentions) {
      const isOwn = canonicalBrandKey(mention.brand_name) === ownKey;
      if (!isOwn && !isEligibleCompetitorEntity({
        name: mention.brand_name,
        domain: mention.domain,
        ownBrandName: ownBrand,
        ownBrandUrl
      })) continue;
      const item = ensure(mention.brand_name, isOwn);
      item.chats.add(chat.id);
      if (mention.position !== null) item.positions.push(mention.position);
      if (mention.sentiment_score !== null) item.sentiments.push(mention.sentiment_score);
    }
  }
  return [...map.values()].map((item) => ({
    rank: 0,
    brand: item.own ? ownBrand : item.label,
    visibility: percent(item.chats.size, total),
    mentions: item.chats.size,
    position: average(item.positions),
    sentiment: average(item.sentiments),
    isOwnBrand: item.own
  })).sort((a, b) => b.visibility - a.visibility || a.brand.localeCompare(b.brand)).slice(0, 12).map((item, index) => ({ ...item, rank: index + 1 }));
}
function toEngineList(chats) {
  const groups = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const engine = displayEngine(chat.ai_model);
    groups.set(engine, [...groups.get(engine) ?? [], chat]);
  }
  return [...groups.entries()].map(([engine, rows]) => {
    const stats = ownStats(rows);
    return {
      engine,
      responses: rows.length,
      visibility: stats.visibility,
      position: stats.position,
      sentiment: stats.sentiment,
      sourceDomains: stats.domains
    };
  }).sort((a, b) => b.responses - a.responses || b.visibility - a.visibility);
}
function toPromptList(chats) {
  const groups = /* @__PURE__ */ new Map();
  for (const chat of chats) groups.set(chat.prompt_id, [...groups.get(chat.prompt_id) ?? [], chat]);
  return [...groups.entries()].map(([promptId, rows]) => {
    const stats = ownStats(rows);
    return {
      promptId,
      prompt: rows[0].prompt.text,
      topic: rows[0].prompt.topic || "Uncategorized",
      responses: rows.length,
      visibility: stats.visibility,
      position: stats.position,
      sentiment: stats.sentiment,
      status: promptStatus(stats.visibility)
    };
  }).sort((a, b) => a.visibility - b.visibility || b.responses - a.responses).slice(0, 30);
}
function stringArray2(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function toSourceList(chats, ownBrand) {
  const ownKey = canonicalBrandKey(ownBrand);
  const map = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const source of chat.sources) {
      const key = source.domain.trim().toLowerCase();
      if (!key) continue;
      const item = map.get(key) ?? {
        chats: /* @__PURE__ */ new Set(),
        title: source.title ?? "",
        type: source.source_type,
        citations: 0,
        url: source.url,
        confirmed: false
      };
      item.chats.add(chat.id);
      if (!item.title && source.title) item.title = source.title;
      if (source.is_cited) item.citations += 1;
      if (stringArray2(source.mentioned_brands).some((name) => canonicalBrandKey(name) === ownKey)) item.confirmed = true;
      map.set(key, item);
    }
  }
  return [...map.entries()].map(([domain, item]) => ({
    rank: 0,
    domain,
    title: item.title,
    usedPct: percent(item.chats.size, chats.length),
    sourceType: item.type,
    citations: item.citations,
    url: item.url || `https://${domain}`,
    brandPresence: item.confirmed ? "CONFIRMED" : "NOT_CONFIRMED"
  })).sort((a, b) => b.usedPct - a.usedPct || b.citations - a.citations).slice(0, 30).map((item, index) => ({ ...item, rank: index + 1 }));
}
function toTrend(chats) {
  const days = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const date = chat.run.ran_at.toISOString().slice(0, 10);
    days.set(date, [...days.get(date) ?? [], chat]);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({ date, visibility: ownStats(rows).visibility, responses: rows.length })).slice(-30);
}
function toTopicList(chats) {
  const groups = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const topic = chat.prompt.topic?.trim() || "Uncategorized";
    groups.set(topic, [...groups.get(topic) ?? [], chat]);
  }
  return [...groups.entries()].map(([topic, rows]) => {
    const stats = ownStats(rows);
    return {
      topic,
      prompts: new Set(rows.map((row) => row.prompt_id)).size,
      responses: rows.length,
      visibility: stats.visibility,
      position: stats.position
    };
  }).sort((a, b) => b.responses - a.responses || b.visibility - a.visibility);
}
function toSourceTypes(sources) {
  const groups = /* @__PURE__ */ new Map();
  for (const source of sources) {
    groups.set(source.sourceType, [...groups.get(source.sourceType) ?? [], source]);
  }
  return [...groups.entries()].map(([sourceType, rows]) => ({
    sourceType,
    domains: rows.length,
    citations: rows.reduce((sum, row) => sum + row.citations, 0),
    confirmedDomains: rows.filter((row) => row.brandPresence === "CONFIRMED").length
  })).sort((a, b) => b.citations - a.citations);
}
function toSentiment(chats) {
  const scores = chats.map((chat) => chat.sentiment_score).filter((value) => typeof value === "number" && Number.isFinite(value));
  return {
    scoredResponses: scores.length,
    positive: scores.filter((score) => score >= 67).length,
    neutral: scores.filter((score) => score >= 34 && score < 67).length,
    negative: scores.filter((score) => score < 34).length,
    average: average(scores)
  };
}
async function getOverviewExportModel(projectId, filters) {
  const start = periodStart(filters.days);
  const previousRange = filters.days && start ? { gte: new Date(start.getTime() - filters.days * DAY_MS), lt: start } : null;
  const [project, chats, previousChats, activePrompts, runs, jobs, opportunityResult] = await Promise.all([
    prisma_default.project.findUniqueOrThrow({ where: { id: projectId }, select: { brand_name: true, brand_url: true } }),
    prisma_default.chat.findMany({
      where: chatWhere(projectId, filters),
      include: { prompt: true, brand_mentions: true, sources: true, run: { select: { ran_at: true } } },
      orderBy: { created_at: "asc" },
      take: 5e3
    }),
    previousRange ? prisma_default.chat.findMany({
      where: chatWhere(projectId, { ...filters, days: void 0 }, previousRange),
      include: { prompt: true, brand_mentions: true, sources: true, run: { select: { ran_at: true } } },
      orderBy: { created_at: "asc" },
      take: 5e3
    }) : Promise.resolve([]),
    prisma_default.prompt.count({ where: { project_id: projectId, is_active: true } }),
    prisma_default.run.groupBy({
      by: ["status"],
      where: { project_id: projectId, ...start ? { ran_at: { gte: start } } : {} },
      _count: { _all: true }
    }),
    prisma_default.scrapeJob.groupBy({
      by: ["status"],
      where: { project_id: projectId, ...start ? { created_at: { gte: start } } : {} },
      _count: { _all: true }
    }),
    getOpportunities(projectId, {
      days: filters.days,
      model: filters.model,
      topic: filters.topic,
      q: filters.q
    }).catch(() => ({ summary: { total: 0 }, opportunities: [] }))
  ]);
  const current = ownStats(chats);
  const previous = previousChats.length ? ownStats(previousChats) : null;
  const metrics = [
    metric({ label: "AI responses", value: current.total, previous: previous?.total ?? null, description: "Successful analyzed responses", format: "number" }),
    metric({ label: "Brand visibility", value: current.visibility, previous: previous?.visibility ?? null, description: "Responses mentioning the brand", format: "percent" }),
    metric({ label: "Average position", value: current.position ?? 0, previous: previous?.position ?? null, description: "Rank when the brand appears", format: "position", lowerIsBetter: true }),
    metric({ label: "Sentiment score", value: current.sentiment ?? 0, previous: previous?.sentiment ?? null, description: "Average measured brand sentiment", format: "score" }),
    metric({ label: "Source domains", value: current.domains, previous: previous?.domains ?? null, description: "Distinct domains in answers", format: "number" })
  ];
  const engines = toEngineList(chats);
  const prompts = toPromptList(chats);
  const topics = toTopicList(chats);
  const brands = toBrandList(chats, project.brand_name, project.brand_url);
  const sources = toSourceList(chats, project.brand_name);
  const sourceTypes = toSourceTypes(sources);
  const sentiment = toSentiment(chats);
  const opportunities = opportunityResult.opportunities.slice(0, 10).map((item) => ({
    title: item.title,
    prompt: item.prompt_text,
    competitor: item.competitor_name,
    impact: item.impact,
    effort: item.effort,
    score: round(item.impact_score),
    nextStep: item.next_step
  }));
  const topCompetitor = brands.find((brand) => !brand.isOwnBrand)?.brand ?? null;
  const narrative = buildExecutiveNarrative({
    brandName: project.brand_name,
    metrics,
    engines,
    prompts,
    competitorName: topCompetitor,
    opportunities: opportunities.length
  });
  const runCount = (status) => runs.find((row) => row.status === status)?._count._all ?? 0;
  const jobCount = (status) => jobs.find((row) => row.status === status)?._count._all ?? 0;
  const actions = buildActionPlan({
    brandName: project.brand_name,
    engines,
    prompts,
    sources,
    competitors: brands,
    opportunities
  });
  return {
    brandName: project.brand_name,
    brandUrl: project.brand_url,
    generatedAt: /* @__PURE__ */ new Date(),
    filters,
    periodLabel: filters.days ? `Last ${filters.days} days` : "All available data",
    comparisonLabel: filters.days ? `Previous ${filters.days} days` : null,
    metrics,
    trend: toTrend(chats),
    engines,
    prompts,
    topics,
    brands,
    sources,
    sourceTypes,
    sentiment,
    opportunities,
    actions,
    evidence: [...chats].reverse().slice(0, 24).map((chat) => ({
      date: chat.run.ran_at,
      engine: displayEngine(chat.ai_model),
      prompt: chat.prompt.text,
      mentioned: chat.brand_mentioned,
      position: chat.brand_position,
      sentiment: chat.sentiment_score,
      source: chat.sources.find((source) => source.is_cited)?.domain ?? chat.sources[0]?.domain ?? ""
    })),
    coverage: {
      activePrompts,
      representedPrompts: new Set(chats.map((chat) => chat.prompt_id)).size,
      responses: chats.length,
      successfulRuns: runCount("SUCCESS"),
      partialRuns: runCount("PARTIAL_SUCCESS"),
      failedRuns: runCount("FAILED"),
      completedJobs: jobCount("SUCCESS"),
      failedJobs: jobCount("FAILED") + jobCount("MANUAL_NEEDED") + jobCount("RATE_LIMITED"),
      firstResponseAt: chats[0]?.created_at ?? null,
      lastResponseAt: chats.at(-1)?.created_at ?? null
    },
    ...narrative,
    methodology: [
      "Visibility is the share of successfully analyzed AI responses that mention the tracked brand.",
      "Average position is calculated only for responses where the tracked brand is present; lower is better.",
      "Brand names are normalized case-insensitively before aggregation to prevent duplicate leaderboard entries.",
      "Engine, prompt, competitor, sentiment, and source metrics reuse stored response evidence; this export makes no new provider or LLM calls.",
      "Confirmed source brand presence is shown only when structured source metadata explicitly contains the tracked brand. It is not inferred from the surrounding AI answer.",
      "Previous-period changes are shown only when a finite day filter is selected and evidence exists in the immediately preceding period.",
      "Results reflect successful stored responses and the filters active when the report was generated."
    ]
  };
}

// src/features/exports/export_service.ts
var XL = {
  navy: "FF0F172A",
  navyMid: "FF1E293B",
  blue: "FF3B82F6",
  blueLight: "FFdbeafe",
  muted: "FF94A3B8",
  border: "FFE2E8F0",
  stripe: "FFF8FAFC",
  white: "FFFFFFFF",
  text: "FF1E293B",
  green: "FF10B981",
  amber: "FFF59E0B",
  rose: "FFEF4444",
  sectionBg: "FFEFF6FF"
};
var PDF = {
  navy: "#0F172A",
  blue: "#3B82F6",
  blueLight: "#EFF6FF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  stripe: "#F8FAFC",
  white: "#FFFFFF"
};
var COL = {
  // overview
  section: { label: "Section", width: 16, align: "left" },
  item: { label: "Item", width: 30, align: "left" },
  value: { label: "Value", width: 18, align: "right" },
  detail: { label: "Detail", width: 48, align: "left" },
  rank: { label: "#", width: 6, align: "center" },
  // prompts
  prompt_id: { label: "Prompt ID", width: 12, align: "left" },
  prompt: { label: "Prompt", width: 52, align: "left" },
  topic: { label: "Topic", width: 20, align: "left" },
  status: { label: "Status", width: 14, align: "center" },
  source: { label: "Source", width: 14, align: "left" },
  total_chats: { label: "Chats", width: 10, align: "right" },
  visibility_pct: { label: "Visibility %", width: 14, align: "right", numFmt: '0.00"%"' },
  avg_position: { label: "Avg. Position", width: 14, align: "right", numFmt: "0.00" },
  avg_sentiment: { label: "Avg. Sentiment", width: 14, align: "right", numFmt: "0.00" },
  models: { label: "AI Models", width: 24, align: "left" },
  mentioned_brands: { label: "Mentioned Brands", width: 30, align: "left" },
  last_run_at: { label: "Last Run", width: 20, align: "left" },
  created_at: { label: "Created", width: 20, align: "left" },
  // chats
  chat_id: { label: "Chat ID", width: 12, align: "left" },
  model: { label: "AI Model", width: 18, align: "left" },
  brand_mentioned: { label: "Mentioned", width: 12, align: "center" },
  brand_position: { label: "Position", width: 12, align: "right", numFmt: "0" },
  sentiment_score: { label: "Sentiment", width: 12, align: "right", numFmt: "0.00" },
  sources: { label: "Source Domains", width: 32, align: "left" },
  raw_response: { label: "AI Response", width: 60, align: "left" },
  // sources
  source_id: { label: "Source ID", width: 12, align: "left" },
  url: { label: "URL", width: 50, align: "left" },
  domain: { label: "Domain", width: 28, align: "left" },
  title: { label: "Title", width: 40, align: "left" },
  source_type: { label: "Source Type", width: 16, align: "center" },
  url_type: { label: "URL Type", width: 16, align: "center" },
  cited: { label: "Cited", width: 10, align: "center" },
  used_by_ai: { label: "Used by AI", width: 12, align: "center" },
  platform: { label: "Platform", width: 16, align: "left" },
  subreddit: { label: "Subreddit", width: 18, align: "left" },
  chat_created_at: { label: "Chat Date", width: 20, align: "left" },
  snippet: { label: "Snippet", width: 50, align: "left" },
  // competitors
  competitor_id: { label: "Competitor ID", width: 12, align: "left" },
  competitor: { label: "Competitor", width: 26, align: "left" },
  mentions: { label: "Mentions", width: 12, align: "right" },
  // web analytics
  event_id: { label: "Event ID", width: 12, align: "left" },
  site: { label: "Site", width: 20, align: "left" },
  type: { label: "Event Type", width: 16, align: "left" },
  path: { label: "Path", width: 36, align: "left" },
  referrer: { label: "Referrer", width: 36, align: "left" },
  event_name: { label: "Event Name", width: 24, align: "left" },
  duration_ms: { label: "Duration (ms)", width: 14, align: "right", numFmt: "#,##0" },
  visitor_id: { label: "Visitor ID", width: 20, align: "left" },
  browser: { label: "Browser", width: 16, align: "left" },
  device: { label: "Device", width: 14, align: "left" },
  country: { label: "Country", width: 14, align: "left" },
  medium: { label: "Medium", width: 14, align: "left" }
};
var RESOURCE_LABEL = {
  overview: "AI Visibility Overview",
  prompts: "Prompt Analysis",
  chats: "Chat Responses",
  sources: "Source Intelligence",
  competitors: "Competitor Benchmarking",
  "web-analytics": "Web Analytics"
};
async function createExcelExport(input) {
  const project = await prisma_default.project.findUniqueOrThrow({
    where: { id: input.project_id },
    select: { brand_name: true, brand_url: true }
  });
  const rows = input.resource === "overview" ? [] : await getRows(input.project_id, input.resource, input.filters);
  const content = input.resource === "overview" ? await buildOverviewExcel(await getOverviewExportModel(input.project_id, input.filters)) : await buildExcel(project.brand_name, input.resource, input.filters, rows);
  const filename = buildFilename(project.brand_name, input.resource, "xlsx");
  return { filename, content };
}
async function createPdfExport(input) {
  const project = await prisma_default.project.findUniqueOrThrow({
    where: { id: input.project_id },
    select: { brand_name: true, brand_url: true }
  });
  const rows = input.resource === "overview" ? [] : await getRows(input.project_id, input.resource, input.filters);
  const content = input.resource === "overview" ? await buildOverviewPdfDocument(await getOverviewExportModel(input.project_id, input.filters)) : await buildPdf(project.brand_name, input.resource, input.filters, rows);
  const filename = buildFilename(project.brand_name, input.resource, "pdf");
  return { filename, content };
}
async function createGeoArticlePdf(input) {
  const project = await prisma_default.project.findUniqueOrThrow({
    where: { id: input.project_id },
    select: { brand_name: true }
  });
  const content = await buildGeoArticlePdfKit(project.brand_name, input.brief, input.article);
  const filename = buildFilename(project.brand_name, "geo-article", "pdf");
  return { filename, content };
}
async function getRows(project_id, resource, filters) {
  if (resource === "overview") return getOverviewRows(project_id, filters);
  if (resource === "prompts") return getPromptRows(project_id, filters);
  if (resource === "chats") return getChatRows(project_id, filters);
  if (resource === "sources") return getSourceRows(project_id, filters);
  if (resource === "competitors") return getCompetitorRows(project_id, filters);
  if (resource === "web-analytics") return getWebAnalyticsRows(project_id, filters);
  return [];
}
async function getOverviewRows(project_id, filters) {
  const report2 = await getOverviewReport(project_id, filters);
  return [
    ...report2.summary.map((r) => ({ section: "Summary", item: r.metric, value: r.value, detail: r.description, rank: "" })),
    ...report2.brands.map((r) => ({ section: "Brands", item: r.brand, value: r.visibility_pct, detail: `Pos: ${r.avg_position || "\u2013"} | Sent: ${r.avg_sentiment || "\u2013"}`, rank: r.rank })),
    ...report2.sources.map((r) => ({ section: "Sources", item: r.domain, value: r.used_pct, detail: `${r.source_type} | Avg citations: ${r.avg_citations}`, rank: r.rank }))
  ];
}
async function getOverviewReport(project_id, filters) {
  const [project, chats] = await Promise.all([
    prisma_default.project.findUniqueOrThrow({ where: { id: project_id }, include: { competitors: true } }),
    getFilteredChats(project_id, filters)
  ]);
  const totalChats = chats.length;
  const mentionedChats = chats.filter((c) => c.brand_mentioned);
  const sourceDomains = new Set(chats.flatMap((c) => c.sources.map((s) => s.domain)));
  const brandMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const m of chat.brand_mentions) {
      const e = brandMap.get(m.brand_name) ?? { mentions: 0, totalPos: 0, totalSent: 0, posCount: 0, sentCount: 0 };
      e.mentions += 1;
      if (typeof m.position === "number") {
        e.totalPos += m.position;
        e.posCount += 1;
      }
      if (typeof m.sentiment_score === "number") {
        e.totalSent += m.sentiment_score;
        e.sentCount += 1;
      }
      brandMap.set(m.brand_name, e);
    }
  }
  if (!brandMap.has(project.brand_name)) {
    brandMap.set(project.brand_name, {
      mentions: mentionedChats.length,
      totalPos: mentionedChats.reduce((s, c) => s + (c.brand_position ?? 0), 0),
      totalSent: mentionedChats.reduce((s, c) => s + (c.sentiment_score ?? 0), 0),
      posCount: mentionedChats.filter((c) => typeof c.brand_position === "number").length,
      sentCount: mentionedChats.filter((c) => typeof c.sentiment_score === "number").length
    });
  }
  const sourceMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    for (const domain of new Set(chat.sources.map((s) => s.domain))) {
      const srcs = chat.sources.filter((s) => s.domain === domain);
      const e = sourceMap.get(domain) ?? { count: 0, citations: 0, type: srcs[0]?.source_type ?? "OTHER" };
      e.count += 1;
      e.citations += srcs.filter((s) => s.is_cited).length;
      sourceMap.set(domain, e);
    }
  }
  return {
    summary: [
      { metric: "Total Chats", value: totalChats, description: "AI responses included in this export" },
      { metric: "Brand Visibility", value: totalChats ? pct(mentionedChats.length, totalChats) : 0, description: "% of chats where brand was mentioned" },
      { metric: "Avg. Position", value: average2(mentionedChats.map((c) => c.brand_position)), description: "Average rank when mentioned" },
      { metric: "Avg. Sentiment", value: average2(mentionedChats.map((c) => c.sentiment_score)), description: "Avg sentiment score for brand mentions" },
      { metric: "Unique Source Domains", value: sourceDomains.size, description: "Distinct domains influencing AI answers" }
    ],
    brands: Array.from(brandMap.entries()).map(([brand, d]) => ({
      brand,
      visibility_pct: totalChats ? pct(d.mentions, totalChats) : 0,
      mentions: d.mentions,
      avg_position: d.posCount ? round2(d.totalPos / d.posCount) : "",
      avg_sentiment: d.sentCount ? round2(d.totalSent / d.sentCount) : ""
    })).sort((a, b) => b.visibility_pct - a.visibility_pct).slice(0, 8).map((r, i) => ({ rank: i + 1, ...r })),
    sources: Array.from(sourceMap.entries()).map(([domain, d]) => ({
      domain,
      source_type: d.type,
      used_pct: totalChats ? pct(d.count, totalChats) : 0,
      avg_citations: d.count ? round2(d.citations / d.count) : 0
    })).sort((a, b) => b.used_pct - a.used_pct).slice(0, 10).map((r, i) => ({ rank: i + 1, ...r }))
  };
}
async function getPromptRows(project_id, filters) {
  const prompts = await prisma_default.prompt.findMany({
    where: {
      project_id,
      ...filters.topic ? { topic: filters.topic } : {},
      ...filters.status ? { status: filters.status } : {}
    },
    include: { chats: { where: buildChatOnlyWhere(filters), include: { brand_mentions: true } } },
    orderBy: { created_at: "desc" }
  });
  return prompts.map((p) => {
    const chats = p.chats;
    const mentioned = chats.filter((c) => c.brand_mentioned);
    const brands = new Set(chats.flatMap((c) => c.brand_mentions.map((m) => m.brand_name)));
    return {
      prompt_id: p.id,
      prompt: p.text,
      topic: p.topic,
      status: p.status,
      source: p.source,
      total_chats: chats.length,
      visibility_pct: chats.length ? pct(mentioned.length, chats.length) : 0,
      avg_position: average2(mentioned.map((c) => c.brand_position)),
      avg_sentiment: average2(chats.map((c) => c.sentiment_score)),
      models: [...new Set(chats.map((c) => c.ai_model))],
      mentioned_brands: [...brands],
      last_run_at: p.last_run_at,
      created_at: p.created_at
    };
  });
}
async function getChatRows(project_id, filters) {
  const chats = await getFilteredChats(project_id, filters);
  return chats.map((c) => ({
    chat_id: c.id,
    created_at: c.created_at,
    model: c.ai_model,
    prompt: c.prompt.text,
    topic: c.prompt.topic,
    brand_mentioned: c.brand_mentioned,
    brand_position: c.brand_position,
    sentiment_score: c.sentiment_score,
    mentioned_brands: c.brand_mentions.map((m) => m.brand_name),
    sources: [...new Set(c.sources.map((s) => s.domain))],
    raw_response: c.raw_response
  }));
}
async function getSourceRows(project_id, filters) {
  const sources = await prisma_default.source.findMany({
    where: { chat: buildChatWhere2(project_id, filters) },
    include: { chat: { include: { prompt: true, brand_mentions: true } }, source_url_content: true },
    orderBy: { created_at: "desc" }
  });
  return sources.map((s) => ({
    source_id: s.id,
    url: s.url,
    domain: s.domain,
    title: s.title ?? s.source_url_content?.title,
    source_type: s.source_type,
    url_type: s.url_type,
    cited: s.is_cited,
    used_by_ai: s.used_by_ai,
    platform: s.platform,
    subreddit: s.subreddit,
    prompt: s.chat.prompt.text,
    topic: s.chat.prompt.topic,
    model: s.chat.ai_model,
    chat_created_at: s.chat.created_at,
    mentioned_brands: s.chat.brand_mentions.map((m) => m.brand_name),
    snippet: s.snippet ?? s.source_url_content?.snippet
  }));
}
async function getCompetitorRows(project_id, filters) {
  const chats = await getFilteredChats(project_id, filters);
  const totalChats = chats.length;
  const competitors = await prisma_default.competitor.findMany({ where: { project_id }, orderBy: { name: "asc" } });
  return competitors.map((comp) => {
    const mentions = chats.flatMap((c) => c.brand_mentions).filter((m) => m.brand_name.toLowerCase() === comp.name.toLowerCase());
    return {
      competitor_id: comp.id,
      competitor: comp.name,
      url: comp.url,
      visibility_pct: totalChats ? pct(mentions.length, totalChats) : 0,
      mentions: mentions.length,
      avg_position: average2(mentions.map((m) => m.position)),
      avg_sentiment: average2(mentions.map((m) => m.sentiment_score)),
      created_at: comp.created_at
    };
  });
}
async function getWebAnalyticsRows(project_id, filters) {
  const siteIds = await prisma_default.webAnalyticsSite.findMany({ where: { project_id }, select: { id: true } });
  const ids = siteIds.map((s) => s.id);
  if (ids.length === 0) return [];
  const events = await prisma_default.webAnalyticsEvent.findMany({
    where: {
      site_id: { in: ids },
      ...filters.days ? { created_at: { gte: daysAgo(filters.days) } } : {},
      ...filters.q ? {
        OR: [
          { path: { contains: filters.q, mode: "insensitive" } },
          { title: { contains: filters.q, mode: "insensitive" } },
          { url: { contains: filters.q, mode: "insensitive" } }
        ]
      } : {}
    },
    include: { site: true, session: true },
    orderBy: { created_at: "desc" },
    take: 5e3
  });
  return events.map((e) => ({
    event_id: e.id,
    created_at: e.created_at,
    site: e.site.name,
    domain: e.site.domain,
    type: e.type,
    path: e.path,
    url: e.url,
    title: e.title,
    referrer: e.referrer,
    event_name: e.event_name,
    duration_ms: e.duration_ms,
    visitor_id: e.session?.visitor_id,
    browser: e.session?.browser,
    device: e.session?.device,
    country: e.session?.country,
    source: e.session?.source,
    medium: e.session?.medium
  }));
}
async function getFilteredChats(project_id, filters) {
  return prisma_default.chat.findMany({
    where: buildChatWhere2(project_id, filters),
    include: { prompt: true, brand_mentions: true, sources: true },
    orderBy: { created_at: "desc" },
    take: 5e3
  });
}
function buildChatWhere2(project_id, filters) {
  const promptWhere = { project_id };
  if (filters.topic) promptWhere.topic = filters.topic;
  const where = { prompt: promptWhere, ...buildChatOnlyWhere(filters) };
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { raw_response: { contains: q, mode: "insensitive" } },
      { prompt: { text: { contains: q, mode: "insensitive" } } },
      { brand_mentions: { some: { brand_name: { contains: q, mode: "insensitive" } } } },
      { sources: { some: { domain: { contains: q, mode: "insensitive" } } } },
      { sources: { some: { title: { contains: q, mode: "insensitive" } } } }
    ];
  }
  return where;
}
function buildChatOnlyWhere(filters) {
  return {
    ...filters.days ? { created_at: { gte: daysAgo(filters.days) } } : {},
    ...filters.model ? { ai_model: { contains: filters.model, mode: "insensitive" } } : {}
  };
}
async function buildExcel(brandName, resource, filters, rows) {
  const wb = new import_exceljs2.default.Workbook();
  wb.creator = "DeepMention";
  wb.created = /* @__PURE__ */ new Date();
  wb.modified = /* @__PURE__ */ new Date();
  const meta = wb.addWorksheet("Report Info", { tabColor: { argb: XL.blue } });
  meta.getColumn(1).width = 28;
  meta.getColumn(2).width = 44;
  meta.mergeCells("A1:B1");
  const titleCell = meta.getCell("A1");
  titleCell.value = `${brandName}  \xB7  ${RESOURCE_LABEL[resource]}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: XL.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  meta.getRow(1).height = 36;
  const metaRows = [
    ["Generated", fmtDate(/* @__PURE__ */ new Date())],
    ["Brand", brandName],
    ["Report Type", RESOURCE_LABEL[resource]],
    ["Filter: Days", filters.days ? `Last ${filters.days} days` : "All time"],
    ["Filter: Model", filters.model ?? "All models"],
    ["Filter: Topic", filters.topic ?? "All topics"],
    ["Total Rows", rows.length],
    ["Powered by", "DeepMention"]
  ];
  metaRows.forEach(([k, v], i) => {
    const row = meta.getRow(i + 2);
    row.height = 22;
    const kCell = row.getCell(1);
    kCell.value = k;
    kCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: XL.muted } };
    kCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.stripe } };
    kCell.alignment = { vertical: "middle", indent: 1 };
    const vCell = row.getCell(2);
    vCell.value = v;
    vCell.font = { name: "Calibri", size: 10, bold: false, color: { argb: XL.text } };
    vCell.alignment = { vertical: "middle", indent: 1 };
  });
  const ws = wb.addWorksheet("Data", { tabColor: { argb: XL.navy } });
  if (rows.length === 0) {
    ws.getCell("A1").value = "No data for the selected filters.";
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  const keys = Object.keys(rows[0]);
  ws.columns = keys.map((k, i) => {
    const meta2 = COL[k];
    return {
      key: k,
      width: meta2?.width ?? 18,
      style: {
        numFmt: meta2?.numFmt,
        alignment: { horizontal: meta2?.align ?? "left", vertical: "middle", wrapText: false }
      }
    };
  });
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  keys.forEach((k, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    const m = COL[k];
    cell.value = m?.label ?? toTitle(k);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: XL.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.navy } };
    cell.alignment = { horizontal: m?.align ?? "left", vertical: "middle", wrapText: false, indent: 1 };
    cell.border = {
      bottom: { style: "medium", color: { argb: XL.blue } }
    };
  });
  const sections = resource === "overview" ? groupBySection(rows) : null;
  if (sections) {
    let rowIdx = 2;
    for (const [sectionName, sectionRows] of sections) {
      const secRow = ws.getRow(rowIdx);
      secRow.height = 22;
      ws.mergeCells(`A${rowIdx}:${colLetter(keys.length)}${rowIdx}`);
      const secCell = secRow.getCell(1);
      secCell.value = sectionName.toUpperCase();
      secCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: XL.blue } };
      secCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.sectionBg } };
      secCell.alignment = { horizontal: "left", vertical: "middle", indent: 2 };
      rowIdx++;
      for (const [i, rowData] of sectionRows.entries()) {
        const xlRow = ws.getRow(rowIdx);
        xlRow.height = 20;
        addDataRow(xlRow, keys, rowData, i, true);
        rowIdx++;
      }
      rowIdx++;
    }
  } else {
    rows.forEach((rowData, i) => {
      const xlRow = ws.getRow(i + 2);
      xlRow.height = 20;
      addDataRow(xlRow, keys, rowData, i, false);
    });
  }
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  wb.views = [{ activeTab: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function addDataRow(xlRow, keys, rowData, rowIdx, inSection) {
  const isStripe = rowIdx % 2 === 0;
  const bg = isStripe ? XL.stripe : XL.white;
  keys.forEach((k, colIdx) => {
    const cell = xlRow.getCell(colIdx + 1);
    const meta = COL[k];
    const raw = rowData[k];
    const value = cellValue(raw);
    cell.value = value;
    cell.font = { name: "Calibri", size: 10, color: { argb: XL.text } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.alignment = {
      horizontal: meta?.align ?? "left",
      vertical: "middle",
      wrapText: false,
      indent: 1
    };
    if (meta?.numFmt && typeof value === "number") {
      cell.numFmt = meta.numFmt;
    }
    cell.border = { bottom: { style: "hair", color: { argb: XL.border } } };
  });
}
function cellValue(raw) {
  if (Array.isArray(raw)) return raw.join(", ");
  if (raw instanceof Date) return raw;
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (raw == null) return "";
  if (typeof raw === "number") return raw;
  return String(raw);
}
function groupBySection(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const sec = String(row.section ?? "Other");
    if (!map.has(sec)) map.set(sec, []);
    map.get(sec).push(row);
  }
  return map;
}
function colLetter(n) {
  let result = "";
  while (n > 0) {
    result = String.fromCharCode(65 + (n - 1) % 26) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
var PDF_RESOURCE_SUBTITLE = {
  overview: "Brand visibility, competitive landscape & source intelligence",
  prompts: "Performance breakdown of every tracked prompt",
  chats: "Raw AI responses with brand & sentiment data",
  sources: "Domains & citations influencing AI answers",
  competitors: "Visibility & sentiment for tracked competitors",
  "web-analytics": "Session events, referrers & visitor behaviour"
};
var SKIP_PDF = /* @__PURE__ */ new Set(["prompt_id", "chat_id", "source_id", "competitor_id", "event_id", "raw_response", "snippet", "url"]);
async function buildPdf(brandName, resource, filters, rows) {
  return new Promise((resolve, reject) => {
    const doc = new import_pdfkit2.default({ margin: 0, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width;
    const margin = 40;
    doc.rect(0, 0, W, 88).fill(PDF.navy);
    doc.fillColor(PDF.blue).fontSize(9).font("Helvetica-Bold");
    doc.text(brandName.toUpperCase(), margin, 20, { characterSpacing: 2 });
    doc.fillColor(PDF.white).fontSize(22).font("Helvetica-Bold");
    doc.text(RESOURCE_LABEL[resource], margin, 34);
    doc.fillColor("#94A3B8").fontSize(9).font("Helvetica");
    doc.text(PDF_RESOURCE_SUBTITLE[resource], margin, 62);
    const dateStr = fmtDate(/* @__PURE__ */ new Date());
    doc.fillColor("#64748B").fontSize(8.5).font("Helvetica");
    doc.text(dateStr, W - margin - 120, 20, { width: 120, align: "right" });
    if (filters.days) {
      const pill = `Last ${filters.days} days`;
      doc.roundedRect(W - margin - 80, 32, 80, 16, 4).fill("#1A3A5C");
      doc.fillColor("#93C5FD").fontSize(8).font("Helvetica");
      doc.text(pill, W - margin - 78, 36, { width: 76, align: "center" });
    }
    let y = 106;
    if (resource === "overview") {
      y = renderOverviewBody(doc, rows, W, margin, y);
    } else {
      y = renderGenericTable(doc, rows, W, margin, y);
    }
    const total = doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(i);
      renderFooter(doc, brandName, i + 1, total, W, margin);
    }
    doc.end();
  });
}
function renderOverviewBody(doc, rows, W, margin, y) {
  const summaryRows = rows.filter((r) => r.section === "Summary");
  const brandRows = rows.filter((r) => r.section === "Brands");
  const sourceRows = rows.filter((r) => r.section === "Sources");
  y = pdfSectionHeader(doc, "Executive Summary", W, margin, y);
  y = renderKpiCards(doc, summaryRows, W, margin, y);
  y += 18;
  y = pdfSectionHeader(doc, "Brand Visibility Rankings", W, margin, y);
  y = renderTable(doc, {
    headers: ["#", "Brand", "Visibility", "Avg. Position", "Avg. Sentiment"],
    colWidths: [28, 180, 88, 100, 100],
    rows: brandRows.map((r) => [
      String(r.rank ?? ""),
      String(r.item ?? ""),
      `${r.value}%`,
      String(r.detail).match(/Pos: ([^\s|]+)/)?.[1] ?? "\u2013",
      String(r.detail).match(/Sent: ([^\s]+)/)?.[1] ?? "\u2013"
    ]),
    align: ["center", "left", "center", "center", "center"],
    W,
    margin
  }, y);
  y += 18;
  y = pdfSectionHeader(doc, "Top Influencing Sources", W, margin, y);
  y = renderTable(doc, {
    headers: ["#", "Domain", "Used %", "Type", "Avg. Citations"],
    colWidths: [28, 200, 78, 120, 78],
    rows: sourceRows.map((r) => [
      String(r.rank ?? ""),
      String(r.item ?? ""),
      `${r.value}%`,
      String(r.detail).split(" | ")[0] ?? "\u2013",
      String(r.detail).match(/Avg citations: ([^\s]+)/)?.[1] ?? "\u2013"
    ]),
    align: ["center", "left", "center", "center", "center"],
    W,
    margin
  }, y);
  return y;
}
function renderGenericTable(doc, rows, W, margin, y) {
  if (rows.length === 0) {
    doc.fillColor(PDF.muted).fontSize(11).font("Helvetica");
    doc.text("No data available for the selected filters.", margin, y + 20);
    return y + 60;
  }
  const keys = Object.keys(rows[0]).filter((k) => !SKIP_PDF.has(k)).slice(0, 7);
  const usable = W - margin * 2;
  const colWidths = allocateColWidths(keys, usable);
  const align = keys.map(
    (k) => ["rank", "visibility_pct", "avg_position", "avg_sentiment", "mentions", "total_chats", "used_pct", "duration_ms", "cited", "used_by_ai", "brand_mentioned"].includes(k) ? "center" : "left"
  );
  const tableRows = rows.slice(0, 200).map(
    (row) => keys.map((k) => {
      const v = row[k];
      if (Array.isArray(v)) return v.slice(0, 3).join(", ");
      if (v instanceof Date) return fmtDate(v);
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (v == null) return "\u2013";
      const s = String(v);
      return s.length > 42 ? `${s.slice(0, 40)}\u2026` : s;
    })
  );
  const headers = keys.map((k) => COL[k]?.label ?? toTitle(k));
  return renderTable(doc, { headers, colWidths, rows: tableRows, align, W, margin }, y);
}
function allocateColWidths(keys, total) {
  const base = Math.floor(total / keys.length);
  const widths = keys.map((k) => {
    const meta = COL[k];
    if (!meta) return base;
    return Math.max(base * 0.6, Math.min(meta.width * 6.5, total * 0.35));
  });
  const sum = widths.reduce((s, w) => s + w, 0);
  const ratio = total / sum;
  return widths.map((w) => Math.floor(w * ratio));
}
function pdfSectionHeader(doc, title, W, margin, y) {
  doc.rect(margin, y, W - margin * 2, 24).fill("#EFF6FF");
  doc.rect(margin, y, 3, 24).fill(PDF.blue);
  doc.fillColor(PDF.blue).fontSize(9.5).font("Helvetica-Bold");
  doc.text(title.toUpperCase(), margin + 10, y + 8, { characterSpacing: 0.4 });
  return y + 32;
}
function renderTable(doc, spec, startY) {
  const { headers, colWidths, rows, align, W, margin } = spec;
  const rowH = 21;
  const headerH = 25;
  const pageH = doc.page.height;
  const footerRs = 48;
  let y = startY;
  const drawHeader = (yy) => {
    doc.rect(margin, yy, W - margin * 2, headerH).fill("#1E293B");
    let x = margin;
    headers.forEach((h, i) => {
      doc.fillColor("#94A3B8").fontSize(8).font("Helvetica-Bold");
      const opts = align[i] === "center" ? { width: colWidths[i] - 8, align: "center" } : { width: colWidths[i] - 8 };
      doc.text(h.toUpperCase(), x + 4, yy + 9, opts);
      x += colWidths[i];
    });
  };
  drawHeader(y);
  y += headerH;
  rows.forEach((row, ri) => {
    if (y + rowH > pageH - footerRs) {
      doc.addPage();
      y = 48;
      drawHeader(y);
      y += headerH;
    }
    if (ri % 2 === 0) {
      doc.rect(margin, y, W - margin * 2, rowH).fill(PDF.stripe);
    }
    let x = margin;
    row.forEach((cell, ci) => {
      doc.fillColor(PDF.text).fontSize(8.5).font("Helvetica");
      const colW = colWidths[ci];
      const opts = align[ci] === "center" ? { width: colW - 8, align: "center", lineBreak: false } : { width: colW - 8, lineBreak: false };
      doc.text(cell, x + 4, y + 6, opts);
      x += colW;
    });
    doc.moveTo(margin, y + rowH).lineTo(W - margin, y + rowH).strokeColor("#E2E8F0").lineWidth(0.3).stroke();
    y += rowH;
  });
  doc.rect(margin, startY, W - margin * 2, y - startY).strokeColor("#CBD5E1").lineWidth(0.6).stroke();
  return y + 14;
}
function renderKpiCards(doc, rows, W, margin, y) {
  const cols = Math.min(rows.length, 3);
  const cardW = Math.floor((W - margin * 2 - (cols - 1) * 10) / cols);
  const cardH = 66;
  rows.forEach((row, i) => {
    const col = i % cols;
    const rowN = Math.floor(i / cols);
    const cx = margin + col * (cardW + 10);
    const cy = y + rowN * (cardH + 10);
    doc.roundedRect(cx, cy, cardW, cardH, 5).fill(PDF.white);
    doc.roundedRect(cx, cy, cardW, cardH, 5).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
    doc.rect(cx, cy, cardW, 3).fill(PDF.blue);
    doc.fillColor(PDF.muted).fontSize(7.5).font("Helvetica-Bold");
    doc.text(String(row.item ?? "").toUpperCase(), cx + 10, cy + 10, { width: cardW - 20, characterSpacing: 0.3 });
    doc.fillColor("#0F172A").fontSize(22).font("Helvetica-Bold");
    doc.text(String(row.value ?? ""), cx + 10, cy + 24, { width: cardW - 20 });
    doc.fillColor(PDF.muted).fontSize(7.5).font("Helvetica");
    doc.text(String(row.detail ?? ""), cx + 10, cy + 52, { width: cardW - 20, lineBreak: false });
  });
  const rowCount = Math.ceil(rows.length / cols);
  return y + rowCount * (cardH + 10) + 6;
}
function renderFooter(doc, brandName, page, total, W, margin) {
  const H = doc.page.height;
  const fy = H - 28;
  doc.moveTo(margin, fy - 8).lineTo(W - margin, fy - 8).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
  doc.fillColor(PDF.muted).fontSize(7.5).font("Helvetica");
  doc.text(`Confidential \u2014 Generated for ${brandName}`, margin, fy, { lineBreak: false });
  doc.fillColor(PDF.muted).fontSize(7.5).font("Helvetica-Bold");
  doc.text("DeepMention", 0, fy, { align: "center", lineBreak: false });
  const pgText = `Page ${page} of ${total}`;
  const pgW = doc.widthOfString(pgText, { fontSize: 7.5 });
  doc.fillColor(PDF.muted).fontSize(7.5).font("Helvetica");
  doc.text(pgText, W - margin - pgW, fy, { lineBreak: false });
}
function buildFilename(brandName, resource, ext) {
  const brand = slugify(brandName || "project");
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return `${brand}-${resource}-${date}.${ext}`;
}
function slugify(v) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function daysAgo(days) {
  return new Date(Date.now() - days * 864e5);
}
function average2(values) {
  const clean2 = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (clean2.length === 0) return "";
  return round2(clean2.reduce((s, v) => s + v, 0) / clean2.length);
}
function pct(part, total) {
  return round2(part / total * 100);
}
function round2(n) {
  return Number(n.toFixed(2));
}
function fmtDate(d) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false
  }) + " UTC";
}
function toTitle(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
async function buildGeoArticlePdfKit(brandName, brief, article) {
  return new Promise((resolve, reject) => {
    const doc = new import_pdfkit2.default({ margin: 0, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width;
    const H = doc.page.height;
    const margin = 42;
    const contentW = W - margin * 2;
    doc.rect(0, 0, W, 4).fill("#D97706");
    doc.rect(0, 4, W, 96).fill("#0F172A");
    doc.fillColor("#D97706").fontSize(8.5).font("Helvetica-Bold");
    doc.text(`${brandName.toUpperCase()} \xB7 AI VISIBILITY INTELLIGENCE & GEO CONTENT BRIEF`, margin, 18, { characterSpacing: 1.5 });
    const mainTitle = article.title ?? brief.recommended_article.title;
    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold");
    doc.text(mainTitle, margin, 32, { width: contentW - 90, height: 38, ellipsis: true });
    const subDesc = article.meta_description ?? brief.recommended_article.priority_reason;
    if (subDesc) {
      doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica");
      doc.text(subDesc, margin, 72, { width: contentW - 90, height: 20, ellipsis: true });
    }
    const dateStr = fmtDate(/* @__PURE__ */ new Date());
    doc.fillColor("#64748B").fontSize(8).font("Helvetica");
    doc.text(dateStr, W - margin - 120, 18, { width: 120, align: "right" });
    const action = brief.recommended_article?.action ?? "CREATE";
    const badgeBg = action === "CREATE" ? "#065F46" : action === "REFRESH" ? "#92400E" : "#334155";
    const badgeText = action === "CREATE" ? "#34D399" : action === "REFRESH" ? "#FBBF24" : "#CBD5E1";
    doc.roundedRect(W - margin - 85, 34, 85, 18, 4).fill(badgeBg);
    doc.fillColor(badgeText).fontSize(8).font("Helvetica-Bold");
    doc.text(action + " PAGE", W - margin - 85, 39, { width: 85, align: "center", characterSpacing: 1 });
    let y = 114;
    const m = brief.metrics ?? { own_visibility: 0, evidence_count: 0 };
    const gapVal = 100 - (m.own_visibility ?? 0);
    const kpis = [
      { label: "AI VISIBILITY", value: `${m.own_visibility}%`, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
      { label: "COMPETITOR GAP", value: `${gapVal.toFixed(1)}%`, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
      { label: "AVG POSITION", value: m.own_avg_position ? `#${m.own_avg_position}` : "\u2014", color: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD" },
      { label: "EVIDENCE POINTS", value: String(m.evidence_count), color: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE" }
    ];
    const kpiGap = 10;
    const kpiW = (contentW - kpiGap * 3) / 4;
    kpis.forEach((kpi, i) => {
      const kX = margin + i * (kpiW + kpiGap);
      doc.roundedRect(kX, y, kpiW, 46, 5).fill(kpi.bg);
      doc.roundedRect(kX, y, kpiW, 46, 5).lineWidth(1).strokeColor(kpi.border).stroke();
      doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold");
      doc.text(kpi.label, kX + 10, y + 8, { characterSpacing: 0.8 });
      doc.fillColor(kpi.color).fontSize(15).font("Helvetica-Bold");
      doc.text(kpi.value, kX + 10, y + 21);
    });
    y += 58;
    if (brief.target_prompt?.text) {
      doc.roundedRect(margin, y, contentW, 36, 5).fill("#F8FAFC");
      doc.roundedRect(margin, y, contentW, 36, 5).lineWidth(1).strokeColor("#E2E8F0").stroke();
      doc.fillColor("#D97706").fontSize(7.5).font("Helvetica-Bold");
      doc.text("TARGET BUYER QUERY", margin + 12, y + 7, { characterSpacing: 1 });
      doc.fillColor("#0F172A").fontSize(9.5).font("Helvetica-Bold");
      doc.text(`"${brief.target_prompt.text}"`, margin + 12, y + 18, { width: contentW - 24, ellipsis: true });
      y += 46;
    }
    function ensurePageSpace(neededHeight) {
      if (y + neededHeight > H - 55) {
        doc.addPage();
        doc.rect(0, 0, W, 22).fill("#0F172A");
        doc.fillColor("#94A3B8").fontSize(7.5).font("Helvetica-Bold");
        doc.text(`${brandName.toUpperCase()} \xB7 GEO ARTICLE DRAFT`, margin, 7, { characterSpacing: 1 });
        doc.fillColor("#64748B").fontSize(7.5).font("Helvetica");
        doc.text(dateStr, W - margin - 100, 7, { width: 100, align: "right" });
        y = margin + 8;
      }
    }
    if (article.article_markdown) {
      let flushTable = function() {
        if (tableBuffer.length === 0) return;
        const rows = tableBuffer.map((r) => r.split("|").map((cell) => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)).filter((r) => r.length > 0 && !r.every((c) => /^[-:]+$/.test(c)));
        tableBuffer = [];
        if (rows.length === 0) return;
        const colCount = Math.max(...rows.map((r) => r.length));
        if (colCount === 0) return;
        const colW = contentW / colCount;
        const rowH = 20;
        ensurePageSpace(rows.length * rowH + 16);
        y += 6;
        rows.forEach((row, rowIndex) => {
          const isHeader = rowIndex === 0;
          ensurePageSpace(rowH);
          if (isHeader) {
            doc.rect(margin, y, contentW, rowH).fill("#0F172A");
          } else {
            doc.rect(margin, y, contentW, rowH).fill(rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFC");
            doc.rect(margin, y, contentW, rowH).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
          }
          row.forEach((cellText, colIndex) => {
            const cellX = margin + colIndex * colW;
            doc.fillColor(isHeader ? "#FFFFFF" : "#1E293B").fontSize(isHeader ? 8.5 : 8.5).font(isHeader ? "Helvetica-Bold" : "Helvetica");
            doc.text(cellText.replace(/\*\*/g, ""), cellX + 6, y + 5, { width: colW - 12, ellipsis: true });
          });
          y += rowH;
        });
        y += 10;
      };
      const rawLines = article.article_markdown.split("\n");
      let tableBuffer = [];
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (line.startsWith("|")) {
          tableBuffer.push(line);
          continue;
        } else if (tableBuffer.length > 0) {
          flushTable();
        }
        if (!line) {
          y += 4;
          continue;
        }
        if (line.includes("[NEEDS DATA:")) {
          const cleanCallout = line.replace(/\[NEEDS DATA:\s*/i, "").replace(/\]/g, "");
          ensurePageSpace(46);
          doc.roundedRect(margin, y, contentW, 40, 4).fill("#FEF3C7");
          doc.roundedRect(margin, y, contentW, 40, 4).lineWidth(1).strokeColor("#F59E0B").stroke();
          doc.fillColor("#92400E").fontSize(7.5).font("Helvetica-Bold");
          doc.text("EDITORIAL REVIEW REQUIRED", margin + 10, y + 7, { characterSpacing: 1 });
          doc.fillColor("#78350F").fontSize(8.5).font("Helvetica");
          doc.text(cleanCallout, margin + 10, y + 19, { width: contentW - 20, height: 18, ellipsis: true });
          y += 48;
          continue;
        }
        if (line.startsWith("# ")) {
          ensurePageSpace(32);
          y += 8;
          doc.fillColor("#0F172A").fontSize(14).font("Helvetica-Bold");
          doc.text(line.replace(/^#+ /, ""), margin, y, { width: contentW });
          y += 20;
        } else if (line.startsWith("## ")) {
          ensurePageSpace(30);
          y += 12;
          doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold");
          doc.text(line.replace(/^#+ /, ""), margin, y, { width: contentW });
          y += 16;
          doc.moveTo(margin, y).lineTo(W - margin, y).lineWidth(0.75).strokeColor("#E2E8F0").stroke();
          y += 8;
        } else if (line.startsWith("### ")) {
          ensurePageSpace(24);
          y += 8;
          doc.fillColor("#1E293B").fontSize(10.5).font("Helvetica-Bold");
          doc.text(line.replace(/^#+ /, ""), margin, y, { width: contentW });
          y += 15;
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
          const bulletText = line.replace(/^[-*] /, "").replace(/\*\*/g, "");
          const height = doc.heightOfString(bulletText, { width: contentW - 18 });
          ensurePageSpace(height + 4);
          doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold");
          doc.text("\u2022", margin + 4, y);
          doc.fillColor("#334155").fontSize(9).font("Helvetica");
          doc.text(bulletText, margin + 16, y, { width: contentW - 18, lineGap: 2.5 });
          y += height + 4;
        } else {
          const text = line.replace(/\*\*/g, "").replace(/`/g, "");
          const height = doc.heightOfString(text, { width: contentW });
          ensurePageSpace(height + 6);
          doc.fillColor("#334155").fontSize(9.5).font("Helvetica");
          doc.text(text, margin, y, { width: contentW, lineGap: 3.5 });
          y += height + 6;
        }
      }
      if (tableBuffer.length > 0) {
        flushTable();
      }
    }
    if (article.faq && article.faq.length > 0) {
      ensurePageSpace(45);
      y += 14;
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold");
      doc.text("Frequently Asked Questions (FAQ Schema)", margin, y);
      y += 16;
      doc.moveTo(margin, y).lineTo(W - margin, y).lineWidth(0.75).strokeColor("#E2E8F0").stroke();
      y += 10;
      for (const f of article.faq) {
        const qH = doc.heightOfString(f.question, { width: contentW - 24 });
        const aH = doc.heightOfString(f.answer, { width: contentW - 24 });
        const totalBoxH = qH + aH + 20;
        ensurePageSpace(totalBoxH + 6);
        doc.roundedRect(margin, y, contentW, totalBoxH, 5).fill("#F8FAFC");
        doc.roundedRect(margin, y, contentW, totalBoxH, 5).lineWidth(1).strokeColor("#E2E8F0").stroke();
        doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold");
        doc.text(f.question, margin + 12, y + 8, { width: contentW - 24 });
        doc.fillColor("#475569").fontSize(8.5).font("Helvetica");
        doc.text(f.answer, margin + 12, y + 8 + qH + 4, { width: contentW - 24, lineGap: 2 });
        y += totalBoxH + 8;
      }
    }
    const total = doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(i);
      doc.moveTo(margin, H - 36).lineTo(W - margin, H - 36).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
      doc.fillColor("#94A3B8").fontSize(8).font("Helvetica");
      doc.text(`${brandName} \xB7 GEO Intelligence & Content Brief \xB7 Confidential`, margin, H - 28);
      doc.text(`Page ${i + 1} of ${total}`, W - margin - 80, H - 28, { width: 80, align: "right" });
    }
    doc.end();
  });
}

// src/features/exports/export_controller.ts
var EXPORT_RESOURCES = /* @__PURE__ */ new Set([
  "overview",
  "prompts",
  "chats",
  "sources",
  "competitors",
  "web-analytics"
]);
async function downloadCsvExportController(req, res) {
  try {
    const project_id = getProjectId(req, res);
    if (!project_id) return;
    const resource = getResource(req, res);
    if (!resource) return;
    const userId = req.user.id;
    const format = getFormat(req);
    const filters = parseFilters4(req.query);
    await assertProjectAccess(project_id, userId);
    if (format === "json") {
      if (resource !== "overview") {
        res.status(400).json({ error: "Structured presentation data is only available for overview exports" });
        return;
      }
      res.status(200).json(await getOverviewExportModel(project_id, filters));
      return;
    }
    if (format === "pdf") {
      const result = await createPdfExport({ project_id, resource, filters });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.status(200).send(result.content);
      return;
    }
    if (format === "xlsx" || format === "csv") {
      const result = await createExcelExport({ project_id, resource, filters });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.status(200).send(result.content);
      return;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    console.error("Export failed", error);
    res.status(500).json({ error: "Export failed" });
  }
}
async function exportGeoArticlePdfController(req, res) {
  try {
    const project_id = req.params.project_id;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "Missing project_id" });
      return;
    }
    const userId = req.user.id;
    await assertProjectAccess(project_id, userId);
    const { brief, article } = req.body;
    if (!brief || !article) {
      res.status(400).json({ error: "Missing brief or article in request body" });
      return;
    }
    const pdf = await createGeoArticlePdf({ project_id, brief, article });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdf.filename}"`);
    res.send(pdf.content);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    console.error("[exportGeoArticlePdfController] Error:", error);
    res.status(500).json({ error: "Failed to generate GEO article PDF" });
  }
}
function getProjectId(req, res) {
  const { project_id } = req.params;
  if (!project_id || Array.isArray(project_id)) {
    res.status(400).json({ error: "project_id is required" });
    return null;
  }
  return project_id;
}
function getResource(req, res) {
  const resourceParam = req.params.resource;
  if (!resourceParam || Array.isArray(resourceParam)) {
    res.status(400).json({ error: "Unsupported export resource" });
    return null;
  }
  const rawResource = resourceParam.replace(/\.(csv|pdf|xlsx|json)$/i, "");
  if (!rawResource || !EXPORT_RESOURCES.has(rawResource)) {
    res.status(400).json({ error: "Unsupported export resource" });
    return null;
  }
  return rawResource;
}
function getFormat(req) {
  const resourceParam = Array.isArray(req.params.resource) ? "" : req.params.resource;
  const ext = resourceParam?.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "xlsx") return "xlsx";
  if (ext === "json") return "json";
  return "csv";
}
function parseFilters4(query) {
  return {
    days: parsePositiveInt(query.days),
    model: parseString(query.model),
    topic: parseString(query.topic),
    status: parseString(query.status),
    q: parseString(query.q)
  };
}
function parseString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "all") return void 0;
  return trimmed;
}
function parsePositiveInt(value) {
  if (typeof value !== "string") return void 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return void 0;
  return parsed;
}

// src/features/exports/export_routes.ts
var router14 = (0, import_express14.Router)();
router14.get("/:project_id/:resource", downloadCsvExportController);
router14.post("/:project_id/geoarticle-pdf", exportGeoArticlePdfController);
var export_routes_default = router14;

// src/features/opportunities/opportunity_routes.ts
var import_express15 = require("express");

// src/features/opportunities/opportunity_controller.ts
init_project_access();

// src/features/opportunities/opportunity_action_service.ts
init_prisma();
function actionCategory(item) {
  if (item.type === "SOURCE_GAP") return "SOURCE";
  if (item.content_gap.action === "CREATE" || item.content_gap.action === "REFRESH") return "CONTENT";
  if (item.type === "SENTIMENT_GAP") return "COMPETITOR";
  return "CONTENT";
}
function effortScore(effort) {
  if (effort === "LOW") return 25;
  if (effort === "MEDIUM") return 55;
  return 85;
}
function confidenceScore(confidence) {
  if (confidence === "HIGH") return 90;
  if (confidence === "MEDIUM") return 70;
  if (confidence === "LOW") return 45;
  return 25;
}
async function createOpportunityAction(input) {
  const existing = await prisma_default.actionQueueItem.findFirst({
    where: {
      project_id: input.projectId,
      user_id: input.userId,
      source_type: "OPPORTUNITY",
      source_ref_id: input.item.id,
      status: { not: "DISMISSED" }
    }
  });
  if (existing) return existing;
  const dueAt = /* @__PURE__ */ new Date();
  dueAt.setDate(dueAt.getDate() + (input.item.effort === "LOW" ? 7 : input.item.effort === "MEDIUM" ? 14 : 30));
  return prisma_default.actionQueueItem.create({
    data: {
      project_id: input.projectId,
      user_id: input.userId,
      title: input.item.content_gap.suggested_title,
      description: input.item.content_gap.gap_reason,
      category: actionCategory(input.item),
      priority: input.item.impact,
      impact_score: input.item.impact_score,
      effort_score: effortScore(input.item.effort),
      confidence_score: confidenceScore(input.item.confidence),
      recommended_action: input.item.next_step,
      success_metric: input.item.verification.success_metric,
      source_type: "OPPORTUNITY",
      source_ref_id: input.item.id,
      due_at: dueAt,
      evidence: {
        prompt_id: input.item.prompt_id,
        prompt_text: input.item.prompt_text,
        buyer_intent: input.item.buyer_intent,
        brand_outcome: input.item.brand_outcome,
        competitor_outcome: input.item.competitor_outcome,
        competitor_name: input.item.competitor_name,
        target_page: input.item.target_page,
        supporting_urls: input.item.supporting_urls,
        source_domains: input.item.top_sources.map((source) => source.domain),
        baseline: input.item.verification.baseline,
        verification_after_days: input.item.verification.recheck_after_days
      }
    }
  });
}

// src/features/opportunities/opportunity_controller.ts
function parseFilters5(query) {
  const filters = {};
  if (query.days) filters.days = parseInt(query.days, 10);
  if (query.model && query.model !== "all") filters.model = query.model;
  if (query.topic && query.topic !== "all") filters.topic = query.topic;
  if (query.tag && query.tag !== "all") filters.tag = query.tag;
  if (query.prompt_id && query.prompt_id !== "all") filters.prompt_id = query.prompt_id;
  if (query.q) filters.q = query.q;
  if (query.country && query.country !== "all") filters.country = query.country;
  if (query.intent && query.intent !== "all") filters.intent = query.intent;
  if (query.mentioned === "true" || query.mentioned === "false") filters.mentioned = query.mentioned === "true";
  if (query.cited === "true" || query.cited === "false") filters.cited = query.cited === "true";
  return filters;
}
async function getOpportunitiesController(req, res) {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(project_id, req.user.id);
    const data = await getOpportunities(project_id, parseFilters5(req.query));
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get opportunities" });
  }
}
async function createOpportunityActionController(req, res) {
  try {
    const { project_id, opportunity_id } = req.params;
    if (!project_id || Array.isArray(project_id) || !opportunity_id || Array.isArray(opportunity_id)) {
      res.status(400).json({ error: "project_id and opportunity_id are required" });
      return;
    }
    const userId = req.user.id;
    await assertProjectAccess(project_id, userId);
    const data = await getOpportunities(project_id, parseFilters5(req.query));
    const item = data.opportunities.find((opportunity) => opportunity.id === opportunity_id);
    if (!item) {
      res.status(404).json({ error: "Opportunity not found in the current project evidence" });
      return;
    }
    const action = await createOpportunityAction({
      projectId: project_id,
      userId,
      item
    });
    res.status(201).json(action);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    console.error("[opportunities] Failed to create action:", error);
    res.status(500).json({ error: "Failed to create opportunity action" });
  }
}

// src/features/opportunities/opportunity_routes.ts
var router15 = (0, import_express15.Router)();
router15.get("/:project_id", getOpportunitiesController);
router15.post("/:project_id/:opportunity_id/actions", createOpportunityActionController);
var opportunity_routes_default = router15;

// src/features/geoartciles/geoarticle_routes.ts
var import_express16 = require("express");

// src/features/geoartciles/geoarticle_controller.ts
init_credits_service2();
init_project_access();
init_plan_config();

// src/features/geoartciles/contentbrief_storage.ts
var import_crypto5 = require("crypto");
init_prisma();
function json(value) {
  return JSON.stringify(value ?? null);
}
async function upsertSavedContentBrief(input) {
  const { project_id, user_id, response } = input;
  const brief = response.brief;
  const article = response.article;
  const id = (0, import_crypto5.randomUUID)();
  const title = article?.title ?? brief.recommended_article.title;
  const slug = article?.slug ?? brief.recommended_article.suggested_slug ?? null;
  const offset = response.current_offset ?? 0;
  const rows = await prisma_default.$queryRaw`
        INSERT INTO "ContentBrief" (
            id, project_id, user_id, status, title, slug, topic,
            target_prompt_id, target_prompt_text, content_type, action,
            opportunity_offset, brief, article, prompt_used, generation_error, updated_at
        )
        VALUES (
            ${id}, ${project_id}, ${user_id}, ${response.status}, ${title}, ${slug}, ${brief.topic ?? null},
            ${brief.target_prompt.id ?? null}, ${brief.target_prompt.text}, ${brief.recommended_article.content_type ?? null},
            ${brief.recommended_article.action ?? null}, ${offset},
            ${json(brief)}::jsonb, ${json(article)}::jsonb, ${json(response.prompt_used)}::jsonb,
            ${response.generation_error ?? null}, NOW()
        )
        ON CONFLICT (project_id, user_id, target_prompt_id, opportunity_offset)
        DO UPDATE SET
            status = EXCLUDED.status,
            title = EXCLUDED.title,
            slug = EXCLUDED.slug,
            topic = EXCLUDED.topic,
            target_prompt_text = EXCLUDED.target_prompt_text,
            content_type = EXCLUDED.content_type,
            action = EXCLUDED.action,
            brief = EXCLUDED.brief,
            article = EXCLUDED.article,
            prompt_used = EXCLUDED.prompt_used,
            generation_error = EXCLUDED.generation_error,
            updated_at = NOW()
        RETURNING *
    `;
  return rows[0];
}
async function listSavedContentBriefs(input) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  if (input.topic) {
    return prisma_default.$queryRaw`
            SELECT *
            FROM "ContentBrief"
            WHERE project_id = ${input.project_id}
              AND user_id = ${input.user_id}
              AND topic = ${input.topic}
            ORDER BY updated_at DESC
            LIMIT ${limit}
        `;
  }
  return prisma_default.$queryRaw`
        SELECT *
        FROM "ContentBrief"
        WHERE project_id = ${input.project_id}
          AND user_id = ${input.user_id}
        ORDER BY updated_at DESC
        LIMIT ${limit}
    `;
}
async function getSavedContentBrief(input) {
  const rows = await prisma_default.$queryRaw`
        SELECT *
        FROM "ContentBrief"
        WHERE id = ${input.id}
          AND project_id = ${input.project_id}
          AND user_id = ${input.user_id}
        LIMIT 1
    `;
  return rows[0] ?? null;
}
async function deleteSavedContentBrief(input) {
  const rows = await prisma_default.$queryRaw`
        DELETE FROM "ContentBrief"
        WHERE id = ${input.id}
          AND project_id = ${input.project_id}
          AND user_id = ${input.user_id}
        RETURNING id
    `;
  return rows.length > 0;
}

// src/features/geoartciles/geoarticle_service.ts
init_prisma();

// src/features/geoartciles/geo_article_prompt.ts
function buildGeoArticleSystemPrompt() {
  return [
    "You are a GEO (Generative Engine Optimization) content specialist. Your output will be used inside an AI-visibility SaaS to help B2B brands appear more often in ChatGPT, Gemini, and Perplexity answers.",
    "",
    "LLM CITATION RULES \u2014 your article must satisfy these or it will not be cited by AI engines:",
    "1. Answer the target query directly in the FIRST sentence. No preamble.",
    "2. Use H2 headings phrased as natural buyer questions (e.g. 'How does X compare with Y?').",
    "3. Every factual claim needs a specific subject, verb, and number. No vague generalities.",
    "4. Include a 3-6 row comparison table if competitor evidence is provided.",
    "5. Include a 4-6 item FAQ block. Each answer must be 1-3 sentences, direct, and self-contained.",
    "6. Use bullet lists for any group of 3+ related items \u2014 LLMs heavily cite structured lists.",
    "7. Include exactly ONE clear call-to-action at the end.",
    "",
    "CONTENT RULES:",
    "- Use only the supplied DB evidence. Never invent stats, case studies, quotes, or customer names.",
    "- If data is genuinely missing, write [NEEDS DATA: describe what is needed] inline.",
    "- Write for a B2B buyer who is 60% through their decision process.",
    "- Forbidden words: unlock, leverage, game-changing, revolutionary, in today's landscape, cutting-edge, robust, seamlessly.",
    "- Tone: direct, specific, credible. No adjective inflation.",
    "",
    "RETURN: strict JSON only. No markdown wrapper. No explanation outside the JSON."
  ].join("\n");
}
function buildGeoArticleUserPrompt(brief) {
  const competitorNames = brief.competitors.map((c) => c.name).join(", ") || "none tracked";
  const topSources = brief.sources_to_reference.slice(0, 5).map((s) => s.domain).join(", ") || "none";
  const geoContext = brief.geo_country ? `
GEO TARGET: This article is specifically optimized for users in ${brief.geo_country}. Localize examples, regulations, and terminology where relevant.` : "";
  const schema = {
    title: "string \u2014 phrased as a real search/AI query, max 80 chars",
    meta_description: "string \u2014 150-160 chars, answer-first",
    slug: "string \u2014 kebab-case, max 80 chars",
    target_query: "string \u2014 the exact buyer question this page answers",
    search_intent: "one of: informational | commercial | navigational | transactional",
    article_markdown: "string \u2014 full article in GitHub-flavored Markdown. Must include: H1 (article title), H2 buyer-question sections, one comparison table if competitors exist, bullet lists, FAQ section, CTA at end.",
    faq: [
      { question: "string \u2014 phrased as a natural question", answer: "string \u2014 1-3 sentences, direct, self-contained" }
    ],
    json_ld: "string \u2014 JSON-LD Article schema stringified. Include name, description, url (use suggested_slug), dateModified (today).",
    needs_data: ["string \u2014 each item describes a specific data point missing from the brief that would strengthen this article"]
  };
  return [
    `Create a GEO-optimized article from the DB brief below.${geoContext}`,
    "",
    "Return JSON matching this exact schema (no extra keys, no markdown wrapper):",
    JSON.stringify(schema, null, 2),
    "",
    "=== DB BRIEF ===",
    "",
    `Brand: ${brief.brand.name} (${brief.brand.url})`,
    `Topic: ${brief.topic}`,
    `Target query: "${brief.target_prompt.text}"`,
    `Content action: ${brief.recommended_article.action} (${brief.recommended_article.content_type})`,
    `Article title: ${brief.recommended_article.title}`,
    `Suggested slug: /${brief.recommended_article.suggested_slug}`,
    `Target intent: ${brief.recommended_article.target_intent}`,
    `Priority reason: ${brief.recommended_article.priority_reason}`,
    "",
    "=== BRAND METRICS (own visibility in DB) ===",
    `Visibility: ${brief.metrics.own_visibility}%`,
    `Avg position when mentioned: ${brief.metrics.own_avg_position ?? "not tracked"}`,
    `Avg sentiment: ${brief.metrics.own_avg_sentiment ?? "not tracked"}`,
    `Evidence count: ${brief.metrics.evidence_count} AI answers from last ${brief.metrics.days_analyzed} days`,
    "",
    "=== COMPETITORS APPEARING IN AI ANSWERS ===",
    brief.competitors.length ? brief.competitors.map(
      (c) => `- ${c.name}: ${c.visibility}% visible, avg position ${c.avg_position ?? "n/a"}, sentiment ${c.avg_sentiment ?? "n/a"}`
    ).join("\n") : "No competitor evidence yet.",
    "",
    "=== SOURCES AI ENGINES CITE FOR THIS TOPIC ===",
    brief.sources_to_reference.length ? brief.sources_to_reference.slice(0, 6).map(
      (s) => `- ${s.domain} (cited ${s.mentions}x)${s.title ? ` \u2014 "${s.title}"` : ""}`
    ).join("\n") : "No source evidence yet.",
    "",
    "=== ANSWER PATTERNS FROM REAL AI RESPONSES ===",
    brief.answer_patterns.length ? brief.answer_patterns.map((p) => `- ${p}`).join("\n") : "No patterns extracted yet.",
    "",
    "=== ARTICLE OUTLINE (sections to cover) ===",
    brief.outline.map((item, i) => `${i + 1}. ${item}`).join("\n"),
    "",
    "=== MISSING ANGLES (must address) ===",
    brief.missing_angles.map((a) => `- ${a}`).join("\n"),
    "",
    "=== FAQ SEEDS (expand each into question + answer) ===",
    brief.faqs.map((q) => `- ${q}`).join("\n"),
    "",
    `Key competitors to mention: ${competitorNames}`,
    `Key sources to reference: ${topSources}`
  ].join("\n");
}

// src/features/geoartciles/geoarticle_service.ts
function round3(value) {
  return Number(value.toFixed(1));
}
function avg2(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function cleanText2(value, max = 240) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
function slugify2(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}
function inferIntent(promptText) {
  const text = promptText.toLowerCase();
  if (text.includes("alternative") || text.includes("instead of") || text.includes("switch from")) return "Alternatives evaluation";
  if (text.includes("compare") || text.includes(" vs ") || text.includes("versus") || text.includes("difference between")) return "Comparison research";
  if (text.includes("best") || text.includes("top") || text.includes("leading") || text.includes("recommended")) return "Best tools shortlist";
  if (text.includes("pricing") || text.includes("cost") || text.includes("price") || text.includes("worth it")) return "Pricing and value research";
  if (text.includes("how to") || text.includes("how can i") || text.includes("how do") || text.includes("step")) return "Educational how-to guide";
  if (text.includes("what is") || text.includes("what are") || text.includes("explain") || text.includes("definition")) return "Educational explanation";
  if (text.includes("why") || text.includes("should i") || text.includes("worth")) return "Decision support";
  if (text.includes("review") || text.includes("opinion") || text.includes("feedback")) return "Review and validation";
  if (text.includes("integrate") || text.includes("api") || text.includes("connect")) return "Integration research";
  if (text.includes("enterprise") || text.includes("team") || text.includes("company") || text.includes("organization")) return "Enterprise evaluation";
  if (text.includes("free") || text.includes("trial") || text.includes("demo")) return "Trial and adoption research";
  return "Category research";
}
function fallbackTitle(promptText, brandName) {
  const cleaned = cleanText2(promptText, 90).replace(/[?.!]+$/, "");
  const lower = cleaned.toLowerCase();
  if (lower.includes(brandName.toLowerCase())) return cleaned;
  return `${cleaned}: where ${brandName} fits`;
}
function buildOutline(brief) {
  const competitorNames = brief.competitors.slice(0, 3).map((competitor) => competitor.name);
  const sourceDomains = brief.sources_to_reference.slice(0, 3).map((source) => source.domain);
  return [
    `What is the direct answer to "${brief.target_prompt.text}"?`,
    `When should buyers choose ${brief.brand.name}?`,
    competitorNames.length ? `How does ${brief.brand.name} compare with ${competitorNames.join(", ")}?` : `What alternatives should buyers consider?`,
    sourceDomains.length ? `Which sources and proof points should support this answer?` : `What proof points should this page include?`,
    `What should buyers do next?`
  ];
}
function buildFaqs(promptText, brandName, competitors, intent) {
  const competitor = competitors[0]?.name;
  const topCompetitor = competitors[0]?.name ?? "other tools";
  const cleaned = promptText.replace(/[?.!]+$/, "");
  const faqs = [
    `What is the best solution for ${cleaned}?`,
    competitor ? `How does ${brandName} compare with ${topCompetitor} for this use case?` : `Who is ${brandName} built for?`,
    `Why do AI assistants like ChatGPT and Perplexity recommend certain brands over others?`,
    `What content or sources help a brand appear in AI-generated answers?`
  ];
  if (intent.includes("Enterprise") || intent.includes("Comparison")) {
    faqs.push(`What questions should enterprise buyers ask before choosing a solution for ${cleaned}?`);
  }
  if (intent.includes("Pricing")) {
    faqs.push(`Is ${brandName} worth the cost compared with ${topCompetitor}?`);
  }
  if (intent.includes("Alternatives")) {
    faqs.push(`When is ${brandName} a better choice than ${topCompetitor}?`);
  }
  return faqs.slice(0, 6);
}
async function loadArticleChats(project_id, filters) {
  return prisma_default.chat.findMany({
    where: buildChatWhere(project_id, filters),
    include: {
      prompt: {
        select: {
          id: true,
          text: true,
          topic: true,
          type: true
        }
      },
      brand_mentions: {
        select: {
          brand_name: true,
          position: true,
          sentiment_score: true
        }
      },
      sources: {
        select: {
          domain: true,
          title: true,
          url: true,
          source_type: true,
          is_cited: true
        }
      }
    },
    orderBy: { created_at: "desc" },
    take: 80
  });
}
function sourceEvidence2(chats) {
  const map = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const seen = /* @__PURE__ */ new Set();
    for (const source of chat.sources) {
      if (!source.domain || seen.has(source.domain)) continue;
      seen.add(source.domain);
      const existing = map.get(source.domain);
      map.set(source.domain, {
        domain: source.domain,
        title: existing?.title ?? source.title ?? null,
        url: existing?.url ?? source.url ?? null,
        source_type: existing?.source_type ?? source.source_type ?? null,
        mentions: (existing?.mentions ?? 0) + 1
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.mentions - a.mentions).slice(0, 8);
}
function competitorEvidence(chats, brandName) {
  const map = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    const seen = /* @__PURE__ */ new Set();
    for (const mention of chat.brand_mentions) {
      const name = mention.brand_name.trim();
      if (!name || name.toLowerCase() === brandName.toLowerCase()) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const existing = map.get(name) ?? { count: 0, positions: [], sentiments: [] };
      existing.count += 1;
      if (mention.position !== null) existing.positions.push(mention.position);
      if (mention.sentiment_score !== null) existing.sentiments.push(mention.sentiment_score);
      map.set(name, existing);
    }
  }
  return Array.from(map.entries()).map(([name, data]) => ({
    name,
    visibility: chats.length ? round3(data.count / chats.length * 100) : 0,
    avg_position: avg2(data.positions),
    avg_sentiment: avg2(data.sentiments)
  })).sort((a, b) => b.visibility - a.visibility).slice(0, 5);
}
function answerPatterns(chats, brandName) {
  const samples = chats.filter((chat) => chat.raw_response).slice(0, 5).map((chat) => cleanText2(chat.raw_response, 220));
  const patterns = /* @__PURE__ */ new Set();
  for (const sample of samples) {
    if (sample.toLowerCase().includes(brandName.toLowerCase())) {
      patterns.add(`AI answers already connect ${brandName} to this intent.`);
    }
    if (/best|top|leading/i.test(sample)) patterns.add("AI answers use shortlist/category language.");
    if (/compare|alternative|versus| vs /i.test(sample)) patterns.add("AI answers frame the topic as comparison research.");
    if (/source|citation|according|report|review/i.test(sample)) patterns.add("AI answers lean on external evidence and third-party sources.");
  }
  return [...patterns, ...samples.slice(0, 2)].slice(0, 5);
}
function parseGeneratedArticle(raw) {
  const cleaned = raw.trim().replace(/^```json\n?/i, "").replace(/^```\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(cleaned);
}
async function buildBrief(input, filters) {
  const project_id = input.project_id;
  const offset = Math.max(0, input.offset ?? 0);
  const [project, opportunities] = await Promise.all([
    prisma_default.project.findUniqueOrThrow({
      where: { id: project_id },
      include: { competitors: true }
    }),
    getOpportunities(project_id, filters)
  ]);
  const total = opportunities.opportunities.length;
  const safeOffset = total > 0 ? offset % total : 0;
  const selectedOpportunity = opportunities.opportunities[safeOffset];
  if (!selectedOpportunity) {
    throw new Error("NO_GEO_ARTICLE_OPPORTUNITY");
  }
  const chats = await loadArticleChats(project_id, {
    ...filters,
    prompt_id: selectedOpportunity.prompt_id
  });
  if (!chats.length) {
    throw new Error("NO_GEO_ARTICLE_EVIDENCE");
  }
  const ownMentionChats = chats.filter((chat) => chat.brand_mentioned);
  const ownPosition = avg2(ownMentionChats.map((chat) => chat.brand_position).filter((value) => value !== null));
  const ownSentiment = avg2(ownMentionChats.map((chat) => chat.sentiment_score).filter((value) => value !== null));
  const competitors = competitorEvidence(chats, project.brand_name);
  const sources = sourceEvidence2(chats);
  const prompt = chats[0].prompt;
  const title = selectedOpportunity.content_gap.suggested_title || fallbackTitle(prompt.text, project.brand_name);
  const intent = inferIntent(prompt.text);
  const partialBrief = {
    brand: {
      name: project.brand_name,
      url: project.brand_url,
      location: project.brand_location
    },
    topic: prompt.topic,
    geo_country: input?.geo_country ?? null,
    target_prompt: {
      id: prompt.id,
      text: prompt.text,
      type: prompt.type
    },
    recommended_article: {
      title,
      content_type: selectedOpportunity.content_gap.recommended_content_type,
      action: selectedOpportunity.content_gap.action,
      priority_reason: selectedOpportunity.content_gap.priority_reason,
      target_intent: intent,
      suggested_slug: slugify2(title)
    },
    metrics: {
      own_visibility: round3(ownMentionChats.length / chats.length * 100),
      own_avg_position: ownPosition ? round3(ownPosition) : null,
      own_avg_sentiment: ownSentiment ? round3(ownSentiment) : null,
      evidence_count: chats.length,
      days_analyzed: filters.days ?? 14
    },
    competitors,
    sources_to_reference: sources,
    answer_patterns: answerPatterns(chats, project.brand_name),
    missing_angles: selectedOpportunity.content_gap.missing_angles
  };
  return {
    brief: {
      ...partialBrief,
      outline: buildOutline(partialBrief),
      faqs: buildFaqs(prompt.text, project.brand_name, competitors, intent)
    },
    total
  };
}
async function getGeoArticle(input) {
  const requestedDays = input.days ?? 14;
  const baseFilters = {
    days: requestedDays,
    topic: input.topic,
    prompt_id: input.prompt_id,
    model: input.model
  };
  let result = await buildBrief(input, baseFilters);
  if (result.brief.metrics.evidence_count < 20 && requestedDays < 30 && !input.prompt_id) {
    result = await buildBrief(input, {
      ...baseFilters,
      days: 30
    });
  }
  const { brief, total } = result;
  const system = buildGeoArticleSystemPrompt();
  const user = buildGeoArticleUserPrompt(brief);
  if (input.generate === false) {
    return {
      status: "BRIEF_ONLY",
      brief,
      total_opportunities: total,
      current_offset: input.offset ?? 0,
      article: null,
      prompt_used: { system, user }
    };
  }
  try {
    const raw = await generateText(system, user);
    return {
      status: "GENERATED",
      brief,
      total_opportunities: total,
      current_offset: input.offset ?? 0,
      article: parseGeneratedArticle(raw),
      prompt_used: { system, user }
    };
  } catch (error) {
    return {
      status: "BRIEF_ONLY",
      brief,
      total_opportunities: total,
      current_offset: input.offset ?? 0,
      article: null,
      generation_error: error instanceof Error ? error.message : "Failed to generate article",
      prompt_used: { system, user }
    };
  }
}

// src/features/geoartciles/geoarticle_controller.ts
function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function readNumber(value) {
  if (typeof value !== "string") return void 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : void 0;
}
function readBoolean(value) {
  if (value === "false") return false;
  if (value === "true") return true;
  return void 0;
}
function toSavedGeoArticleItem(row) {
  return {
    id: row.id,
    offset: row.opportunity_offset,
    status: row.status,
    brief: row.brief,
    article: row.article,
    generation_error: row.generation_error,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
async function listSavedGeoArticlesController(req, res) {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertProjectAccess(project_id, user_id);
    const rows = await listSavedContentBriefs({
      project_id,
      user_id,
      topic: readString(req.query.topic),
      limit: readNumber(req.query.limit)
    });
    res.status(200).json({
      items: rows.map(toSavedGeoArticleItem),
      total_saved: rows.length
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to list saved content briefs" });
  }
}
async function getSavedGeoArticleController(req, res) {
  try {
    const { project_id, content_brief_id } = req.params;
    if (!project_id || !content_brief_id || Array.isArray(project_id) || Array.isArray(content_brief_id)) {
      res.status(400).json({ error: "project_id and content_brief_id are required" });
      return;
    }
    const user_id = req.user.id;
    await assertProjectAccess(project_id, user_id);
    const row = await getSavedContentBrief({ id: content_brief_id, project_id, user_id });
    if (!row) {
      res.status(404).json({ error: "Saved content brief not found" });
      return;
    }
    res.status(200).json(toSavedGeoArticleItem(row));
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to get saved content brief" });
  }
}
async function deleteSavedGeoArticleController(req, res) {
  try {
    const { project_id, content_brief_id } = req.params;
    if (!project_id || !content_brief_id || Array.isArray(project_id) || Array.isArray(content_brief_id)) {
      res.status(400).json({ error: "project_id and content_brief_id are required" });
      return;
    }
    const user_id = req.user.id;
    await assertProjectAccess(project_id, user_id);
    const deleted = await deleteSavedContentBrief({ id: content_brief_id, project_id, user_id });
    if (!deleted) {
      res.status(404).json({ error: "Saved content brief not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete saved content brief" });
  }
}
async function getGeoArticleController(req, res) {
  try {
    const { project_id } = req.params;
    if (!project_id || Array.isArray(project_id)) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const user_id = req.user.id;
    await assertProjectAccess(project_id, user_id);
    const requestedFullArticle = readBoolean(req.query.generate) !== false;
    const reservedCost = requestedFullArticle ? CREDIT_COSTS.full_article : CREDIT_COSTS.content_brief;
    const idempotencyKey = readCreditIdempotencyKey(req) ?? `geoarticle:${user_id}:${project_id}:${readString(req.query.prompt_id) ?? "auto"}:${readNumber(req.query.offset) ?? 0}:${requestedFullArticle ? "article" : "brief"}:${Date.now()}`;
    await spendCredits({
      userId: user_id,
      amount: reservedCost,
      action: requestedFullArticle ? "full_article" : "content_brief",
      description: requestedFullArticle ? "Full GEO article generation" : "GEO content brief generation",
      idempotencyKey,
      metadata: {
        project_id,
        prompt_id: readString(req.query.prompt_id),
        offset: readNumber(req.query.offset),
        generate: requestedFullArticle
      }
    });
    let data;
    try {
      data = await getGeoArticle({
        project_id,
        days: readNumber(req.query.days),
        topic: readString(req.query.topic),
        prompt_id: readString(req.query.prompt_id),
        model: readString(req.query.model),
        generate: readBoolean(req.query.generate),
        geo_country: readString(req.query.geo_country),
        offset: readNumber(req.query.offset)
      });
    } catch (error) {
      await refundCredits({
        userId: user_id,
        amount: reservedCost,
        action: "credit_refund",
        description: "Refund for failed GEO content generation",
        idempotencyKey: `refund:${idempotencyKey}`,
        metadata: { project_id }
      });
      throw error;
    }
    if (requestedFullArticle && data.status !== "GENERATED") {
      await refundCredits({
        userId: user_id,
        amount: CREDIT_COSTS.full_article - CREDIT_COSTS.content_brief,
        action: "credit_refund",
        description: "Partial refund because GEO article returned brief-only",
        idempotencyKey: `partial-refund:${idempotencyKey}`,
        metadata: { project_id, status: data.status }
      });
    }
    const saved = await upsertSavedContentBrief({ project_id, user_id, response: data });
    res.status(200).json({ ...data, saved_content_brief_id: saved.id });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (error instanceof Error && error.message === "NO_GEO_ARTICLE_OPPORTUNITY") {
      res.status(404).json({
        error: "No GEO article opportunity found",
        hint: "Run more prompts or try a wider date range."
      });
      return;
    }
    if (error instanceof Error && error.message === "NO_GEO_ARTICLE_EVIDENCE") {
      res.status(404).json({
        error: "No GEO article evidence found",
        hint: "Try without prompt_id or use a wider date range."
      });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Not enough credits")) {
      res.status(402).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to get GEO article" });
  }
}
function readCreditIdempotencyKey(req) {
  const header2 = req.header("Idempotency-Key");
  if (header2?.trim()) return header2.trim().slice(0, 180);
  return void 0;
}

// src/features/geoartciles/geoarticle_routes.ts
var router16 = (0, import_express16.Router)();
router16.get("/:project_id/saved", listSavedGeoArticlesController);
router16.get("/:project_id/saved/:content_brief_id", getSavedGeoArticleController);
router16.delete("/:project_id/saved/:content_brief_id", deleteSavedGeoArticleController);
router16.get("/:project_id", getGeoArticleController);
var geoarticle_routes_default = router16;

// src/features/admin/admin_routes.ts
var import_express17 = require("express");

// src/features/admin/admin_controller.ts
var import_zod8 = require("zod");

// src/features/admin/admin_service.ts
var import_client16 = require("@prisma/client");
init_prisma();
var ACCESS_STATUSES2 = [
  import_client16.SubscriptionStatus.ACTIVE,
  import_client16.SubscriptionStatus.TRIALING,
  import_client16.SubscriptionStatus.PAST_DUE
];
function pagination(input = {}) {
  const page = Math.max(1, input.page ?? 1);
  const page_size = Math.min(Math.max(1, input.page_size ?? 20), 100);
  return {
    page,
    page_size,
    skip: (page - 1) * page_size,
    take: page_size
  };
}
function pageResult(data, total, page, page_size) {
  return {
    data,
    page,
    page_size,
    total,
    total_pages: Math.max(1, Math.ceil(total / page_size))
  };
}
function startOfDay(daysAgo2) {
  const date = /* @__PURE__ */ new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo2);
  return date;
}
function readPlan(value) {
  if (!value) return void 0;
  if (value in import_client16.Plan) return value;
  return void 0;
}
function readRole(value) {
  if (!value) return void 0;
  if (value in import_client16.UserRole) return value;
  return void 0;
}
function readSubscriptionStatus(value) {
  if (!value) return void 0;
  if (value in import_client16.SubscriptionStatus) return value;
  return void 0;
}
var adminParsers = {
  readPlan,
  readRole,
  readSubscriptionStatus
};
async function getAdminOverview() {
  const sevenDaysAgo = startOfDay(7);
  const thirtyDaysAgo = startOfDay(30);
  const today = startOfDay(0);
  const [
    totalUsers,
    newUsers7d,
    totalProjects,
    totalPrompts,
    totalChats,
    openTickets,
    activeSubscriptions,
    revenueRows,
    usersByPlan,
    subscriptionsByStatus,
    recentUsers,
    recentTickets,
    todayJobRows
  ] = await Promise.all([
    prisma_default.user.count(),
    prisma_default.user.count({ where: { created_at: { gte: sevenDaysAgo } } }),
    prisma_default.project.count(),
    prisma_default.prompt.count(),
    prisma_default.chat.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
    prisma_default.helpCenter.count({ where: { is_resolved: false } }),
    prisma_default.subscription.count({ where: { status: { in: ACCESS_STATUSES2 } } }),
    prisma_default.subscription.groupBy({
      by: ["plan"],
      where: { status: { in: ACCESS_STATUSES2 } },
      _sum: { amount_cents: true },
      _count: { _all: true }
    }),
    prisma_default.user.groupBy({
      by: ["plan"],
      _count: { _all: true }
    }),
    prisma_default.subscription.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma_default.user.findMany({
      orderBy: { created_at: "desc" },
      take: 6,
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        is_verified: true,
        created_at: true,
        _count: { select: { projects: true } }
      }
    }),
    prisma_default.helpCenter.findMany({
      orderBy: { created_at: "desc" },
      take: 6,
      select: {
        id: true,
        email: true,
        subject: true,
        is_resolved: true,
        created_at: true
      }
    }),
    prisma_default.scrapeJob.groupBy({
      by: ["status"],
      where: { created_at: { gte: today } },
      _count: { _all: true }
    })
  ]);
  const estimatedMrrCents = revenueRows.reduce((sum, row) => sum + (row._sum.amount_cents ?? 0), 0);
  const todayJobs = {
    total: todayJobRows.reduce((sum, row) => sum + row._count._all, 0),
    queued: todayJobRows.find((row) => row.status === "QUEUED")?._count._all ?? 0,
    running: todayJobRows.find((row) => row.status === "RUNNING")?._count._all ?? 0,
    success: todayJobRows.find((row) => row.status === "SUCCESS")?._count._all ?? 0,
    failed: todayJobRows.find((row) => row.status === "FAILED")?._count._all ?? 0,
    manual_needed: todayJobRows.find((row) => row.status === "MANUAL_NEEDED")?._count._all ?? 0,
    rate_limited: todayJobRows.find((row) => row.status === "RATE_LIMITED")?._count._all ?? 0
  };
  return {
    summary: {
      total_users: totalUsers,
      new_users_7d: newUsers7d,
      total_projects: totalProjects,
      total_prompts: totalPrompts,
      chats_30d: totalChats,
      open_tickets: openTickets,
      active_subscriptions: activeSubscriptions,
      estimated_mrr_cents: estimatedMrrCents
    },
    today_jobs: todayJobs,
    users_by_plan: Object.values(import_client16.Plan).map((plan) => ({
      plan,
      count: usersByPlan.find((row) => row.plan === plan)?._count._all ?? 0
    })),
    subscriptions_by_status: Object.values(import_client16.SubscriptionStatus).map((status) => ({
      status,
      count: subscriptionsByStatus.find((row) => row.status === status)?._count._all ?? 0
    })),
    revenue_by_plan: Object.values(import_client16.Plan).map((plan) => {
      const row = revenueRows.find((item) => item.plan === plan);
      return {
        plan,
        subscriptions: row?._count._all ?? 0,
        amount_cents: row?._sum.amount_cents ?? 0
      };
    }),
    recent_users: recentUsers,
    recent_tickets: recentTickets
  };
}
async function listAdminUsers(input = {}) {
  const { page, page_size, skip, take } = pagination(input);
  const where = {};
  const q = input.q?.trim();
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { projects: { some: { brand_name: { contains: q, mode: "insensitive" } } } }
    ];
  }
  if (input.plan) where.plan = input.plan;
  if (input.role) where.role = input.role;
  const [total, users] = await Promise.all([
    prisma_default.user.count({ where }),
    prisma_default.user.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        account_type: true,
        is_verified: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            projects: true,
            subscriptions: true,
            helpcenter: true
          }
        },
        subscriptions: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            id: true,
            plan: true,
            status: true,
            amount_cents: true,
            current_period_end: true,
            cancel_at_period_end: true
          }
        }
      }
    })
  ]);
  return pageResult(
    users.map(({ subscriptions, ...user }) => ({
      ...user,
      latest_subscription: subscriptions[0] ?? null
    })),
    total,
    page,
    page_size
  );
}
async function getAdminUser(user_id) {
  const user = await prisma_default.user.findUnique({
    where: { id: user_id },
    select: {
      id: true,
      email: true,
      role: true,
      plan: true,
      account_type: true,
      is_verified: true,
      created_at: true,
      updated_at: true,
      projects: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          brand_name: true,
          brand_url: true,
          brand_location: true,
          created_at: true,
          _count: {
            select: {
              prompts: true,
              competitors: true,
              runs: true
            }
          }
        }
      },
      subscriptions: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          plan: true,
          status: true,
          amount_cents: true,
          currency: true,
          current_period_start: true,
          current_period_end: true,
          cancel_at_period_end: true,
          trial_starts_at: true,
          trial_ends_at: true,
          stripe_customer_id: true,
          stripe_subscription_id: true,
          created_at: true
        }
      },
      plan_usages: {
        orderBy: { period_start: "desc" },
        take: 6
      },
      helpcenter: {
        orderBy: { created_at: "desc" },
        take: 10,
        select: {
          id: true,
          subject: true,
          message: true,
          is_resolved: true,
          created_at: true,
          updated_at: true
        }
      },
      _count: {
        select: {
          projects: true,
          helpcenter: true
        }
      }
    }
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}
async function listAdminProjects(input = {}) {
  const { page, page_size, skip, take } = pagination(input);
  const q = input.q?.trim();
  const where = q ? {
    OR: [
      { brand_name: { contains: q, mode: "insensitive" } },
      { brand_url: { contains: q, mode: "insensitive" } },
      { brand_location: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } }
    ]
  } : {};
  const [total, projects] = await Promise.all([
    prisma_default.project.count({ where }),
    prisma_default.project.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: {
        id: true,
        brand_name: true,
        brand_url: true,
        brand_location: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            plan: true
          }
        },
        _count: {
          select: {
            prompts: true,
            competitors: true,
            runs: true,
            scrape_jobs: true,
            topics: true
          }
        }
      }
    })
  ]);
  return pageResult(projects, total, page, page_size);
}
async function listAdminSubscriptions(input = {}) {
  const { page, page_size, skip, take } = pagination(input);
  const where = {};
  const q = input.q?.trim();
  if (input.plan) where.plan = input.plan;
  if (input.status) where.status = input.status;
  if (q) {
    where.OR = [
      { stripe_customer_id: { contains: q, mode: "insensitive" } },
      { stripe_subscription_id: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } }
    ];
  }
  const [total, subscriptions] = await Promise.all([
    prisma_default.subscription.count({ where }),
    prisma_default.subscription.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: {
        id: true,
        plan: true,
        status: true,
        amount_cents: true,
        currency: true,
        current_period_start: true,
        current_period_end: true,
        cancel_at_period_end: true,
        trial_starts_at: true,
        trial_ends_at: true,
        stripe_customer_id: true,
        stripe_subscription_id: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            plan: true
          }
        }
      }
    })
  ]);
  return pageResult(subscriptions, total, page, page_size);
}
async function listAdminTickets(input = {}) {
  const { page, page_size, skip, take } = pagination(input);
  const where = {};
  const q = input.q?.trim();
  if (input.status === "open") where.is_resolved = false;
  if (input.status === "resolved") where.is_resolved = true;
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } }
    ];
  }
  const [total, tickets] = await Promise.all([
    prisma_default.helpCenter.count({ where }),
    prisma_default.helpCenter.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: {
        id: true,
        email: true,
        subject: true,
        message: true,
        is_resolved: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            id: true,
            email: true,
            plan: true
          }
        }
      }
    })
  ]);
  return pageResult(tickets, total, page, page_size);
}
async function setAdminTicketResolved(ticket_id, is_resolved) {
  const ticket = await prisma_default.helpCenter.findUnique({
    where: { id: ticket_id },
    select: { id: true }
  });
  if (!ticket) throw new Error("TICKET_NOT_FOUND");
  return prisma_default.helpCenter.update({
    where: { id: ticket_id },
    data: { is_resolved },
    select: {
      id: true,
      email: true,
      subject: true,
      message: true,
      is_resolved: true,
      created_at: true,
      updated_at: true
    }
  });
}

// src/features/admin/admin_controller.ts
var paginationQuerySchema = import_zod8.z.object({
  page: import_zod8.z.coerce.number().int().min(1).optional(),
  page_size: import_zod8.z.coerce.number().int().min(1).max(100).optional(),
  q: import_zod8.z.string().trim().optional()
});
var ticketResolveSchema = import_zod8.z.object({
  is_resolved: import_zod8.z.boolean()
});
function firstError(error) {
  return Object.values(error.flatten().fieldErrors).flat().find(Boolean) ?? "Invalid request";
}
function handleAdminError(error, res, fallback) {
  if (error instanceof Error && error.message === "USER_NOT_FOUND") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (error instanceof Error && error.message === "TICKET_NOT_FOUND") {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  console.error("[admin_controller]", fallback, error);
  res.status(500).json({ error: fallback });
}
async function getAdminOverviewController(_req, res) {
  try {
    res.status(200).json(await getAdminOverview());
  } catch (error) {
    handleAdminError(error, res, "Failed to get admin overview");
  }
}
async function listAdminUsersController(req, res) {
  const parsed = paginationQuerySchema.extend({
    plan: import_zod8.z.string().optional(),
    role: import_zod8.z.string().optional()
  }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstError(parsed.error) });
    return;
  }
  try {
    res.status(200).json(await listAdminUsers({
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      q: parsed.data.q,
      plan: adminParsers.readPlan(parsed.data.plan),
      role: adminParsers.readRole(parsed.data.role)
    }));
  } catch (error) {
    handleAdminError(error, res, "Failed to list users");
  }
}
async function getAdminUserController(req, res) {
  try {
    const { user_id } = req.params;
    if (!user_id || Array.isArray(user_id)) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }
    res.status(200).json(await getAdminUser(user_id));
  } catch (error) {
    handleAdminError(error, res, "Failed to get user");
  }
}
async function listAdminProjectsController(req, res) {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstError(parsed.error) });
    return;
  }
  try {
    res.status(200).json(await listAdminProjects(parsed.data));
  } catch (error) {
    handleAdminError(error, res, "Failed to list projects");
  }
}
async function listAdminSubscriptionsController(req, res) {
  const parsed = paginationQuerySchema.extend({
    plan: import_zod8.z.string().optional(),
    status: import_zod8.z.string().optional()
  }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstError(parsed.error) });
    return;
  }
  try {
    res.status(200).json(await listAdminSubscriptions({
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      q: parsed.data.q,
      plan: adminParsers.readPlan(parsed.data.plan),
      status: adminParsers.readSubscriptionStatus(parsed.data.status)
    }));
  } catch (error) {
    handleAdminError(error, res, "Failed to list subscriptions");
  }
}
async function listAdminTicketsController(req, res) {
  const parsed = paginationQuerySchema.extend({
    status: import_zod8.z.enum(["open", "resolved", "all"]).optional()
  }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstError(parsed.error) });
    return;
  }
  try {
    res.status(200).json(await listAdminTickets({
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      q: parsed.data.q,
      status: parsed.data.status ?? "open"
    }));
  } catch (error) {
    handleAdminError(error, res, "Failed to list tickets");
  }
}
async function setAdminTicketResolvedController(req, res) {
  const parsed = ticketResolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstError(parsed.error) });
    return;
  }
  try {
    const { ticket_id } = req.params;
    if (!ticket_id || Array.isArray(ticket_id)) {
      res.status(400).json({ error: "ticket_id is required" });
      return;
    }
    res.status(200).json(await setAdminTicketResolved(ticket_id, parsed.data.is_resolved));
  } catch (error) {
    handleAdminError(error, res, "Failed to update ticket");
  }
}

// src/features/admin/admin_routes.ts
var router17 = (0, import_express17.Router)();
router17.get("/overview", getAdminOverviewController);
router17.get("/users", listAdminUsersController);
router17.get("/users/:user_id", getAdminUserController);
router17.get("/projects", listAdminProjectsController);
router17.get("/subscriptions", listAdminSubscriptionsController);
router17.get("/tickets", listAdminTicketsController);
router17.patch("/tickets/:ticket_id/resolve", setAdminTicketResolvedController);
var admin_routes_default = router17;

// src/features/demo/demo_routes.ts
var import_express18 = require("express");

// src/features/demo/demo_controller.ts
var import_zod9 = require("zod");

// src/features/demo/demo_service.ts
init_prisma();
function normalizeDemoInput(input) {
  return {
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() || void 0,
    notes: input.notes?.trim() || void 0,
    timezone: input.timezone.trim(),
    countryCode: input.countryCode?.trim().toUpperCase() || void 0,
    countryName: input.countryName?.trim() || void 0,
    localTimeLabel: input.localTimeLabel?.trim() || void 0,
    istTimeLabel: input.istTimeLabel?.trim() || void 0
  };
}
function getIstHourMinute(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return { hour, minute };
}
function assertValidTimezone(timezone2) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone2 }).format(/* @__PURE__ */ new Date());
  } catch {
    throw new Error("Selected timezone is not valid");
  }
}
function isInsideIstDemoWindow(date) {
  const { hour, minute } = getIstHourMinute(date);
  const minutes = hour * 60 + minute;
  return minutes >= 7 * 60 && minutes < 23 * 60;
}
async function bookDemo(input) {
  const normalizedInput = normalizeDemoInput(input);
  if (!isWorkEmail(normalizedInput.email)) {
    throw new Error("Only work/business email addresses are allowed.");
  }
  assertValidTimezone(normalizedInput.timezone);
  if (normalizedInput.scheduledAt <= /* @__PURE__ */ new Date()) {
    throw new Error("Demo time must be scheduled in the future");
  }
  if (!isInsideIstDemoWindow(normalizedInput.scheduledAt)) {
    throw new Error("Demo slots are available only between 7:00 AM and 11:00 PM IST");
  }
  const existingBooking = await prisma_default.bookDemo.findFirst({
    where: {
      email: normalizedInput.email,
      scheduledAt: normalizedInput.scheduledAt,
      status: {
        in: ["PENDING", "CONFIRMED"]
      }
    },
    select: { id: true }
  });
  if (existingBooking) {
    throw new Error("You have already booked a demo for this time");
  }
  return prisma_default.bookDemo.create({
    data: {
      name: normalizedInput.name,
      email: normalizedInput.email,
      company: normalizedInput.company,
      notes: normalizedInput.notes,
      scheduledAt: normalizedInput.scheduledAt,
      timezone: normalizedInput.timezone,
      countryCode: normalizedInput.countryCode,
      countryName: normalizedInput.countryName,
      localTimeLabel: normalizedInput.localTimeLabel,
      istTimeLabel: normalizedInput.istTimeLabel
    }
  });
}
async function getPendingDemos() {
  return prisma_default.bookDemo.findMany({
    where: {
      status: "PENDING"
    },
    orderBy: {
      scheduledAt: "asc"
    }
  });
}

// src/features/demo/demo_controller.ts
var createDemoSchema = import_zod9.z.object({
  name: import_zod9.z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  email: import_zod9.z.string().trim().email("Invalid email address"),
  company: import_zod9.z.string().trim().max(160, "Company name is too long").optional(),
  notes: import_zod9.z.string().trim().max(2e3, "Notes are too long").optional(),
  scheduledAt: import_zod9.z.coerce.date(),
  timezone: import_zod9.z.string().trim().min(2, "Timezone is required").max(80, "Timezone is too long"),
  countryCode: import_zod9.z.string().trim().length(2, "Country is required").optional(),
  countryName: import_zod9.z.string().trim().min(2, "Country is required").max(120, "Country name is too long").optional(),
  localTimeLabel: import_zod9.z.string().trim().max(160, "Local time label is too long").optional(),
  istTimeLabel: import_zod9.z.string().trim().max(160, "IST time label is too long").optional()
});
function firstError2(error) {
  return Object.values(error.flatten().fieldErrors).flat().find(Boolean) ?? "Invalid demo booking payload";
}
async function bookDemoController(req, res) {
  const parsed = createDemoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: firstError2(parsed.error),
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const demo = await bookDemo(parsed.data);
    res.status(201).json({
      success: true,
      demo
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to book demo";
    const statusCode = message === "You have already booked a demo for this time" ? 409 : message === "Only work/business email addresses are allowed." ? 422 : message === "Selected timezone is not valid" ? 400 : message === "Demo slots are available only between 7:00 AM and 11:00 PM IST" ? 400 : message === "Demo time must be scheduled in the future" ? 400 : 500;
    if (statusCode === 500) {
      console.error("[demo_controller:bookDemo]", error);
      res.status(500).json({ success: false, error: "Failed to book demo" });
      return;
    }
    res.status(statusCode).json({
      success: false,
      error: message
    });
  }
}
async function getPendingDemosController(_req, res) {
  try {
    const demos = await getPendingDemos();
    res.status(200).json({
      success: true,
      demos
    });
  } catch (error) {
    console.error("[demo_controller:getPendingDemos]", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pending demos"
    });
  }
}

// src/features/demo/demo_routes.ts
var router18 = (0, import_express18.Router)();
router18.post("/", bookDemoController);
router18.get("/pending", requireAuth, requireAdmin, getPendingDemosController);
var demo_routes_default = router18;

// src/features/product_tour/product_tour_routes.ts
var import_express19 = require("express");

// src/features/product_tour/product_tour_service.ts
init_prisma();
async function getProductTourStatus(userId) {
  const user = await prisma_default.user.findUnique({
    where: { id: userId },
    select: {
      product_tour_completed: true,
      product_tour_completed_at: true
    }
  });
  if (!user) {
    throw new Error("User not found");
  }
  return {
    completed: user.product_tour_completed,
    completed_at: user.product_tour_completed_at
  };
}
async function completeProductTour(userId) {
  const user = await prisma_default.user.update({
    where: { id: userId },
    data: {
      product_tour_completed: true,
      product_tour_completed_at: /* @__PURE__ */ new Date()
    },
    select: {
      product_tour_completed: true,
      product_tour_completed_at: true
    }
  });
  return {
    completed: user.product_tour_completed,
    completed_at: user.product_tour_completed_at
  };
}

// src/features/product_tour/product_tour_controller.ts
async function getProductTourStatusController(req, res) {
  try {
    const status = await getProductTourStatus(req.user.id);
    res.status(200).json(status);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("[product_tour_controller:getStatus]", error);
    res.status(500).json({ error: "Failed to load product tour status" });
  }
}
async function completeProductTourController(req, res) {
  try {
    const status = await completeProductTour(req.user.id);
    res.status(200).json(status);
  } catch (error) {
    console.error("[product_tour_controller:complete]", error);
    res.status(500).json({ error: "Failed to update product tour status" });
  }
}

// src/features/product_tour/product_tour_routes.ts
var router19 = (0, import_express19.Router)();
router19.get("/status", (req, res) => getProductTourStatusController(req, res));
router19.post("/complete", (req, res) => completeProductTourController(req, res));
router19.post("/skip", (req, res) => completeProductTourController(req, res));
var product_tour_routes_default = router19;

// src/features/report/report_routes.ts
var import_express20 = require("express");

// src/features/report/report_controller.ts
var import_axios8 = __toESM(require("axios"), 1);
init_prisma();
init_credits_service2();
init_project_access();
init_plan_config();
init_entitlements();
var REPORTS_API_BASE_URL = (process.env.AI_REPORTS_API_BASE_URL ?? process.env.AGENTS_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
var reportsApi = import_axios8.default.create({
  baseURL: REPORTS_API_BASE_URL,
  timeout: 12e4
});
async function listReportsController(req, res) {
  try {
    const projectId = readString2(req.query.project_id);
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(projectId, req.user.id);
    const response = await reportsApi.get("/reports", {
      params: { project_id: projectId },
      headers: forwardAuth(req)
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleReportProxyError(error, res, "Failed to list reports");
  }
}
async function getReportController(req, res) {
  try {
    const reportId = req.params.report_id;
    if (!reportId || Array.isArray(reportId)) {
      res.status(400).json({ error: "report_id is required" });
      return;
    }
    const userId = req.user.id;
    const report2 = await prisma_default.aIReport.findFirst({
      where: { id: reportId, user_id: userId },
      select: { id: true }
    });
    if (!report2) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    const response = await reportsApi.get(`/reports/${encodeURIComponent(reportId)}`, {
      headers: forwardAuth(req)
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleReportProxyError(error, res, "Failed to get report");
  }
}
async function generateReportController(req, res) {
  const userId = req.user.id;
  let idempotencyKey = null;
  try {
    const projectId = readString2(req.body?.project_id);
    const periodType = readString2(req.body?.period_type) ?? "7d";
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(projectId, userId);
    const access = await getEffectivePlanAccess(userId);
    if (access.trial.active) {
      const trialReports = await prisma_default.aIReport.count({ where: { user_id: userId, created_at: { gte: access.trial.starts_at ?? /* @__PURE__ */ new Date(0) } } });
      if (trialReports >= 2) {
        res.status(402).json({ error: "Your free trial includes 2 AI reports. Add credits to generate more." });
        return;
      }
    }
    idempotencyKey = readIdempotencyKey(req) ?? `ai-report:${userId}:${projectId}:${periodType}:${Date.now()}`;
    await spendCredits({
      userId,
      amount: CREDIT_COSTS.ai_visibility_report,
      action: "ai_visibility_report",
      description: "AI visibility report generation",
      idempotencyKey,
      metadata: { project_id: projectId, period_type: periodType }
    });
    try {
      const response = await reportsApi.post("/reports/generate", {
        project_id: projectId,
        period_type: periodType
      }, {
        headers: {
          ...forwardAuth(req),
          "Idempotency-Key": idempotencyKey
        }
      });
      res.status(response.status).json(response.data);
    } catch (error) {
      await refundCredits({
        userId,
        amount: CREDIT_COSTS.ai_visibility_report,
        action: "credit_refund",
        description: "Refund for failed AI visibility report generation",
        idempotencyKey: `refund:${idempotencyKey}`,
        metadata: { project_id: projectId, period_type: periodType }
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not enough credits")) {
      res.status(402).json({ error: error.message });
      return;
    }
    handleReportProxyError(error, res, "Failed to generate report");
  }
}
function forwardAuth(req) {
  const authorization = req.header("authorization");
  return authorization ? { Authorization: authorization } : void 0;
}
function readString2(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function readIdempotencyKey(req) {
  const header2 = req.header("Idempotency-Key");
  if (header2?.trim()) return header2.trim().slice(0, 180);
  return void 0;
}
function handleReportProxyError(error, res, fallback) {
  if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (import_axios8.default.isAxiosError(error)) {
    const status = error.response?.status ?? 502;
    const data = error.response?.data;
    res.status(status).json(
      typeof data === "object" && data !== null ? data : { error: fallback }
    );
    return;
  }
  console.error("[reports proxy] Error:", error);
  res.status(500).json({ error: fallback });
}

// src/features/report/report_routes.ts
var router20 = (0, import_express20.Router)();
router20.get("/", listReportsController);
router20.get("/:report_id", getReportController);
router20.post("/generate", generateReportController);
var report_routes_default = router20;

// src/features/artifacts/artifact_routes.ts
var import_express21 = require("express");

// src/features/artifacts/artifact_service.ts
var import_crypto6 = __toESM(require("crypto"), 1);
var import_fs2 = __toESM(require("fs"), 1);
init_prisma();
var signedUrlCache = /* @__PURE__ */ new Map();
function parseGsUri(uri) {
  const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    bucket: match[1],
    object: match[2]
  };
}
function encodeObjectPath(objectName) {
  return objectName.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}
function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
function sha256Hex(value) {
  return import_crypto6.default.createHash("sha256").update(value).digest("hex");
}
function loadServiceAccount() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured");
  const raw = import_fs2.default.readFileSync(keyPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Google service account key is missing client_email or private_key");
  }
  return parsed;
}
function signGcsUrl(input) {
  const serviceAccount = loadServiceAccount();
  const now = /* @__PURE__ */ new Date();
  const timestamp = formatAmzDate(now);
  const dateStamp = timestamp.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/storage/goog4_request`;
  const credential = `${serviceAccount.client_email}/${credentialScope}`;
  const host = `${input.bucket}.storage.googleapis.com`;
  const canonicalUri = `/${encodeObjectPath(input.objectName)}`;
  const canonicalQuery = [
    ["X-Goog-Algorithm", "GOOG4-RSA-SHA256"],
    ["X-Goog-Credential", credential],
    ["X-Goog-Date", timestamp],
    ["X-Goog-Expires", String(input.expiresInSeconds)],
    ["X-Goog-SignedHeaders", "host"]
  ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  const canonicalHeaders = `host:${host}
`;
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "GOOG4-RSA-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signature = import_crypto6.default.sign("RSA-SHA256", Buffer.from(stringToSign), serviceAccount.private_key).toString("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Goog-Signature=${signature}`;
}
async function getChatArtifactSignedUrl(input) {
  const chat = await prisma_default.chat.findFirst({
    where: {
      id: input.chat_id,
      prompt: {
        project: {
          user_id: input.user_id
        }
      }
    },
    select: {
      id: true,
      screenshot_path: true,
      created_at: true
    }
  });
  if (!chat) throw new Error("CHAT_NOT_FOUND");
  if (!chat.screenshot_path) throw new Error("ARTIFACT_NOT_FOUND");
  const parsed = parseGsUri(chat.screenshot_path);
  if (!parsed) throw new Error("ARTIFACT_NOT_CLOUD_BACKED");
  const retentionHours = Number(process.env.ARTIFACT_RETENTION_HOURS ?? 24);
  const artifactExpiresAt = chat.created_at.getTime() + retentionHours * 60 * 60 * 1e3;
  const now = Date.now();
  if (artifactExpiresAt <= now) throw new Error("ARTIFACT_EXPIRED");
  const cacheKey = chat.screenshot_path;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expires_at - 3e4 > now) {
    return {
      url: cached.url,
      expires_at: new Date(cached.expires_at).toISOString(),
      cached: true
    };
  }
  const configuredTtl = Number(process.env.ARTIFACT_SIGNED_URL_TTL_SECONDS ?? 600);
  const ttlSeconds = Math.max(60, Math.min(configuredTtl, Math.floor((artifactExpiresAt - now) / 1e3)));
  const url = signGcsUrl({
    bucket: parsed.bucket,
    objectName: parsed.object,
    expiresInSeconds: ttlSeconds
  });
  const expiresAt = now + ttlSeconds * 1e3;
  signedUrlCache.set(cacheKey, { url, expires_at: expiresAt });
  return {
    url,
    expires_at: new Date(expiresAt).toISOString(),
    cached: false
  };
}

// src/features/artifacts/artifact_controller.ts
async function getChatArtifactUrlController(req, res) {
  try {
    const { chat_id } = req.params;
    if (!chat_id || Array.isArray(chat_id)) {
      res.status(400).json({ error: "chat_id is required" });
      return;
    }
    const user_id = req.user.id;
    const result = await getChatArtifactSignedUrl({ chat_id, user_id });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CHAT_NOT_FOUND") {
        res.status(404).json({ error: "Chat not found" });
        return;
      }
      if (error.message === "ARTIFACT_NOT_FOUND") {
        res.status(404).json({ error: "No screenshot is available for this chat" });
        return;
      }
      if (error.message === "ARTIFACT_EXPIRED") {
        res.status(410).json({ error: "This screenshot has expired" });
        return;
      }
      if (error.message === "ARTIFACT_NOT_CLOUD_BACKED") {
        res.status(422).json({ error: "This screenshot is not stored in cloud storage yet" });
        return;
      }
    }
    console.error("Failed to create artifact signed URL", error);
    res.status(500).json({ error: "Failed to open screenshot" });
  }
}

// src/features/artifacts/artifact_routes.ts
var router21 = (0, import_express21.Router)();
router21.get("/chats/:chat_id/screenshot-url", getChatArtifactUrlController);
var artifact_routes_default = router21;

// src/features/action_queue/action_queue_routes.ts
var import_express22 = require("express");

// src/features/action_queue/action_queue_controller.ts
var import_axios9 = __toESM(require("axios"), 1);
init_project_access();

// src/features/action_queue/action_queue_service.ts
init_prisma();

// src/features/action_queue/action_queue_types.ts
var ACTION_QUEUE_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "DISMISSED"];

// src/features/action_queue/action_queue_service.ts
async function listActionQueueItems({
  projectId,
  userId,
  status,
  category
}) {
  const items = await prisma_default.actionQueueItem.findMany({
    where: {
      project_id: projectId,
      user_id: userId,
      ...isKnownStatus(status) ? { status } : {},
      ...category ? { category: category.toUpperCase() } : {}
    },
    orderBy: [
      { impact_score: "desc" },
      { updated_at: "desc" }
    ]
  });
  return items.sort((a, b) => {
    const statusDelta = statusRank(a.status) - statusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return b.impact_score - a.impact_score;
  });
}
async function updateActionQueueItemStatus({
  itemId,
  userId,
  status
}) {
  const existing = await prisma_default.actionQueueItem.findFirst({
    where: { id: itemId, user_id: userId },
    select: { id: true }
  });
  if (!existing) {
    throw new Error("ACTION_QUEUE_ITEM_NOT_FOUND");
  }
  return prisma_default.actionQueueItem.update({
    where: { id: itemId },
    data: {
      status,
      completed_at: status === "DONE" ? /* @__PURE__ */ new Date() : null
    }
  });
}
function normalizeActionStatus(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return isKnownStatus(normalized) ? normalized : null;
}
function isKnownStatus(value) {
  return typeof value === "string" && ACTION_QUEUE_STATUSES.includes(value);
}
function statusRank(status) {
  const rank = ["OPEN", "IN_PROGRESS", "DONE", "DISMISSED"].indexOf(status);
  return rank === -1 ? 99 : rank;
}
function priorityRank(priority) {
  const rank = ["HIGH", "MEDIUM", "LOW"].indexOf(priority);
  return rank === -1 ? 99 : rank;
}

// src/features/action_queue/action_queue_controller.ts
var AGENTS_API_BASE_URL = (process.env.AI_REPORTS_API_BASE_URL ?? process.env.AGENTS_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
var agentsApi = import_axios9.default.create({
  baseURL: AGENTS_API_BASE_URL,
  timeout: 12e4
});
async function listActionQueueController(req, res) {
  try {
    const projectId = readString3(req.query.project_id);
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const userId = req.user.id;
    await assertProjectAccess(projectId, userId);
    const items = await listActionQueueItems({
      projectId,
      userId,
      status: readString3(req.query.status),
      category: readString3(req.query.category)
    });
    res.json(items);
  } catch (error) {
    handleActionQueueError(error, res, "Failed to load action queue");
  }
}
async function generateActionQueueController(req, res) {
  try {
    const projectId = readString3(req.body?.project_id);
    const lookbackDays = readPositiveNumber(req.body?.lookback_days) ?? 30;
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const userId = req.user.id;
    await assertProjectAccess(projectId, userId);
    const response = await agentsApi.post("/action-queue/generate", {
      project_id: projectId,
      lookback_days: lookbackDays
    }, {
      headers: forwardAuth2(req)
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleActionQueueError(error, res, "Failed to refresh action queue");
  }
}
async function updateActionQueueController(req, res) {
  try {
    const itemId = readString3(req.params.item_id);
    const status = normalizeActionStatus(req.body?.status);
    if (!itemId) {
      res.status(400).json({ error: "item_id is required" });
      return;
    }
    if (!status) {
      res.status(400).json({ error: "A valid status is required" });
      return;
    }
    const item = await updateActionQueueItemStatus({
      itemId,
      userId: req.user.id,
      status
    });
    res.json(item);
  } catch (error) {
    handleActionQueueError(error, res, "Failed to update action");
  }
}
function forwardAuth2(req) {
  const authorization = req.header("authorization");
  return authorization ? { Authorization: authorization } : void 0;
}
function readString3(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function readPositiveNumber(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(Math.round(numeric), 90) : void 0;
}
function handleActionQueueError(error, res, fallback) {
  if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (error instanceof Error && error.message === "ACTION_QUEUE_ITEM_NOT_FOUND") {
    res.status(404).json({ error: "Action not found" });
    return;
  }
  if (import_axios9.default.isAxiosError(error)) {
    const status = error.response?.status ?? 502;
    const data = error.response?.data;
    res.status(status).json(
      typeof data === "object" && data !== null ? data : { error: fallback }
    );
    return;
  }
  console.error("[action queue] Error:", error);
  res.status(500).json({ error: fallback });
}

// src/features/action_queue/action_queue_routes.ts
var router22 = (0, import_express22.Router)();
router22.get("/", listActionQueueController);
router22.post("/generate", generateActionQueueController);
router22.patch("/:item_id", updateActionQueueController);
var action_queue_routes_default = router22;

// src/features/customer_support_agent/customer_support_agent_routes.ts
var import_express23 = require("express");

// src/features/customer_support_agent/customer_support_agent_controller.ts
var import_zod10 = require("zod");

// src/features/customer_support_agent/customer_support_agent_service.ts
init_prisma();

// src/features/customer_support_agent/customer_support_agent_context.ts
init_prisma();
init_subscription_service();
async function buildCustomerSupportAgentContext(user_id, project_id) {
  const [user, plan, recentTickets, selectedProject] = await Promise.all([
    prisma_default.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        email: true,
        plan: true,
        created_at: true
      }
    }),
    getMyPlan(user_id),
    prisma_default.helpCenter.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" },
      take: 6,
      select: {
        id: true,
        subject: true,
        message: true,
        is_resolved: true,
        created_at: true
      }
    }),
    project_id ? getProjectSupportContext(user_id, project_id) : getLatestProjectSupportContext(user_id)
  ]);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  return {
    user: {
      ...user,
      plan: plan.plan,
      effective_plan: plan.effective_plan
    },
    subscription: {
      status: plan.status,
      current_period_start: plan.subscription?.current_period_start ?? null,
      current_period_end: plan.subscription?.current_period_end ?? null,
      trial_starts_at: plan.trial.starts_at,
      trial_ends_at: plan.trial.ends_at,
      trial_active: plan.trial.active,
      trial_days_left: plan.trial.days_left,
      cancel_at_period_end: Boolean(plan.subscription?.cancel_at_period_end)
    },
    limits: plan.limits,
    available_plans: [],
    usage: {
      projects: plan.usage.project_count,
      prompts: plan.usage.prompt_count,
      competitors: plan.usage.competitor_count,
      credits_used: plan.usage.credits_used,
      credits_remaining: plan.usage.credits_remaining,
      monthly_runs_used: plan.usage.monthly_runs_used
    },
    selected_project: selectedProject,
    recent_tickets: recentTickets
  };
}
async function getLatestProjectSupportContext(user_id) {
  const project = await prisma_default.project.findFirst({
    where: { user_id },
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      brand_name: true,
      brand_url: true,
      brand_location: true,
      _count: {
        select: {
          prompts: true,
          competitors: true,
          runs: true
        }
      }
    }
  });
  if (!project) return null;
  return attachJobCounts(project);
}
async function getProjectSupportContext(user_id, project_id) {
  const project = await prisma_default.project.findFirst({
    where: { id: project_id, user_id },
    select: {
      id: true,
      brand_name: true,
      brand_url: true,
      brand_location: true,
      _count: {
        select: {
          prompts: true,
          competitors: true,
          runs: true
        }
      }
    }
  });
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }
  return attachJobCounts(project);
}
async function attachJobCounts(project) {
  const [failedJobs, queuedJobs, runningJobs] = await Promise.all([
    prisma_default.scrapeJob.count({ where: { project_id: project.id, status: "FAILED" } }),
    prisma_default.scrapeJob.count({ where: { project_id: project.id, status: "QUEUED" } }),
    prisma_default.scrapeJob.count({ where: { project_id: project.id, status: "RUNNING" } })
  ]);
  return {
    id: project.id,
    brand_name: project.brand_name,
    brand_url: project.brand_url,
    brand_location: project.brand_location,
    prompts: project._count.prompts,
    competitors: project._count.competitors,
    runs: project._count.runs,
    failed_jobs: failedJobs,
    queued_jobs: queuedJobs,
    running_jobs: runningJobs
  };
}

// src/features/customer_support_agent/customer_support_agent_escalation.ts
var MANUAL_REVIEW_PATTERNS = [
  /\b(human|manual review|real person|support team|talk to someone|call me)\b/i,
  /\b(not satisfied|not helpful|doesn't help|does not help|still broken|again and again)\b/i
];
var SENSITIVE_PATTERNS = [
  /\b(refund|chargeback|charged|invoice|payment failed|card|billing dispute|cancel subscription)\b/i,
  /\b(delete account|security|password|unauthorized|compromised|breach|data leak)\b/i
];
var INVESTIGATION_PATTERNS = [
  /\b(scrape failed|scraping failed|worker failed|brightdata|redis|queue stuck|job failed)\b/i,
  /\b(report failed|pdf failed|pptx failed|export failed|credits deducted|wrong data|data is wrong)\b/i,
  /\b(404|500|error|bug|crash|not working|not loading|blank)\b/i
];
function detectEscalationSignal(message, history = []) {
  void history;
  const currentMessageOnly = message;
  if (MANUAL_REVIEW_PATTERNS.some((pattern) => pattern.test(currentMessageOnly))) {
    return { shouldEscalate: true, reason: "User requested manual support or is not satisfied." };
  }
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(currentMessageOnly))) {
    return { shouldEscalate: true, reason: "Sensitive billing, account, or security request." };
  }
  if (INVESTIGATION_PATTERNS.some((pattern) => pattern.test(currentMessageOnly))) {
    return { shouldEscalate: true, reason: "Issue likely requires investigation by the team." };
  }
  return { shouldEscalate: false, reason: null };
}
function inferSupportCategory(message) {
  const clean2 = message.toLowerCase();
  if (/\b(refund|invoice|billing|charged|payment|card|subscription|trial|cancel)\b/.test(clean2)) return "billing";
  if (/\b(credit|credits|deducted|balance)\b/.test(clean2)) return "credits";
  if (/\b(scrape|scraping|worker|queue|redis|brightdata|job)\b/.test(clean2)) return "scraping";
  if (/\b(report|pdf|pptx|export)\b/.test(clean2)) return "reports";
  if (/\b(wrong data|data quality|source|citation|competitor|brand wrong)\b/.test(clean2)) return "data_quality";
  if (/\b(password|login|otp|account|email)\b/.test(clean2)) return "account";
  if (/\b(bug|error|crash|404|500|not working|not loading)\b/.test(clean2)) return "bug";
  if (/\b(plan|starter|growth|pro|limit|prompt|project)\b/.test(clean2)) return "subscription";
  return "product";
}

// src/features/customer_support_agent/customer_support_agent_prompt.ts
function buildCustomerSupportAgentSystemPrompt() {
  return [
    "You are DeepMention Support Agent, a calm and precise customer support assistant inside DeepMention.",
    "Your job is to answer account, subscription, credits, product, scraping, reports, and billing-adjacent questions using only the provided account context and product rules.",
    "You are not Sara. Sara gives GEO strategy. You provide support and troubleshooting.",
    "",
    "Safety and accuracy rules:",
    "- Never invent account limits, billing state, credits, project counts, ticket status, or subscription status.",
    "- DeepMention is credit-first: Starter, Growth, and Pro are monthly credit bundles. Do not invent feature gates beyond the provided account context.",
    "- Never say jobs are stuck or failed because of a subscription tier. Credits control paid actions; queued jobs still need status-based troubleshooting.",
    "- Never say buying credits fixes existing failed jobs. Failed jobs need error inspection/retry.",
    "- Never invent causes like security review, brute force, API limit, or competitor saturation unless that exact cause is present in account context.",
    "- Never claim you changed billing, changed a subscription, refunded money, deleted data, restored credits, or fixed a backend issue.",
    "- If the request needs team investigation, billing review, security review, data correction, or the user asks for a human/manual review, set escalate=true.",
    "- Do not set escalate=true just because account context contains failed_jobs, queued_jobs, running_jobs, or low credits. Only escalate when the user's current request asks about a problem or asks for manual review.",
    "- For normal questions like 'Explain my wallet' or 'Why are my credits 0?', answer directly and set escalate=false.",
    "- For escalations, still give a short helpful explanation and ask whether the user wants a manual review ticket. Do not say a ticket was created unless the user has already confirmed.",
    "- If the user asks a how-to question, answer directly and give 2-4 concrete steps.",
    "- Keep answers concise, premium, and friendly. No robotic disclaimers.",
    "- Output strict JSON only. No markdown fence.",
    "",
    "JSON schema:",
    "{",
    '  "answer": "string",',
    '  "category": "subscription|billing|credits|scraping|reports|data_quality|account|product|bug|manual_review",',
    '  "confidence": "high|medium|low",',
    '  "escalate": boolean,',
    '  "escalation_reason": "string or empty",',
    '  "suggested_actions": ["short action chip", "..."],',
    '  "ticket_subject": "short support ticket subject or empty",',
    '  "ticket_summary": "manual review summary or empty"',
    "}"
  ].join("\n");
}
function buildCustomerSupportAgentUserPrompt(input) {
  const { context } = input;
  return [
    "=== CURRENT USER QUESTION ===",
    input.message,
    "",
    "=== RECENT CHAT HISTORY ===",
    JSON.stringify(input.history.slice(-8), null, 2),
    "",
    "=== ACCOUNT CONTEXT ===",
    JSON.stringify({
      user: {
        email: context.user.email,
        plan: context.user.plan,
        effective_plan: context.user.effective_plan,
        created_at: context.user.created_at
      },
      subscription: context.subscription,
      limits: context.limits,
      available_plans: context.available_plans,
      usage: context.usage,
      selected_project: context.selected_project,
      recent_tickets: context.recent_tickets
    }, null, 2),
    "",
    "=== PRODUCT FACTS ===",
    "- Exports and other premium actions consume credits according to the current credit-cost configuration.",
    "- AI visibility scraping/runs are processed through the backend queue and worker.",
    "- If jobs are queued/running/failed, explain only the visible status. Running means processing or waiting for async provider results. Failed means the error reason needs inspection.",
    "- Scheduled refresh availability depends on workspace settings and available credits. Manual queued runs are separate from scheduled auto-refresh.",
    "- The free trial lasts 7 days. Paid plans differ mainly by monthly credit capacity; all paid plans include the full DeepMention product.",
    "- Admin/manual review happens through Help Center tickets.",
    "",
    "=== DETERMINISTIC ESCALATION SIGNAL ===",
    input.deterministic_escalation_reason ?? "none",
    "",
    "Return strict JSON now."
  ].join("\n");
}

// src/features/customer_support_agent/customer_support_agent_service.ts
var DEFAULT_ACTIONS = [
  "Explain my wallet",
  "Why are my credits 0?",
  "Scraping/report failed",
  "Need manual review"
];
async function chatWithCustomerSupportAgent(user_id, input) {
  const cleanMessage = input.message.trim();
  if (!cleanMessage) {
    throw new Error("Message is required");
  }
  const history = normalizeHistory(input.history);
  const context = await buildCustomerSupportAgentContext(user_id, input.project_id);
  if (isAvailablePlansQuestion(cleanMessage)) {
    return {
      answer: buildAvailablePlansAnswer(context),
      escalated: false,
      needs_confirmation: false,
      ticket: null,
      category: "subscription",
      confidence: "high",
      suggested_actions: ["How do credits work?", "View my wallet balance", "What actions cost credits?", "Buy more credits"]
    };
  }
  if (isJobStatusQuestion(cleanMessage)) {
    return {
      answer: buildJobStatusAnswer(context),
      escalated: false,
      needs_confirmation: Boolean(context.selected_project && (context.selected_project.failed_jobs > 0 || context.selected_project.running_jobs > 0)),
      ticket: null,
      category: "scraping",
      confidence: "high",
      suggested_actions: ["Explain my wallet", "What actions cost credits?", "How do manual runs work?", "Create manual review ticket"]
    };
  }
  const escalationSignal = detectEscalationSignal(cleanMessage, history);
  const category = inferSupportCategory(cleanMessage);
  const decision = await generateSupportDecision({
    message: cleanMessage,
    history,
    deterministicEscalationReason: escalationSignal.reason,
    context,
    fallbackCategory: category
  });
  const selfServeCategory = category === "subscription" || category === "credits" || category === "product";
  const confirmedTicketCreation = isTicketCreationConfirmation(cleanMessage, history);
  const needsManualReview = escalationSignal.shouldEscalate || confirmedTicketCreation || decision.escalate && !selfServeCategory || decision.confidence === "low" && !selfServeCategory;
  const shouldCreateTicket = needsManualReview && confirmedTicketCreation;
  const finalCategory = needsManualReview && category === "product" ? decision.category : decision.category || category;
  const answer = needsManualReview ? shouldCreateTicket ? ensureTicketCreatedAnswer(decision.answer) : ensureConfirmationAnswer(decision.answer, escalationSignal.reason ?? decision.escalation_reason) : decision.answer;
  const ticket = shouldCreateTicket ? await createAgentTicket({
    user_id,
    email: context.user.email,
    message: cleanMessage,
    history,
    decision: {
      ...decision,
      category: finalCategory,
      escalation_reason: escalationSignal.reason ?? decision.escalation_reason
    },
    contextSummary: {
      plan: context.user.plan,
      effective_plan: context.user.effective_plan,
      subscription_status: context.subscription.status,
      credits_remaining: context.usage.credits_remaining,
      selected_project: context.selected_project?.brand_name ?? null
    }
  }) : null;
  return {
    answer,
    escalated: Boolean(ticket),
    needs_confirmation: needsManualReview && !ticket,
    ticket,
    category: finalCategory,
    confidence: decision.confidence,
    suggested_actions: normalizeActions(decision.suggested_actions)
  };
}
async function generateSupportDecision(input) {
  try {
    const raw = await generateText(
      buildCustomerSupportAgentSystemPrompt(),
      buildCustomerSupportAgentUserPrompt({
        message: input.message,
        history: input.history,
        context: input.context,
        deterministic_escalation_reason: input.deterministicEscalationReason
      })
    );
    return normalizeDecision(parseJson2(raw), input.fallbackCategory);
  } catch (error) {
    console.warn("[support-agent] generation failed; using deterministic fallback", error);
    return {
      answer: fallbackAnswer(input.message, input.fallbackCategory, input.deterministicEscalationReason),
      category: input.fallbackCategory,
      confidence: input.deterministicEscalationReason ? "medium" : "low",
      escalate: Boolean(input.deterministicEscalationReason),
      escalation_reason: input.deterministicEscalationReason ?? "The agent could not confidently answer this request.",
      suggested_actions: DEFAULT_ACTIONS,
      ticket_subject: supportSubject(input.message, input.fallbackCategory),
      ticket_summary: input.message
    };
  }
}
function normalizeDecision(value, fallbackCategory) {
  const answer = typeof value.answer === "string" && value.answer.trim() ? value.answer.trim() : fallbackAnswer("", fallbackCategory, null);
  const category = isCategory(value.category) ? value.category : fallbackCategory;
  const confidence = isConfidence(value.confidence) ? value.confidence : "medium";
  const suggested_actions = Array.isArray(value.suggested_actions) ? value.suggested_actions.filter((item) => typeof item === "string").slice(0, 4) : DEFAULT_ACTIONS;
  return {
    answer,
    category,
    confidence,
    escalate: Boolean(value.escalate),
    escalation_reason: typeof value.escalation_reason === "string" ? value.escalation_reason : "",
    suggested_actions,
    ticket_subject: typeof value.ticket_subject === "string" ? value.ticket_subject : "",
    ticket_summary: typeof value.ticket_summary === "string" ? value.ticket_summary : ""
  };
}
async function createAgentTicket(input) {
  const subject = truncate(
    input.decision.ticket_subject?.trim() || supportSubject(input.message, input.decision.category),
    150
  );
  const message = [
    "[Created by DeepMention Support Agent]",
    "",
    `Category: ${input.decision.category}`,
    `Confidence: ${input.decision.confidence}`,
    `Escalation reason: ${input.decision.escalation_reason || "Manual review requested by support agent."}`,
    "",
    "User message:",
    input.message,
    "",
    "Agent attempted answer:",
    input.decision.answer,
    "",
    "Agent summary:",
    input.decision.ticket_summary || input.message,
    "",
    "Account snapshot:",
    JSON.stringify(input.contextSummary, null, 2),
    "",
    "Recent conversation:",
    JSON.stringify(input.history.slice(-8), null, 2)
  ].join("\n");
  return prisma_default.helpCenter.create({
    data: {
      user_id: input.user_id,
      email: input.email,
      subject,
      message: truncate(message, 5e3)
    },
    select: {
      id: true,
      email: true,
      subject: true,
      message: true,
      is_resolved: true,
      created_at: true,
      updated_at: true
    }
  });
}
function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map((item) => ({ role: item.role, content: truncate(item.content.trim(), 1600) })).filter((item) => item.content).slice(-10);
}
function ensureConfirmationAnswer(answer, reason) {
  const clean2 = stripTicketCreatedClaims(answer);
  if (/do you want me to create|should i create|create a manual review ticket\?/i.test(clean2)) return clean2;
  const reasonLine = reason ? `

Why this may need review: ${reason}` : "";
  return `${clean2}${reasonLine}

Do you want me to create a manual review ticket for this? Reply "yes" and I will create it with your account context attached.`;
}
function ensureTicketCreatedAnswer(answer) {
  const clean2 = stripTicketCreatedClaims(answer);
  if (/created|ticket/i.test(clean2)) return clean2;
  return `${clean2}

I created a manual review ticket with your account context attached.`;
}
function stripTicketCreatedClaims(answer) {
  return answer.replace(/I also created a manual review ticket[^.]*\./gi, "").replace(/I created a manual review ticket[^.]*\./gi, "").replace(/A manual review ticket has been created[^.]*\./gi, "").trim();
}
function isTicketCreationConfirmation(message, history) {
  const clean2 = message.trim().toLowerCase();
  const confirms = /^(yes|yes please|yep|yeah|ok|okay|sure|create it|create ticket|raise ticket|raise it|do it|please create|go ahead)$/i.test(clean2) || /\b(create|raise|open)\b.*\b(ticket|manual review)\b/i.test(message);
  if (!confirms) return false;
  const recentAssistant = history.slice(-4).reverse().find((item) => item.role === "assistant");
  if (!recentAssistant) return /\b(ticket|manual review)\b/i.test(message);
  return /manual review ticket|create.*ticket|reply "yes"|reply 'yes'/i.test(recentAssistant.content);
}
function normalizeActions(actions) {
  const clean2 = actions.map((item) => item.trim()).filter(Boolean);
  return (clean2.length ? clean2 : DEFAULT_ACTIONS).slice(0, 4);
}
function isAvailablePlansQuestion(message) {
  return /\b(plans?|pricing|price|tiers?|available plans?|upgrade options?|starter|growth|pro)\b/i.test(message) && /\b(available|what|which|tell|list|show|cost|price|pricing|upgrade|compare)\b/i.test(message);
}
function isJobStatusQuestion(message) {
  return /\b(today'?s?|runs?|jobs?|scrap(?:e|ing)|queue|queued|running|failed|stuck|worker|refresh)\b/i.test(message) && /\b(why|what|status|happened|run|didn'?t|not|failed|stuck|running|today|refresh)\b/i.test(message);
}
function buildAvailablePlansAnswer(context) {
  return [
    "DeepMention uses one credit wallet for every account. Starter, Growth, and Pro are monthly credit bundles; all paid plans include the full product, and the main difference is capacity.",
    "",
    `You currently have **${context.usage.credits_remaining} credits remaining**. Starter includes 2,250 credits, Growth includes 5,000 credits with +500 bonus credits, and Pro includes 13,000 credits with +1,750 bonus credits.`,
    "",
    "AI SEO quick scans use 3 credits, full AI SEO audits use 15 credits, AI visibility reports use 25 credits, content briefs use 15 credits, and Reddit intelligence starts at 25 credits.",
    "You can buy a monthly credit bundle or add PAYG top-ups anytime from Billing & Credits. Your trial credits are added after email verification."
  ].join("\n");
}
function buildJobStatusAnswer(context) {
  const project = context.selected_project;
  const refresh2 = context.limits.refreshes_per_week === "daily" ? "daily auto-refresh" : context.limits.refreshes_per_week === 0 ? "no scheduled auto-refresh" : `${context.limits.refreshes_per_week} scheduled refreshes per week`;
  if (!project) {
    return [
      "I do not see a selected project in your account context yet.",
      "",
      `Your PAYG workspace has **${refresh2}**. Manual runs can be triggered when the project has prompts configured and the wallet has enough credits.`,
      "",
      "If you expected a run for an existing project, open that project first and ask me again, or reply **yes** and I can create a manual review ticket."
    ].join("\n");
  }
  const statusRows = [
    `| Running | ${project.running_jobs} |`,
    `| Queued | ${project.queued_jobs} |`,
    `| Failed | ${project.failed_jobs} |`,
    `| Total runs recorded | ${project.runs} |`
  ];
  const lines = [
    `For **${project.brand_name}**, here is the job status I can see right now:`,
    "",
    "| Status | Count |",
    "| --- | ---: |",
    ...statusRows,
    "",
    `Your PAYG workspace has **${refresh2}**.`,
    "",
    "Scheduled refresh behavior depends on workspace settings and available credits, not a subscription tier.",
    ""
  ];
  if (project.failed_jobs > 0 || project.running_jobs > 0) {
    lines.push(
      "What this usually means:",
      "",
      "- **Running** jobs are currently with the worker/provider or waiting for the async result to complete.",
      "- **Failed** jobs need their error reason checked before retrying.",
      "- If this is local testing, make sure the API, worker, Redis, and Bright Data polling process are running.",
      "",
      "If you want the team to inspect these jobs, reply **yes** and I will create a manual review ticket with this job context attached."
    );
  } else if (context.limits.refreshes_per_week === 0) {
    lines.push("Scheduled refresh behavior depends on workspace settings and available credits, not a subscription tier.");
  } else {
    lines.push("I do not see stuck or failed jobs in this project context right now.");
  }
  return lines.join("\n");
}
function fallbackAnswer(message, category, reason) {
  if (reason) {
    return "This looks like something our team should review directly. I can create a manual review ticket with your account context and the details from this chat.";
  }
  if (category === "subscription" || category === "credits") {
    return "I can help explain your PAYG wallet, credit usage, and account activity. If something looks incorrect, I can create a manual review ticket for the team.";
  }
  return message ? "I can help with that. If this needs account investigation, I will create a manual review ticket with the relevant context." : "How can I help with your DeepMention account?";
}
function supportSubject(message, category) {
  const prefix = category.replace(/_/g, " ");
  return truncate(`${titleCase2(prefix)} support request: ${message}`, 150);
}
function parseJson2(raw) {
  let cleaned = raw.trim().replace(/^```json\n?/i, "").replace(/^```\n?/i, "").replace(/\n?```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}
function isCategory(value) {
  return typeof value === "string" && [
    "subscription",
    "billing",
    "credits",
    "scraping",
    "reports",
    "data_quality",
    "account",
    "product",
    "bug",
    "manual_review"
  ].includes(value);
}
function isConfidence(value) {
  return value === "high" || value === "medium" || value === "low";
}
function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}\u2026` : value;
}
function titleCase2(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// src/features/customer_support_agent/customer_support_agent_controller.ts
var messageSchema = import_zod10.z.object({
  role: import_zod10.z.enum(["user", "assistant"]),
  content: import_zod10.z.string().trim().min(1).max(3e3)
});
var chatSchema = import_zod10.z.object({
  message: import_zod10.z.string().trim().min(1, "Message is required").max(3e3, "Message is too long"),
  history: import_zod10.z.array(messageSchema).max(12).optional(),
  project_id: import_zod10.z.string().uuid().nullable().optional()
});
async function chatCustomerSupportAgentController(req, res) {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError3 = Object.values(fieldErrors).flat().find(Boolean);
    res.status(400).json({
      success: false,
      error: firstError3 ?? "Invalid support agent payload",
      errors: fieldErrors
    });
    return;
  }
  try {
    const user_id = req.user.id;
    const response = await chatWithCustomerSupportAgent(user_id, parsed.data);
    res.status(200).json({
      success: true,
      ...response
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run support agent";
    const status = message === "PROJECT_NOT_FOUND" ? 404 : 500;
    res.status(status).json({
      success: false,
      error: status === 404 ? "Project not found" : "Failed to run support agent"
    });
  }
}

// src/features/customer_support_agent/customer_support_agent_routes.ts
var router23 = (0, import_express23.Router)();
router23.post("/chat", chatCustomerSupportAgentController);
var customer_support_agent_routes_default = router23;

// src/features/reddit_intelligence/reddit_intelligence_routes.ts
var import_express24 = require("express");

// src/features/reddit_intelligence/reddit_intelligence_controller.ts
var import_axios10 = __toESM(require("axios"), 1);

// src/features/brand_preferences/brand_preferences_service.ts
init_prisma();
init_project_access();
async function getBrandPreference(projectId, userId) {
  await assertProjectAccess(projectId, userId);
  return prisma_default.brandPreference.findFirst({
    where: {
      project_id: projectId,
      user_id: userId
    }
  });
}
async function upsertBrandPreference(projectId, userId, payload) {
  await assertProjectAccess(projectId, userId);
  return prisma_default.brandPreference.upsert({
    where: { project_id: projectId },
    create: {
      project_id: projectId,
      user_id: userId,
      industry_category: payload.industry_category,
      buyer_persona: payload.buyer_persona ?? null,
      keywords: payload.keywords,
      avoid_keywords: payload.avoid_keywords,
      competitor_context: payload.competitor_context ?? null,
      reddit_focus: payload.reddit_focus
    },
    update: {
      industry_category: payload.industry_category,
      buyer_persona: payload.buyer_persona ?? null,
      keywords: payload.keywords,
      avoid_keywords: payload.avoid_keywords,
      competitor_context: payload.competitor_context ?? null,
      reddit_focus: payload.reddit_focus
    }
  });
}
async function hasRunnableBrandPreference(projectId, userId) {
  const preference = await getBrandPreference(projectId, userId);
  const keywords = Array.isArray(preference?.keywords) ? preference.keywords : [];
  return Boolean(preference?.industry_category?.trim() && keywords.length > 0);
}

// src/features/reddit_intelligence/reddit_intelligence_controller.ts
init_credits_service2();
init_project_access();
init_plan_config();

// src/features/reddit_intelligence/reddit_intelligence_service.ts
init_prisma();
async function listRedditIntelligence(projectId, userId) {
  const [latestRun, runs, posts, citedThreads, brandPreference] = await Promise.all([
    prisma_default.redditIntelligenceRun.findFirst({
      where: { project_id: projectId, user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        posts: {
          orderBy: [{ importance_score: "desc" }, { num_comments: "desc" }],
          take: 20
        }
      }
    }),
    prisma_default.redditIntelligenceRun.findMany({
      where: { project_id: projectId, user_id: userId },
      orderBy: { created_at: "desc" },
      take: 8,
      include: {
        posts: {
          orderBy: [{ importance_score: "desc" }, { num_comments: "desc" }],
          take: 30
        }
      }
    }),
    prisma_default.redditPost.findMany({
      where: { project_id: projectId, user_id: userId },
      orderBy: [{ importance_score: "desc" }, { num_comments: "desc" }],
      take: 50
    }),
    loadAiCitedRedditThreads(projectId),
    getBrandPreference(projectId, userId)
  ]);
  return {
    latest_run: latestRun,
    runs,
    posts,
    cited_threads: citedThreads,
    brand_preference: brandPreference,
    summary: buildStoredSummary(latestRun, posts, citedThreads)
  };
}
async function createPendingRun(input) {
  return prisma_default.redditIntelligenceRun.create({
    data: {
      project_id: input.projectId,
      user_id: input.userId,
      mode: input.mode,
      status: "RUNNING",
      credits_spent: input.credits,
      post_limit: input.postLimit
    }
  });
}
async function persistRedditScanResult(input) {
  const result = input.result;
  return prisma_default.$transaction(async (tx) => {
    const run = await tx.redditIntelligenceRun.update({
      where: { id: input.runId },
      data: {
        status: result.status,
        keyword_count: result.keywords.length,
        keywords: result.keywords,
        summary: result.summary,
        themes: result.themes,
        actions: result.actions,
        raw_result: {
          raw_post_count: result.raw_post_count,
          unique_post_count: result.unique_post_count,
          maybe_post_count: result.maybe_post_count ?? 0,
          rejected_post_count: result.rejected_post_count ?? 0,
          errors: result.errors
        },
        error_reason: result.errors?.join("; ") || null,
        completed_at: /* @__PURE__ */ new Date()
      }
    });
    for (const post of result.posts) {
      await tx.redditPost.upsert({
        where: {
          project_id_url: {
            project_id: input.projectId,
            url: post.url
          }
        },
        create: {
          run_id: input.runId,
          project_id: input.projectId,
          user_id: input.userId,
          post_id: post.post_id ?? null,
          url: post.url,
          subreddit: post.subreddit ?? null,
          title: post.title,
          description: post.description ?? null,
          author: post.author ?? null,
          keyword: post.keyword ?? null,
          num_comments: post.num_comments ?? 0,
          num_upvotes: post.num_upvotes ?? 0,
          date_posted: post.date_posted ? new Date(post.date_posted) : null,
          sentiment: post.sentiment ?? null,
          intent: post.intent ?? null,
          importance_score: post.importance_score ?? 0,
          mentioned_brands: post.mentioned_brands ?? [],
          mentioned_competitors: post.mentioned_competitors ?? [],
          raw_json: buildPostRawJson(post)
        },
        update: {
          run_id: input.runId,
          post_id: post.post_id ?? null,
          subreddit: post.subreddit ?? null,
          title: post.title,
          description: post.description ?? null,
          author: post.author ?? null,
          keyword: post.keyword ?? null,
          num_comments: post.num_comments ?? 0,
          num_upvotes: post.num_upvotes ?? 0,
          date_posted: post.date_posted ? new Date(post.date_posted) : null,
          sentiment: post.sentiment ?? null,
          intent: post.intent ?? null,
          importance_score: post.importance_score ?? 0,
          mentioned_brands: post.mentioned_brands ?? [],
          mentioned_competitors: post.mentioned_competitors ?? [],
          raw_json: buildPostRawJson(post)
        }
      });
    }
    return run;
  });
}
async function markRedditRunRefunded(runId, errorReason) {
  return prisma_default.redditIntelligenceRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      credits_spent: 0,
      error_reason: errorReason.slice(0, 1e3),
      completed_at: /* @__PURE__ */ new Date()
    }
  });
}
async function markRedditRunFailed(runId, errorReason) {
  return prisma_default.redditIntelligenceRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      error_reason: errorReason.slice(0, 1e3),
      completed_at: /* @__PURE__ */ new Date()
    }
  });
}
async function loadAiCitedRedditThreads(projectId) {
  const sources = await prisma_default.source.findMany({
    where: {
      domain: { contains: "reddit", mode: "insensitive" },
      chat: {
        prompt: { project_id: projectId }
      }
    },
    orderBy: { created_at: "desc" },
    take: 40,
    select: {
      id: true,
      url: true,
      domain: true,
      title: true,
      snippet: true,
      subreddit: true,
      chat: {
        select: {
          id: true,
          ai_model: true,
          brand_mentioned: true,
          sentiment_score: true,
          created_at: true,
          prompt: {
            select: {
              id: true,
              text: true,
              topic: true
            }
          }
        }
      }
    }
  });
  return sources;
}
function buildStoredSummary(latestRun, posts, citedThreads) {
  const subreddits = Array.from(new Set(posts.map((post) => post.subreddit).filter(Boolean))).slice(0, 5);
  return {
    latest_run: latestRun,
    stored_posts: posts.length,
    ai_cited_reddit_threads: citedThreads.length,
    negative_or_skeptical_posts: posts.filter((post) => post.sentiment === "negative" || post.sentiment === "skeptical").length,
    top_subreddits: subreddits
  };
}
function buildPostRawJson(post) {
  return {
    ...post.raw_json ?? {},
    relevance_score: post.relevance_score ?? post.raw_json?.relevance_score ?? 0,
    relevance_bucket: post.relevance_bucket ?? post.raw_json?.relevance_bucket ?? "maybe",
    relevance_reasons: post.relevance_reasons ?? post.raw_json?.relevance_reasons ?? []
  };
}

// src/features/reddit_intelligence/reddit_intelligence_controller.ts
var AGENTS_API_BASE_URL2 = (process.env.AI_REPORTS_API_BASE_URL ?? process.env.AGENTS_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
var agentsApi2 = import_axios10.default.create({
  baseURL: AGENTS_API_BASE_URL2,
  timeout: Number(process.env.REDDIT_INTELLIGENCE_TIMEOUT_MS ?? 36e4)
});
var MODE_CONFIG = {
  standard: { credits: CREDIT_COSTS.reddit_intelligence_standard, postLimit: 25 },
  deep: { credits: CREDIT_COSTS.reddit_intelligence_deep, postLimit: 100 }
};
async function listRedditIntelligenceController(req, res) {
  try {
    const projectId = readString4(req.query.project_id);
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const userId = req.user.id;
    await assertProjectAccess(projectId, userId);
    res.json(await listRedditIntelligence(projectId, userId));
  } catch (error) {
    handleRedditError(error, res, "Failed to load Reddit Intelligence");
  }
}
async function runRedditIntelligenceController(req, res) {
  const userId = req.user.id;
  let runId = null;
  let idempotencyKey = null;
  try {
    const projectId = readString4(req.body?.project_id);
    const mode = normalizeMode(req.body?.mode);
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    await assertProjectAccess(projectId, userId);
    const hasPreferences = await hasRunnableBrandPreference(projectId, userId);
    if (!hasPreferences) {
      res.status(428).json({
        error: "Brand preferences are required before running Reddit Intelligence.",
        code: "BRAND_PREFERENCES_REQUIRED"
      });
      return;
    }
    const config = MODE_CONFIG[mode];
    idempotencyKey = readIdempotencyKey2(req) ?? `reddit-intelligence:${userId}:${projectId}:${mode}:${Date.now()}`;
    await spendCredits({
      userId,
      amount: config.credits,
      action: mode === "deep" ? "reddit_intelligence_deep" : "reddit_intelligence_standard",
      description: mode === "deep" ? "Reddit Intelligence deep scan" : "Reddit Intelligence standard scan",
      idempotencyKey,
      metadata: { project_id: projectId, mode }
    });
    const run = await createPendingRun({
      projectId,
      userId,
      mode,
      credits: config.credits,
      postLimit: config.postLimit
    });
    runId = run.id;
    try {
      const response = await agentsApi2.post("/reddit-intelligence/run", {
        project_id: projectId,
        mode,
        run_id: run.id
      }, {
        headers: forwardAuth3(req)
      });
      let persistedRun = await persistRedditScanResult({
        runId: run.id,
        projectId,
        userId,
        result: response.data
      });
      if (response.data.status === "FAILED") {
        const reason = response.data.errors[0] ?? "No relevant Reddit discussions found";
        await refundCredits({
          userId,
          amount: config.credits,
          action: "credit_refund",
          description: "Refund for Reddit Intelligence scan with no relevant posts",
          idempotencyKey: `refund:${idempotencyKey}`,
          metadata: { project_id: projectId, mode, reason }
        });
        persistedRun = await markRedditRunRefunded(run.id, reason);
      }
      res.status(200).json({
        run: persistedRun,
        result: response.data,
        intelligence: await listRedditIntelligence(projectId, userId)
      });
    } catch (error) {
      const reason = describeAgentsError(error);
      await refundCredits({
        userId,
        amount: config.credits,
        action: "credit_refund",
        description: "Refund for failed Reddit Intelligence scan",
        idempotencyKey: `refund:${idempotencyKey}`,
        metadata: { project_id: projectId, mode }
      });
      if (runId) {
        await markRedditRunFailed(runId, reason);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not enough credits")) {
      res.status(402).json({ error: error.message });
      return;
    }
    handleRedditError(error, res, "Failed to run Reddit Intelligence");
  }
}
function normalizeMode(value) {
  return value === "deep" ? "deep" : "standard";
}
function forwardAuth3(req) {
  const authorization = req.header("authorization");
  return authorization ? { Authorization: authorization } : void 0;
}
function readString4(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function readIdempotencyKey2(req) {
  const header2 = req.header("Idempotency-Key");
  if (header2?.trim()) return header2.trim().slice(0, 180);
  return void 0;
}
function handleRedditError(error, res, fallback) {
  if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (import_axios10.default.isAxiosError(error)) {
    const status = error.response?.status ?? 502;
    const data = error.response?.data;
    res.status(status).json(typeof data === "object" && data !== null ? data : { error: fallback });
    return;
  }
  console.error("[reddit-intelligence] Error:", error);
  res.status(500).json({ error: fallback });
}
function describeAgentsError(error) {
  if (import_axios10.default.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "object" && data !== null) {
      const errorMessage = "error" in data && typeof data.error === "string" ? data.error : null;
      const detail = "detail" in data && typeof data.detail === "string" ? data.detail : null;
      const errors = "errors" in data && Array.isArray(data.errors) ? data.errors.filter((item) => typeof item === "string") : [];
      return (errorMessage ?? detail ?? errors[0] ?? error.message).slice(0, 1e3);
    }
    return error.message.slice(0, 1e3);
  }
  return error instanceof Error ? error.message.slice(0, 1e3) : "Reddit Intelligence failed";
}

// src/features/reddit_intelligence/reddit_intelligence_routes.ts
var router24 = (0, import_express24.Router)();
router24.get("/", listRedditIntelligenceController);
router24.post("/run", runRedditIntelligenceController);
var reddit_intelligence_routes_default = router24;

// src/features/brand_preferences/brand_preferences_routes.ts
var import_express25 = require("express");

// src/features/brand_preferences/brand_preferences_controller.ts
var import_zod11 = require("zod");
var preferenceSchema = import_zod11.z.object({
  industry_category: import_zod11.z.string().trim().min(2, "Industry/category is required").max(120),
  buyer_persona: import_zod11.z.string().trim().max(200).optional().nullable(),
  keywords: import_zod11.z.array(import_zod11.z.string().trim().min(2).max(80)).min(1, "Add at least one keyword").max(20),
  avoid_keywords: import_zod11.z.array(import_zod11.z.string().trim().min(2).max(80)).max(30).default([]),
  competitor_context: import_zod11.z.string().trim().max(600).optional().nullable(),
  reddit_focus: import_zod11.z.array(import_zod11.z.string().trim().min(2).max(80)).max(12).default([])
});
async function getBrandPreferenceController(req, res) {
  try {
    const projectId = readProjectId(req);
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const userId = req.user.id;
    const preference = await getBrandPreference(projectId, userId);
    res.status(200).json({ preference });
  } catch (error) {
    handleBrandPreferenceError(error, res, "Failed to load brand preferences");
  }
}
async function upsertBrandPreferenceController(req, res) {
  const parsed = preferenceSchema.safeParse({
    ...req.body,
    keywords: normalizeList(req.body?.keywords),
    avoid_keywords: normalizeList(req.body?.avoid_keywords),
    reddit_focus: normalizeList(req.body?.reddit_focus)
  });
  if (!parsed.success) {
    res.status(400).json({
      error: "Please complete the required brand preferences.",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }
  try {
    const projectId = readProjectId(req);
    if (!projectId) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }
    const userId = req.user.id;
    const preference = await upsertBrandPreference(projectId, userId, parsed.data);
    res.status(200).json({ preference });
  } catch (error) {
    handleBrandPreferenceError(error, res, "Failed to save brand preferences");
  }
}
function readProjectId(req) {
  const value = req.params.projectId ?? req.query.project_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function normalizeList(value) {
  if (Array.isArray(value)) {
    return cleanList(value);
  }
  if (typeof value === "string") {
    return cleanList(value.split(/[\n,]/g));
  }
  return [];
}
function cleanList(values) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const value of values) {
    const item = String(value ?? "").trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
function handleBrandPreferenceError(error, res, fallback) {
  if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  console.error("[brand-preferences] Error:", error);
  res.status(500).json({ error: fallback });
}

// src/features/brand_preferences/brand_preferences_routes.ts
var router25 = (0, import_express25.Router)();
router25.get("/:projectId", getBrandPreferenceController);
router25.put("/:projectId", upsertBrandPreferenceController);
var brand_preferences_routes_default = router25;

// src/features/agency/agency_routes.ts
var import_express26 = require("express");

// src/features/agency/agency_controller.ts
var import_client17 = require("@prisma/client");
init_agency_service();

// src/features/agency/agency_branding_service.ts
init_prisma();
init_agency_service();
async function getAgencyBranding(userId) {
  const context = await getAgencyContext(userId);
  if (!context) throw Object.assign(new Error("Agency account or access required"), { status: 403 });
  const branding = await prisma_default.agencyBranding.findUnique({
    where: { agency_user_id: context.agency_user_id }
  });
  if (!branding) {
    return {
      id: "",
      agency_user_id: context.agency_user_id,
      brand_name: "Agency Portal",
      logo_url: null,
      favicon_url: null,
      primary_color: "#2563eb",
      accent_color: "#0f172a",
      portal_title: "Client Intelligence Portal",
      support_email: null,
      custom_cname: null,
      footer_text: "Powered by Agency Intelligence Suite",
      enable_white_label: false,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    };
  }
  return branding;
}
async function upsertAgencyBranding(actorUserId, input) {
  const context = await assertAgencyManager(actorUserId);
  return prisma_default.agencyBranding.upsert({
    where: { agency_user_id: context.agency_user_id },
    create: {
      agency_user_id: context.agency_user_id,
      brand_name: input.brand_name?.trim() || "Agency Portal",
      logo_url: input.logo_url?.trim() || null,
      favicon_url: input.favicon_url?.trim() || null,
      primary_color: input.primary_color?.trim() || "#2563eb",
      accent_color: input.accent_color?.trim() || "#0f172a",
      portal_title: input.portal_title?.trim() || "Client Intelligence Portal",
      support_email: input.support_email?.trim() || null,
      custom_cname: input.custom_cname?.trim() || null,
      footer_text: input.footer_text?.trim() || "Powered by Agency Intelligence Suite",
      enable_white_label: input.enable_white_label ?? true
    },
    update: {
      brand_name: input.brand_name !== void 0 ? input.brand_name?.trim() || null : void 0,
      logo_url: input.logo_url !== void 0 ? input.logo_url?.trim() || null : void 0,
      favicon_url: input.favicon_url !== void 0 ? input.favicon_url?.trim() || null : void 0,
      primary_color: input.primary_color !== void 0 ? input.primary_color?.trim() || "#2563eb" : void 0,
      accent_color: input.accent_color !== void 0 ? input.accent_color?.trim() || "#0f172a" : void 0,
      portal_title: input.portal_title !== void 0 ? input.portal_title?.trim() || null : void 0,
      support_email: input.support_email !== void 0 ? input.support_email?.trim() || null : void 0,
      custom_cname: input.custom_cname !== void 0 ? input.custom_cname?.trim() || null : void 0,
      footer_text: input.footer_text !== void 0 ? input.footer_text?.trim() || null : void 0,
      enable_white_label: input.enable_white_label !== void 0 ? input.enable_white_label : void 0
    }
  });
}

// src/features/agency/agency_portal_service.ts
var import_crypto7 = __toESM(require("crypto"), 1);
var import_bcryptjs4 = __toESM(require("bcryptjs"), 1);
init_prisma();
init_agency_service();
async function createPortalShare(input) {
  const context = await assertAgencyManager(input.actorUserId);
  const project = await prisma_default.project.findFirst({
    where: {
      id: input.projectId,
      OR: [
        { user_id: context.agency_user_id },
        { user: { client_agency_links: { some: { agency_user_id: context.agency_user_id, status: "ACTIVE" } } } }
      ]
    },
    select: { id: true, brand_name: true }
  });
  if (!project) {
    throw Object.assign(new Error("Project not found in your agency workspace"), { status: 404 });
  }
  const token = import_crypto7.default.randomBytes(24).toString("hex");
  const passcode_hash = input.passcode?.trim() ? await import_bcryptjs4.default.hash(input.passcode.trim(), 10) : null;
  const expires_at = input.expiresDays && input.expiresDays > 0 ? new Date(Date.now() + input.expiresDays * 24 * 60 * 60 * 1e3) : null;
  const share = await prisma_default.agencyPortalShare.create({
    data: {
      token,
      agency_user_id: context.agency_user_id,
      project_id: project.id,
      title: input.title?.trim() || `${project.brand_name} Client Portal`,
      passcode_hash,
      expires_at,
      is_active: true,
      allowed_tabs: input.allowedTabs && input.allowedTabs.length > 0 ? input.allowedTabs : ["OVERVIEW", "AI_VISIBILITY", "SEO_KEYWORDS", "DELIVERABLES"]
    },
    include: {
      project: { select: { id: true, brand_name: true, brand_url: true } }
    }
  });
  const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return {
    id: share.id,
    token: share.token,
    title: share.title,
    project_id: share.project_id,
    brand_name: share.project.brand_name,
    has_passcode: !!share.passcode_hash,
    expires_at: share.expires_at,
    is_active: share.is_active,
    share_url: `${appUrl}/portal/${share.token}`,
    created_at: share.created_at
  };
}
async function listProjectPortalShares(actorUserId, projectId) {
  const context = await assertAgencyManager(actorUserId);
  const shares = await prisma_default.agencyPortalShare.findMany({
    where: {
      agency_user_id: context.agency_user_id,
      ...projectId ? { project_id: projectId } : {}
    },
    orderBy: { created_at: "desc" },
    include: {
      project: { select: { id: true, brand_name: true, brand_url: true } }
    }
  });
  const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return shares.map((s) => ({
    id: s.id,
    token: s.token,
    title: s.title,
    project_id: s.project_id,
    brand_name: s.project.brand_name,
    has_passcode: !!s.passcode_hash,
    expires_at: s.expires_at,
    is_active: s.is_active,
    view_count: s.view_count,
    last_viewed_at: s.last_viewed_at,
    allowed_tabs: s.allowed_tabs,
    share_url: `${appUrl}/portal/${s.token}`,
    created_at: s.created_at
  }));
}
async function revokePortalShare(actorUserId, token) {
  const context = await assertAgencyManager(actorUserId);
  const updated = await prisma_default.agencyPortalShare.updateMany({
    where: {
      agency_user_id: context.agency_user_id,
      token
    },
    data: {
      is_active: false
    }
  });
  if (!updated.count) {
    throw Object.assign(new Error("Share link not found"), { status: 404 });
  }
  return { revoked: true, token };
}
async function getPublicPortalData(token, passcode) {
  const share = await prisma_default.agencyPortalShare.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          id: true,
          brand_name: true,
          brand_url: true,
          brand_location: true,
          created_at: true
        }
      },
      agency: {
        select: {
          id: true,
          email: true,
          agency_branding: true
        }
      }
    }
  });
  if (!share || !share.is_active) {
    throw Object.assign(new Error("This client portal link is inactive or does not exist"), { status: 404 });
  }
  if (share.expires_at && share.expires_at < /* @__PURE__ */ new Date()) {
    throw Object.assign(new Error("This client portal link has expired"), { status: 410 });
  }
  if (share.passcode_hash) {
    if (!passcode) {
      return {
        requires_passcode: true,
        title: share.title,
        brand_name: share.project.brand_name,
        agency_branding: share.agency.agency_branding ?? {
          brand_name: "Agency Portal",
          logo_url: null,
          primary_color: "#2563eb",
          enable_white_label: false
        }
      };
    }
    const valid = await import_bcryptjs4.default.compare(passcode.trim(), share.passcode_hash);
    if (!valid) {
      throw Object.assign(new Error("Invalid passcode entered"), { status: 401 });
    }
  }
  void prisma_default.agencyPortalShare.update({
    where: { id: share.id },
    data: {
      view_count: { increment: 1 },
      last_viewed_at: /* @__PURE__ */ new Date()
    }
  }).catch(() => null);
  const [latestRuns, latestOverviewSnapshot, topKeywordsSnapshot, recentBriefs] = await Promise.all([
    prisma_default.run.findMany({
      where: { project_id: share.project_id },
      orderBy: { created_at: "desc" },
      take: 10,
      select: {
        id: true,
        score: true,
        sentiment_score: true,
        created_at: true,
        prompt: { select: { text: true } },
        responses: {
          select: {
            engine: true,
            brand_mentioned: true,
            rank: true
          }
        }
      }
    }),
    prisma_default.seoDomaEUResearchOverviewSnapshot.findFirst({
      where: { domain: share.project.brand_url },
      orderBy: { created_at: "desc" }
    }),
    prisma_default.seoDomaEUResearchKeywordSnapshot.findFirst({
      where: { domain: share.project.brand_url },
      orderBy: { created_at: "desc" }
    }),
    prisma_default.contentBrief.findMany({
      where: { project_id: share.project_id },
      orderBy: { created_at: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        primary_keyword: true,
        target_word_count: true,
        status: true,
        created_at: true
      }
    })
  ]);
  const avgScore = latestRuns.length > 0 ? Math.round(latestRuns.reduce((acc, r) => acc + (r.score ?? 0), 0) / latestRuns.length) : 68;
  const engineMentions = {
    CHATGPT: { total: 0, mentioned: 0 },
    GEMINI: { total: 0, mentioned: 0 },
    PERPLEXITY: { total: 0, mentioned: 0 },
    GOOGLE_AI_OVERVIEW: { total: 0, mentioned: 0 }
  };
  for (const run of latestRuns) {
    for (const resp of run.responses) {
      const eng = resp.engine ?? "CHATGPT";
      if (!engineMentions[eng]) engineMentions[eng] = { total: 0, mentioned: 0 };
      engineMentions[eng].total += 1;
      if (resp.brand_mentioned) engineMentions[eng].mentioned += 1;
    }
  }
  const branding = share.agency.agency_branding ?? {
    brand_name: "Agency Portal",
    logo_url: null,
    favicon_url: null,
    primary_color: "#2563eb",
    accent_color: "#0f172a",
    portal_title: "Client Intelligence Portal",
    support_email: share.agency.email,
    footer_text: "Powered by Agency Intelligence Suite",
    enable_white_label: false
  };
  return {
    requires_passcode: false,
    title: share.title,
    allowed_tabs: share.allowed_tabs,
    agency_branding: branding,
    project: {
      id: share.project.id,
      brand_name: share.project.brand_name,
      brand_url: share.project.brand_url,
      brand_location: share.project.brand_location
    },
    metrics: {
      ai_visibility_score: avgScore,
      total_runs_analyzed: latestRuns.length,
      engine_breakdown: Object.entries(engineMentions).map(([engine, data]) => ({
        engine,
        share: data.total > 0 ? Math.round(data.mentioned / data.total * 100) : 0,
        total_queries: data.total
      })),
      seo_domain_overview: latestOverviewSnapshot?.metrics_json ?? {
        organic_traffic: 14200,
        organic_keywords: 890,
        domain_rating: 44,
        ranking_distribution: { top3: 32, top10: 118, top50: 420 }
      },
      top_keywords: topKeywordsSnapshot?.keywords_json ?? []
    },
    deliverables: {
      content_briefs: recentBriefs,
      available_exports: [
        { type: "PPTX", name: "Monthly AI & SEO Executive Presentation", available: true },
        { type: "PDF", name: "Executive Performance Audit Report", available: true }
      ]
    }
  };
}

// src/features/agency/agency_controller.ts
function requireAgencyUser(req, res) {
  const user = req.user;
  if (!user || user.account_type !== "AGENCY") {
    res.status(403).json({ error: "Agency account required" });
    return null;
  }
  return user.id;
}
function handleError(error, res, fallback) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  if (Number.isFinite(status) && status >= 400 && status < 500) {
    res.status(status).json({ error: error instanceof Error ? error.message : fallback });
    return;
  }
  console.error("[agency_controller]", fallback, error);
  res.status(500).json({ error: fallback });
}
async function getPortfolioController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  try {
    const portfolio = await getAgencyPortfolio(agency_user_id);
    res.json(portfolio);
  } catch (error) {
    handleError(error, res, "Failed to load agency portfolio");
  }
}
async function listClientsController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  try {
    const clients = await listAgencyClients(agency_user_id);
    res.json({ clients });
  } catch (error) {
    handleError(error, res, "Failed to list agency clients");
  }
}
async function listMembersController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  try {
    res.json({ members: await listAgencyMembers(agency_user_id) });
  } catch (error) {
    handleError(error, res, "Failed to list agency members");
  }
}
async function createInvitationController(req, res) {
  const actorUserId = req.user?.id;
  const email = typeof req.body.email === "string" ? req.body.email : "";
  const type = req.body.type === "CLIENT_USER" ? import_client17.AgencyInvitationType.CLIENT_USER : import_client17.AgencyInvitationType.TEAM_MEMBER;
  const role = typeof req.body.role === "string" && Object.values(import_client17.AgencyMembershipRole).includes(req.body.role) ? req.body.role : import_client17.AgencyMembershipRole.ANALYST;
  const assignedProjectIds = Array.isArray(req.body.assigned_project_ids) ? req.body.assigned_project_ids.map(String) : [];
  if (!actorUserId || !email.trim()) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  try {
    res.status(201).json({
      success: true,
      invitation: await createAgencyInvitation({ actorUserId, email, type, role, assignedProjectIds })
    });
  } catch (error) {
    handleError(error, res, "Failed to create invitation");
  }
}
async function acceptInvitationController(req, res) {
  const token = typeof req.body.token === "string" ? req.body.token : "";
  const password = typeof req.body.password === "string" ? req.body.password : void 0;
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  try {
    const invitation = await acceptAgencyInvitation(token, password);
    setAuthCookies(res, invitation);
    res.json({ success: true, invitation });
  } catch (error) {
    handleError(error, res, "Failed to accept invitation");
  }
}
async function addClientController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  try {
    const result = await addAgencyClient(agency_user_id, email);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    handleError(error, res, "Failed to add client");
  }
}
async function updateClientStatusController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  const client_user_id = String(req.params.client_user_id);
  const status = req.body.status;
  if (status !== "ACTIVE" && status !== "SUSPENDED") {
    res.status(400).json({ error: "status must be ACTIVE or SUSPENDED" });
    return;
  }
  try {
    const result = await updateClientLinkStatus(agency_user_id, client_user_id, status);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res, "Failed to update client status");
  }
}
async function updateClientSettingsController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  const client_user_id = String(req.params.client_user_id);
  const { category, monthly_credit_cap, assigned_manager_id, role } = req.body;
  try {
    const result = await updateClientSettings(agency_user_id, client_user_id, {
      category,
      monthly_credit_cap: typeof monthly_credit_cap === "number" ? monthly_credit_cap : void 0,
      assigned_manager_id,
      role
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res, "Failed to update client settings");
  }
}
async function removeClientController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  const client_user_id = String(req.params.client_user_id);
  try {
    await removeAgencyClient(agency_user_id, client_user_id);
    res.json({ success: true });
  } catch (error) {
    handleError(error, res, "Failed to remove client");
  }
}
async function getClientProjectsController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  const client_user_id = String(req.params.client_user_id);
  try {
    const projects = await getClientProjects(agency_user_id, client_user_id);
    res.json({ projects });
  } catch (error) {
    handleError(error, res, "Failed to get client projects");
  }
}
async function getBrandingController(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const branding = await getAgencyBranding(userId);
    res.json(branding);
  } catch (error) {
    handleError(error, res, "Failed to fetch agency branding");
  }
}
async function updateBrandingController(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const updated = await upsertAgencyBranding(userId, req.body);
    res.json({ success: true, branding: updated });
  } catch (error) {
    handleError(error, res, "Failed to update agency branding");
  }
}
async function createPortalShareController(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { projectId, title, passcode, expiresDays, allowedTabs } = req.body;
  if (!projectId) {
    res.status(400).json({ error: "projectId is required" });
    return;
  }
  try {
    const share = await createPortalShare({
      actorUserId: userId,
      projectId,
      title,
      passcode,
      expiresDays: typeof expiresDays === "number" ? expiresDays : void 0,
      allowedTabs: Array.isArray(allowedTabs) ? allowedTabs : void 0
    });
    res.status(201).json({ success: true, share });
  } catch (error) {
    handleError(error, res, "Failed to create share link");
  }
}
async function listPortalSharesController(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : void 0;
  try {
    const shares = await listProjectPortalShares(userId, projectId);
    res.json({ shares });
  } catch (error) {
    handleError(error, res, "Failed to list share links");
  }
}
async function revokePortalShareController(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = String(req.params.token);
  try {
    const result = await revokePortalShare(userId, token);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res, "Failed to revoke share link");
  }
}
async function getPublicPortalController(req, res) {
  const token = String(req.params.token);
  const passcode = typeof req.query.passcode === "string" ? req.query.passcode : void 0;
  try {
    const data = await getPublicPortalData(token, passcode);
    res.json(data);
  } catch (error) {
    handleError(error, res, "Failed to load client portal");
  }
}
async function unlockPublicPortalController(req, res) {
  const token = String(req.params.token);
  const passcode = typeof req.body.passcode === "string" ? req.body.passcode : "";
  try {
    const data = await getPublicPortalData(token, passcode);
    res.json(data);
  } catch (error) {
    handleError(error, res, "Invalid passcode");
  }
}
async function listDeliverablesController(req, res) {
  const agency_user_id = requireAgencyUser(req, res);
  if (!agency_user_id) return;
  const projectId = typeof req.query.project_id === "string" ? req.query.project_id : void 0;
  try {
    const deliverables = await listAgencyDeliverables(agency_user_id, projectId);
    res.json({ deliverables });
  } catch (error) {
    handleError(error, res, "Failed to list agency deliverables");
  }
}

// src/features/agency/agency_routes.ts
var router26 = (0, import_express26.Router)();
router26.get("/portal/live/:token", getPublicPortalController);
router26.post("/portal/live/:token/unlock", unlockPublicPortalController);
router26.post("/invitations/accept", acceptInvitationController);
router26.use(requireAuth);
router26.get("/portfolio", getPortfolioController);
router26.get("/members", listMembersController);
router26.post("/invitations", createInvitationController);
router26.get("/clients", listClientsController);
router26.post("/clients", addClientController);
router26.get("/clients/:client_user_id/projects", getClientProjectsController);
router26.patch("/clients/:client_user_id", updateClientStatusController);
router26.patch("/clients/:client_user_id/settings", updateClientSettingsController);
router26.delete("/clients/:client_user_id", removeClientController);
router26.get("/branding", getBrandingController);
router26.put("/branding", updateBrandingController);
router26.get("/deliverables", listDeliverablesController);
router26.get("/portal-shares", listPortalSharesController);
router26.post("/portal-shares", createPortalShareController);
router26.delete("/portal-shares/:token", revokePortalShareController);
var agency_routes_default = router26;

// src/features/payments/payments_routes.ts
var import_express27 = require("express");

// src/features/payments/payments_controller.ts
init_credits_service();
init_credits_config();
init_billing_catalog();
async function getBalanceController(req, res) {
  const { user: { id: userId } } = req;
  await grantDueAnnualSubscriptionCreditsForUser(userId);
  const balance = await getCreditBalance(userId);
  const lowBalance = await isLowBalance(userId);
  res.json({ credits_balance: balance, low_balance: lowBalance });
}
async function getCreditPacksController(req, res) {
  const { user: { id: userId } } = req;
  const audience = await getBillingAudience(userId);
  res.json({
    packs: audience === "AGENCY" ? AGENCY_CREDIT_PACKS : CREDIT_PACKS,
    account_type: audience
  });
}
async function getBillingCatalogController(req, res) {
  const { user: { id: userId } } = req;
  const audience = await getBillingAudience(userId);
  res.json(publicBillingCatalog(audience));
}
async function createCreditPackCheckoutController(req, res) {
  try {
    const { user: { id: userId } } = req;
    const { pack_id, custom_credits, request_id } = req.body;
    const checkout = await createCreditPackCheckoutSession(userId, { pack_id, custom_credits }, request_id);
    res.status(201).json(checkout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    const statusCode = message === "Invalid credit pack" ? 400 : message === "User not found" ? 404 : 500;
    if (statusCode === 500) {
      console.error("[payments_controller:createCreditPackCheckout]", error);
      res.status(500).json({ error: "Failed to create checkout session" });
      return;
    }
    res.status(statusCode).json({ error: message });
  }
}
async function getTransactionsController(req, res) {
  const { user: { id: userId } } = req;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const days = req.query.days ? Number(req.query.days) : void 0;
  const type = req.query.type === "credit" || req.query.type === "debit" ? req.query.type : "all";
  const result = await getCreditTransactions(userId, page, limit, { days, type });
  res.json(result);
}

// src/features/payments/payments_routes.ts
var router27 = (0, import_express27.Router)();
router27.get("/balance", requireAuth, getBalanceController);
router27.get("/packs", requireAuth, getCreditPacksController);
router27.post("/packs/checkout", requireAuth, createCreditPackCheckoutController);
router27.get("/catalog", requireAuth, getBillingCatalogController);
router27.get("/transactions", requireAuth, getTransactionsController);
var payments_routes_default = router27;

// src/features/campaigns/email/email_routes.ts
var import_express28 = require("express");

// src/features/campaigns/email/email_campaign_service.ts
init_prisma();
init_email_service();
async function createEmailCampaign(projectId, userId, data) {
  return await prisma_default.emailCampaign.create({
    data: {
      name: data.name,
      account_id: data.accountId,
      user_id: userId,
      template_id: data.templateId,
      status: "DRAFT"
    }
  });
}
async function getEmailCampaign(campaignId, projectId) {
  const campaign = await prisma_default.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      template: true,
      account: true,
      _count: { select: { recipients: true } }
    }
  });
  if (!campaign || campaign.account.project_id !== projectId) {
    throw new Error("Campaign not found");
  }
  return campaign;
}
async function listEmailCampaigns(accountId) {
  return await prisma_default.emailCampaign.findMany({
    where: { account_id: accountId },
    include: {
      template: true,
      _count: { select: { recipients: true } }
    },
    orderBy: { created_at: "desc" }
  });
}
async function createEmailTemplate(accountId, data) {
  return await prisma_default.emailTemplate.create({
    data: {
      account_id: accountId,
      name: data.name,
      subject: data.subject,
      html_body: data.htmlBody,
      design_json: data.designJson
    }
  });
}
async function listEmailTemplates(accountId) {
  return await prisma_default.emailTemplate.findMany({
    where: { account_id: accountId },
    orderBy: { updated_at: "desc" }
  });
}
async function addRecipientsFromCsv(campaignId, csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  let startIndex = 0;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes("email") || firstLine.includes("name")) {
    startIndex = 1;
  }
  const recipients = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",").map((p) => p.trim());
    let name = "";
    let email = "";
    if (parts.length >= 2) {
      if (parts[1].includes("@")) {
        name = parts[0];
        email = parts[1];
      } else if (parts[0].includes("@")) {
        email = parts[0];
        name = parts[1];
      }
    } else if (parts.length === 1 && parts[0].includes("@")) {
      email = parts[0];
    }
    if (email) {
      recipients.push({
        campaign_id: campaignId,
        email,
        name: name || null,
        status: "QUEUED",
        variables: name ? { name } : {}
      });
    }
  }
  if (recipients.length > 0) {
    await prisma_default.emailCampaignRecipient.createMany({
      data: recipients,
      skipDuplicates: true
    });
    await prisma_default.emailCampaign.update({
      where: { id: campaignId },
      data: {
        total_recipients: { increment: recipients.length }
      }
    });
  }
  return recipients.length;
}
async function launchEmailCampaign(campaignId, projectId) {
  const campaign = await getEmailCampaign(campaignId, projectId);
  if (!campaign.template) {
    throw new Error("Cannot launch campaign without a template");
  }
  if (campaign.status !== "DRAFT") {
    throw new Error("Campaign is already running or completed");
  }
  await prisma_default.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "RUNNING",
      started_at: /* @__PURE__ */ new Date()
    }
  });
  processCampaign(campaignId).catch((err) => {
    console.error(`Error processing campaign ${campaignId}:`, err);
  });
  return true;
}
async function processCampaign(campaignId) {
  const campaign = await prisma_default.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true, account: true }
  });
  if (!campaign || !campaign.template) return;
  const recipients = await prisma_default.emailCampaignRecipient.findMany({
    where: { campaign_id: campaignId, status: "QUEUED" }
  });
  let sent = 0;
  let failed = 0;
  const { aws_region, aws_access_key, aws_secret_key, from_email, from_name } = campaign.account;
  const awsConfig = aws_region && aws_access_key && aws_secret_key ? {
    region: aws_region,
    accessKey: aws_access_key,
    secretKey: aws_secret_key,
    source: `${from_name} <${from_email}>`
  } : void 0;
  for (const recipient of recipients) {
    try {
      let personalizedHtml = campaign.template.html_body;
      if (recipient.name) {
        personalizedHtml = personalizedHtml.replace(/\{\{\s*name\s*\}\}/g, recipient.name);
      }
      if (recipient.variables && typeof recipient.variables === "object") {
        for (const [key, value] of Object.entries(recipient.variables)) {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
          personalizedHtml = personalizedHtml.replace(regex, String(value));
        }
      }
      const response = await sendEmail({
        to: recipient.email,
        subject: campaign.template.subject,
        html: personalizedHtml,
        awsConfig
      });
      await prisma_default.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          sent_at: /* @__PURE__ */ new Date(),
          message_id: response.messageId
        }
      });
      sent++;
    } catch (error) {
      await prisma_default.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "FAILED",
          error_msg: error.message || "Unknown error"
        }
      });
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await prisma_default.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "COMPLETED",
      completed_at: /* @__PURE__ */ new Date(),
      sent_count: { increment: sent },
      failed_count: { increment: failed }
    }
  });
}

// src/features/campaigns/email/email_campaign_controller.ts
init_prisma();
init_project_access();
async function resolveProjectAccess(req, mutation) {
  const projectId = req.headers["x-project-id"];
  if (typeof projectId !== "string" || !projectId) {
    throw Object.assign(new Error("Missing project ID"), { status: 400 });
  }
  const userId = req.user.id;
  if (mutation) {
    await assertProjectMutationAccess(projectId, userId);
  } else {
    await assertProjectAccess(projectId, userId);
  }
  return projectId;
}
function handleControllerError(error, res) {
  if (error?.message === "PROJECT_NOT_FOUND") {
    return res.status(404).json({ error: "Project not found" });
  }
  if (typeof error?.status === "number") {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error?.message ?? "Internal error" });
}
function redactAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    project_id: account.project_id,
    user_id: account.user_id,
    provider: account.provider,
    from_name: account.from_name,
    from_email: account.from_email,
    reply_to_email: account.reply_to_email,
    is_verified: account.is_verified,
    aws_region: account.aws_region,
    created_at: account.created_at,
    updated_at: account.updated_at,
    configured: Boolean(account.aws_access_key && account.aws_secret_key)
  };
}
async function createAccount(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, true);
    const userId = req.user.id;
    const { fromName, fromEmail, provider, awsRegion, awsAccessKey, awsSecretKey } = req.body;
    const existing = await prisma_default.emailAccount.findUnique({
      where: { project_id: projectId }
    });
    if (existing) {
      const updated = await prisma_default.emailAccount.update({
        where: { project_id: projectId },
        data: {
          from_name: fromName,
          from_email: fromEmail,
          provider: provider || "AWS_SES",
          aws_region: awsRegion,
          aws_access_key: awsAccessKey,
          aws_secret_key: awsSecretKey,
          is_verified: true
          // Assume verified for now, or add SES verification logic later
        }
      });
      return res.json(redactAccount(updated));
    }
    const account = await prisma_default.emailAccount.create({
      data: {
        project_id: projectId,
        user_id: userId,
        from_name: fromName,
        from_email: fromEmail,
        provider: provider || "AWS_SES",
        aws_region: awsRegion,
        aws_access_key: awsAccessKey,
        aws_secret_key: awsSecretKey,
        is_verified: true
      }
    });
    res.json(redactAccount(account));
  } catch (error) {
    console.error("Create Email Account Error:", error);
    handleControllerError(error, res);
  }
}
async function getAccount(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, false);
    const account = await prisma_default.emailAccount.findUnique({
      where: { project_id: projectId }
    });
    res.json(redactAccount(account));
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function createCampaign(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, true);
    const userId = req.user.id;
    const account = await prisma_default.emailAccount.findUnique({ where: { project_id: projectId } });
    if (!account) return res.status(404).json({ error: "Email account not found" });
    const campaign = await createEmailCampaign(projectId, userId, {
      name: req.body.name,
      templateId: req.body.templateId,
      accountId: account.id
    });
    res.json(campaign);
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function listCampaigns(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, false);
    const account = await prisma_default.emailAccount.findUnique({ where: { project_id: projectId } });
    if (!account) return res.json([]);
    const campaigns = await listEmailCampaigns(account.id);
    res.json(campaigns);
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function getCampaign(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, false);
    const campaign = await getEmailCampaign(req.params.id, projectId);
    res.json({ ...campaign, account: redactAccount(campaign.account) });
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function uploadRecipients(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, true);
    const { csv } = req.body;
    await getEmailCampaign(req.params.id, projectId);
    const count = await addRecipientsFromCsv(req.params.id, csv);
    res.json({ success: true, count });
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function launchCampaign(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, true);
    await launchEmailCampaign(req.params.id, projectId);
    res.json({ success: true });
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function createTemplate(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, true);
    const account = await prisma_default.emailAccount.findUnique({ where: { project_id: projectId } });
    if (!account) return res.status(404).json({ error: "Email account not found" });
    const template = await createEmailTemplate(account.id, {
      name: req.body.name,
      subject: req.body.subject,
      htmlBody: req.body.htmlBody,
      designJson: req.body.designJson
    });
    res.json(template);
  } catch (error) {
    handleControllerError(error, res);
  }
}
async function listTemplates(req, res) {
  try {
    const projectId = await resolveProjectAccess(req, false);
    const account = await prisma_default.emailAccount.findUnique({ where: { project_id: projectId } });
    if (!account) return res.json([]);
    const templates = await listEmailTemplates(account.id);
    res.json(templates);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// src/features/campaigns/email/email_routes.ts
var router28 = (0, import_express28.Router)();
router28.post("/account", createAccount);
router28.get("/account", getAccount);
router28.post("/templates", createTemplate);
router28.get("/templates", listTemplates);
router28.post("/create", createCampaign);
router28.get("/list", listCampaigns);
router28.get("/:id", getCampaign);
router28.post("/:id/recipients/upload", uploadRecipients);
router28.post("/:id/launch", launchCampaign);
var email_routes_default = router28;

// server.ts
if (!process.env.VERCEL && process.env.ENABLE_DAILY_SCRAPE_SCHEDULER === "true") {
  void Promise.resolve().then(() => (init_daily_scheduler(), daily_scheduler_exports));
}
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception during startup/runtime", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection during startup/runtime", reason);
});
var app = (0, import_express29.default)();
var PORT = process.env.PORT || 3e3;
app.set("trust proxy", 1);
app.use((0, import_helmet.default)({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
var DEFAULT_ALLOWED_ORIGINS = [
  "https://deepmention.xyz",
  "https://www.deepmention.xyz",
  "https://app.deepmention.xyz",
  "http://localhost:5173",
  "http://localhost:3000"
];
var allowedOrigins = /* @__PURE__ */ new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...process.env.CORS_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []
]);
app.use((0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true
}));
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.post("/api/subscription/webhook", import_express29.default.raw({ type: "application/json" }), stripeWebhookController);
app.use(import_express29.default.json({
  verify: (req, _res, buffer) => {
    ;
    req.rawBody = Buffer.from(buffer);
  }
}));
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({ success: false, message: "Malformed JSON payload in request body" });
    return;
  }
  next(err);
});
app.use("/api/auth", auth_routes_default);
app.post("/api/agency/invitations/accept", acceptInvitationController);
app.use("/api/onboarding", requireAuth, onboarding_routes_default);
app.use("/api/dashboard", requireAuth, dashboard_route_default);
app.use("/api/sources", requireAuth, sources_routes_default);
app.use("/api/brands", requireAuth, brand_routes_default);
app.use("/api/scraping", requireAuth, scraping_routes_default);
app.use("/api/projects", requireAuth, projects_routes_default);
app.use("/api/prompts", requireAuth, prompt_routes_default);
app.use("/api/subscription", requireAuth, subscription_routes_default);
app.use("/api/profile", requireAuth, profile_routes_default);
app.use("/api/settings", requireAuth, settings_routes_default);
app.use("/api/help", requireAuth, help_routes_default);
app.use("/api/exports", requireAuth, export_routes_default);
app.use("/api/opportunities", requireAuth, opportunity_routes_default);
app.use("/api/geoarticles", requireAuth, geoarticle_routes_default);
app.use("/api/product-tour", requireAuth, product_tour_routes_default);
app.use("/api/reports", requireAuth, report_routes_default);
app.use("/api/artifacts", requireAuth, artifact_routes_default);
app.use("/api/action-queue", requireAuth, action_queue_routes_default);
app.use("/api/customer-support-agent", requireAuth, customer_support_agent_routes_default);
app.use("/api/reddit-intelligence", requireAuth, reddit_intelligence_routes_default);
app.use("/api/brand-preferences", requireAuth, brand_preferences_routes_default);
app.use("/api/agency", requireAuth, agency_routes_default);
app.use("/api/payments", payments_routes_default);
app.use("/api/admin", requireAuth, requireAdmin, admin_routes_default);
app.use("/api/campaigns/email", requireAuth, email_routes_default);
app.use("/api/webanalytics", webanalytics_routes_default);
app.use("/api/demo", demo_routes_default);
app.use((err, _req, res, _next) => {
  console.error("Unhandled API Error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
var server_default = app;
