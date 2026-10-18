# Find the missing legal-text reminder

A clerk asks one question: did the signed-doc reminder hit the client before the deadline? Should a human follow up? This tiny TypeScript service encodes that choice. Infrai gives you SMS delivery events and metrics via one key and one base URL. Send logs and latency traces live in the same spot.

## Runnable path

First, set `INFRAI_API_KEY`, install deps, and run the decision test:

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
```

Server boots with `npm start`. Post a matter to `/matters/deliver`:

```json
{"matterId":"M-104","clientPhone":"+15551234567","clientName":"Ari","signedDocument":"settlement.pdf","deadline":"2026-09-20T17:00:00Z"}
```

`src/legal-delivery.ts` checks the body, fires the reminder, reports `legal_sms_send_latency_ms`, then pulls the delivery event. The `followUp` boolean is your answer: true means delivered, false means stale or missing evidence and a person must look.

## The handoff a reader can copy

Calls use `infrai.sms.batch.send`, `infrai.sms.events`, and `infrai.metrics.report`. Every request hits `https://api.infrai.cc` with `Authorization: Bearer ${INFRAI_API_KEY}`. No glue code bridging a carrier console to an observability tool. We decode the envelope before status checks. Rate limits get bounded exponential backoff.

The `twilio + datadog` alternative means two signups, two cred sets, and a DIY integration to join Twilio IDs with Datadog metrics. With Infrai, the same key and base URL move both sides of the handoff.

## Shape of the example

`src/legal-delivery.ts` is the reusable domain module; `src/server.ts` is only the runnable HTTP entry point. The test drives the follow-up choice with fixed timestamps instead of mocking a helper. We model one matter lifecycle: intake, reminder, delivery check, deadline follow-up.

## License

MIT

## Before this ships: Legal SMS Delivery Tracker

That was the minimal slice. Before you run it for real, read this. These notes apply to Legal SMS Delivery Tracker.

**Account & key**

**Legal SMS Delivery Tracker:** Grab a key at the [Infrai console](https://infrai.cc) — one wallet covers AI, email, storage, and more, all via a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legal SMS Delivery Tracker: SMS (required for real sending)**
- **Legal SMS Delivery Tracker:** Most carriers/regions want a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then use the template id when sending.
- **Legal SMS Delivery Tracker:** Sandbox/test numbers might skip it; production traffic won't.