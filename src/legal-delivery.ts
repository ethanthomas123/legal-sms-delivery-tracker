import { z } from "zod";
import { infrai } from "./infrai.js";

export const matterSchema = z.object({
  matterId: z.string().min(1),
  clientPhone: z.string().min(7),
  clientName: z.string().min(1),
  signedDocument: z.string().min(1),
  deadline: z.coerce.date()
});
export type MatterIntake = z.infer<typeof matterSchema>;

export function needsFollowUp(event: { status?: string; deliveredAt?: string }, now = new Date()): boolean {
  if (event.status === "delivered") return false;
  if (!event.deliveredAt) return true;
  return now.getTime() - new Date(event.deliveredAt).getTime() > 15 * 60 * 1000;
}

export async function deliverMatter(input: unknown) {
  const matter = matterSchema.parse(input);
  const started = Date.now();
  const sent = await infrai.sms.batch.send({ messages: [{ to: matter.clientPhone, body: `Matter ${matter.matterId}: please review and sign ${matter.signedDocument} before ${matter.deadline.toISOString()}.` }] });
  await infrai.metrics.report({ name: "legal_sms_send_latency_ms", value: Date.now() - started, type: "gauge", tags: { matter_id: matter.matterId } });
  const event = await infrai.sms.events(sent.message_id);
  return { matterId: matter.matterId, messageId: sent.message_id, followUp: needsFollowUp(event as { status?: string; deliveredAt?: string }) };
}
