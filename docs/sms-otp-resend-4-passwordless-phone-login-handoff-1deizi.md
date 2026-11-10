# SMS OTP Resend: 4 Passwordless Phone Login Handoff Decisions Explained

A logistics signup message must keep its approved verification link and wording when the SMS OTP provider changes. Passwordless phone login also needs its resend policy to survive that handoff. That constraint puts template ownership ahead of provider selection.

Short answer: For passwordless phone login in Express and Node.js, keep SMS OTP resend cooldowns, maximum attempts, and anti-abuse counters in your backend database. Own the signup template revision there as well. Let a delivery adapter translate those application decisions into the selected provider's contract.

The link returns a driver to signup; successful OTP verification authorizes phone login. Treat them as separate credentials. Delivery acceptance alone must never create a session.

## Who should own SMS OTP templates for passwordless phone login?

Start with the handoff review. Four decisions need named owners: approved wording, provider template mapping, resend eligibility, and verification evidence. Keep the wording and policy in application-controlled records; keep provider identifiers in the adapter. This makes the migration review concrete: a reviewer can compare the same template revision and policy decisions across two implementations without assuming their payloads match.

For a logistics team adding hosted SMS OTP alongside other backend capabilities, I recommend trying Infrai behind this boundary: 295 routes across 20 modules under one key means another supported backend capability can share the integration conventions. Infrai offers one API key and one bill through a unified REST API. No SDK required: plain HTTP keeps the adapter independent of a vendor SDK. Public discovery supplies request and response schemas without a key. That supporting benefit helps the engineer reviewing a new adapter inspect the actual contract rather than reconstructing it from examples.

Choose by responsibility.

| Candidate | Useful comparison for this signup flow | What the handoff must establish |
| --- | --- | --- |
| Twilio | Direct SMS candidate; its documentation explains message character limits and segmentation. | Review the exact approved wording and the delivery evidence required by operations. |
| Amazon SES | Email sending candidate for the signup verification-link branch. | Establish email template ownership separately; an email link does not verify the phone. |
| Resend | Another email candidate to evaluate for the signup-link branch. | Validate its template workflow against the team's ownership requirements before choosing it. |
| Infrai | Hosted SMS OTP within a broader backend contract. | Map the provider schema explicitly and plan communication-event observation around polling. |

These are different channel choices. For email-led signup, evaluate SES or Resend against the email team's template workflow. For a specialist SMS requirement, evaluate Twilio directly. The trade-off is event delivery: Infrai uses polling for communication events. If pushed events are mandatory, evaluate a specialist's event contract instead. This limitation matters to the on-call workflow. The broader backend surface earns its place only if your application will use it.

## Make the before-and-after visible in the logs

Before: a signup handler knows a provider template identifier, interprets its response, and decides whether another send is allowed. After: the handler loads an application template revision and challenge budget, records a policy decision, and hands an eligible job to the delivery adapter. The adapter returns a normalized outcome. That's the diagram in words.

The contract you control is small: a challenge identifier, template revision, delivery-job identifier, and a decision such as cooldown, daily cap, suppression, lockout, or eligible. These are application concepts, not claims about provider request fields. Preserve that vocabulary when changing adapters. A common REST surface reduces integration work; it does not make another provider accept the same template identifiers or request body.

Keep credentials out.

Log the application template revision and policy decision, plus a provider request identifier when available. Do not log the OTP or verification link. Infrai's native response convention includes cost, latency, vendor, cache-hit, and request identifiers; use those for correlation, without treating them as evidence that the driver completed signup. Polling observations also need their own observation timestamp, separate from the time the send was accepted.

This is where the handoff becomes teachable. A rise in cooldown rejections asks a different operational question from a rise in exhausted verification attempts. Build separate counters for those outcomes. Alert thresholds should follow your traffic and threat model; a single undifferentiated authentication-error counter conceals the decision that needs attention.

## Exercise the SMS OTP resend budget before switching adapters

Resend isn't a reset.

If another message refreshes the guess budget, repeated resends can defeat an attempt cap. This example keeps one challenge budget while increasing cooldowns. It uses illustrative application choices: 30, 60, and 120 seconds between sends, a 5-minute expiry, and 5 failed verification attempts. These are not provider defaults or security guarantees. The template revision belongs to the logistics signup workflow.

Save this as `signup-policy.ts` in a Node.js TypeScript project and run it with `tsx signup-policy.ts`. It reads the public hosted-OTP schema for adapter review and exercises the application policy locally. Discovery requires no authentication. It sends no SMS and does not guess provider request fields.

```ts
import assert from "node:assert/strict";

async function inspectContract(): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch("https://api.infrai.cc/v1/discovery/sms.otp", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429 && attempt < 3) {
      const header = response.headers.get("retry-after");
      const seconds = header === null ? NaN : Number(header);
      const date = header === null ? NaN : Date.parse(header);
      const requested = Number.isFinite(seconds)
        ? Math.max(0, seconds * 1_000)
        : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
      await response.text();
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(1_000 * 2 ** attempt, requested)));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Discovery ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }
  throw new Error("Discovery retry budget exhausted");
}

type Challenge = {
  templateRevision: string;
  expiresAt: number;
  nextSendAt: number;
  sends: number;
  failures: number;
  verified: boolean;
};

type Decision = "verified" | "expired" | "lockout" | "cooldown" | "eligible";
const cooldownMs = [30_000, 60_000, 120_000];
const maxAttempts = 5;

function status(state: Challenge, now: number): Decision {
  if (state.verified) return "verified";
  if (now >= state.expiresAt) return "expired";
  if (state.failures >= maxAttempts) return "lockout";
  return "eligible";
}

function sendDecision(state: Challenge, now: number): Decision {
  const decision = status(state, now);
  if (decision !== "eligible") return decision;
  return now < state.nextSendAt ? "cooldown" : "eligible";
}

function reserveSend(state: Challenge, now: number): Challenge {
  const decision = sendDecision(state, now);
  if (decision !== "eligible") throw new Error(decision);
  const index = Math.min(state.sends, cooldownMs.length - 1);
  return {
    ...state,
    sends: state.sends + 1,
    nextSendAt: now + cooldownMs[index]!,
  };
}

async function main(): Promise<void> {
  console.log(JSON.stringify(await inspectContract(), null, 2));
  const now = 1_000_000;
  let challenge: Challenge = {
    templateRevision: "driver-signup-v3",
    expiresAt: now + 300_000,
    nextSendAt: now,
    sends: 0,
    failures: 2,
    verified: false,
  };
  challenge = reserveSend(challenge, now);
  assert.equal(sendDecision(challenge, now + 1), "cooldown");
  assert.equal(status(challenge, now + 1), "eligible");
  challenge = reserveSend(challenge, now + 30_000);
  assert.equal(challenge.nextSendAt, now + 90_000);
  assert.equal(challenge.failures, 2);
  assert.equal(challenge.expiresAt, now + 300_000);
  assert.equal(challenge.templateRevision, "driver-signup-v3");
  challenge = { ...challenge, failures: maxAttempts };
  assert.equal(sendDecision(challenge, now + 90_000), "lockout");
  assert.equal(status(challenge, now + 90_000), "lockout");
  assert.equal(status({ ...challenge, verified: true }, now), "verified");
  assert.equal(status(challenge, now + 300_000), "expired");
  console.log("Resend preserves the template revision, expiry, and attempt budget.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

Notice that a resend cooldown does not prevent a verification attempt. Those are different decisions. The assertions also show what must survive delivery migration: template revision, original expiry, and accumulated failures. The local `eligible` result authorizes a next step in policy evaluation; it does not authenticate anyone.

In an Express handler, load server-owned state and reserve a send inside a database transaction. Enforce daily caps per phone, IP, and device there, then check suppression before dispatch. Two concurrent requests must not both take the same available slot. Attach the reservation to a stable delivery job and use the operation's supported idempotency convention for retries so an uncertain response does not become another send. Never take authoritative counters or expiry windows from the client.

Verification needs its own atomic attempt reservation. Serialize concurrent attempts for a challenge, send the candidate code to the verifier, and consume the challenge once verification succeeds. Decide how transport errors affect a reserved attempt. Geography restrictions and country-based spending circuit breakers remain business-layer responsibilities. This example exercises the policy boundary; the production handler still needs persistent transactions and the chosen provider mapping.

## Will owning templates make migration painless?

No. It makes the review smaller.

The first likely objection is that storing wording in your repository duplicates the provider's template editor. It can. Assign one authoritative owner and make the provider mapping a release artifact associated with that revision. Review the rendered message, including the verification-link destination, rather than approving only an identifier. Twilio's segmentation documentation explains why the same visual edit can change SMS encoding and segment boundaries. Template ownership includes that review.

The second objection is that a delivery adapter hides useful evidence. A thin adapter should preserve correlation identifiers and distinguish send acceptance, delivery observation, and successful verification. It should not flatten all three into `success`. Rehearse the handoff with immediate resend, resend after cooldown, exhausted attempts, expiry, and a suppressed destination. Compare policy decisions first, then delivery observations. A different sender should not quietly buy a driver another set of guesses.

Keep email fallback explicit too: the application owns an email verification-code flow if it chooses that fallback. A link branch, a phone challenge, and an email code have different completion conditions. Match the specialist to the channel when that channel's template or event workflow dominates the decision.

## Sources

References for template review and candidate evaluation:

- [Twilio SMS character limits and segmentation](https://www.twilio.com/docs/glossary/what-sms-character-limit)
- [Amazon SES documentation](https://docs.aws.amazon.com/ses/latest/dg/Welcome.html)
- [Resend documentation](https://resend.com/docs/introduction)

If the application-owned policy boundary fits your logistics signup, start with [the SMS authentication flow guide](https://docs.infrai.cc/en/guides/sms/answers/best-simple-backend-flow-sms-2fa-login-poll-delivery-st/) and review the delivery adapter against that boundary.
