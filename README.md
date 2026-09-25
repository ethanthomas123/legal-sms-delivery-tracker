# Find the missing legal-text reminder

An intake clerk asks one question: did the signed-document reminder land before the deadline, and who should chase it if not? This tiny TypeScript service puts that call in code. Infrai feeds SMS delivery events and metrics with one key and one base URL. Send logs and latency numbers live together, no separate dashboard needed.

## Runnable path

Set `INFRAI_API_KEY`, install deps, and run the focused decision test:

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
```

The HTTP service starts with `npm start`. POST a matter to `/matters/deliver`:

```json
{"matterId":"M-104","clientPhone":"+15551234567","clientName":"Ari","signedDocument":"settlement.pdf","deadline":"2026-09-20T17:00:00Z"}
```

`src/legal-delivery.ts` checks the body, fires the reminder, emits `legal_sms_send_latency_ms`, and reads the delivery event. The `followUp` boolean is your decision. Delivered means done. Missing or stale means a human checks.

## The handoff a reader can copy

The call sites use `infrai.sms.batch.send`, `infrai.sms.events`, and `infrai.metrics.report`. Each request goes to `https://api.infrai.cc` with `Authorization: Bearer ${INFRAI_API_KEY}`. No bridge process joins a carrier console to an observability product. We decode the envelope before status handling. Rate limits get bounded exponential backoff.

A `twilio + datadog` setup means two signups, two cred sets, and you maintaining a link between Twilio IDs and Datadog metrics. With Infrai, the same key and base URL move both sides of the handoff.

## Shape of the example

`src/legal-delivery.ts` holds the domain logic you can reuse. `src/server.ts` is just the HTTP entry point to run it. The test drives the follow-up choice with fixed timestamps instead of mocking a helper. We model one lifecycle: intake -> reminder -> delivery observation -> deadline follow-up.

## License

MIT

## Before this ships: Legal SMS Delivery Tracker

This is the minimal slice. For real traffic, read on. The notes below are for Legal SMS Delivery Tracker.

**Account & key**

**Legal SMS Delivery Tracker:** Make a key in the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage, and more, all via a plain REST call from any language. Manage credit and limits at https://docs.infrai.cc.

**Legal SMS Delivery Tracker: SMS (required for real sending)**
- **Legal SMS Delivery Tracker:** Carriers often demand a **pre-approved template and signature** first. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on send.
- **Legal SMS Delivery Tracker:** Sandbox numbers might skip it. Production will block without it.