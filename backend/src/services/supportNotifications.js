import { EventEmitter } from "node:events";
import { prisma } from "../db.js";

// Events are best-effort live hints; database records remain authoritative.
export const supportEvents = new EventEmitter();
supportEvents.setMaxListeners(200);

export function normalizePhone(raw) {
  const value = String(raw || "").replace(/[\s()+-]/g, "");
  const phone = value.startsWith("0") && value.length === 11 ? `234${value.slice(1)}` : value;
  return /^\d{10,15}$/.test(phone) ? phone : null;
}

export async function enqueueSupportEvent({ticket, recipientId, kind, title, body, eventKey, email, whatsappPhone}) {
  // Each record and job has a stable key; duplicate attempts never duplicate external delivery.
  const notification = await prisma.supportNotification.create({data:{recipientId,ticketId:ticket.id,kind,title,body:body.slice(0,500)}});
  const jobs = [];
  if (email) jobs.push({eventKey:`${eventKey}:email`,channel:"EMAIL",destination:email,subject:title,body});
  if (whatsappPhone && ticket.whatsappOptIn) jobs.push({eventKey:`${eventKey}:whatsapp`,channel:"WHATSAPP",destination:whatsappPhone,subject:title,body});
  for (const job of jobs) await prisma.supportDelivery.upsert({where:{eventKey:job.eventKey},update:{},create:job});
  supportEvents.emit(`user:${recipientId}`, notification);
  return notification;
}

export async function notifyTicketCreated(ticket, customer) {
  const adminEmail = process.env.SUPPORT_EMAIL || "nexacore70@gmail.com";
  await enqueueSupportEvent({ticket,recipientId:ticket.userId,kind:"TICKET_CREATED",title:"Support ticket received",body:`Your ticket ${ticket.id} has been received.`,eventKey:`ticket:${ticket.id}:created:customer`,email:customer.email});
  // Admins get in-app notifications; one support inbox email, not one email per Admin.
  const admins = await prisma.user.findMany({where:{role:"ADMIN",status:"ACTIVE"},select:{id:true}});
  for (const admin of admins) await enqueueSupportEvent({ticket,recipientId:admin.id,kind:"NEW_TICKET",title:"New support ticket",body:`Ticket ${ticket.id}: ${ticket.subject}`,eventKey:`ticket:${ticket.id}:created:admin:${admin.id}`});
  await prisma.supportDelivery.upsert({where:{eventKey:`ticket:${ticket.id}:created:inbox`},update:{},create:{eventKey:`ticket:${ticket.id}:created:inbox`,channel:"EMAIL",destination:adminEmail,subject:`New NexaCore ticket ${ticket.id}`,body:`Ticket ${ticket.id} (${ticket.category}) created. Open the Admin Support Desk to review. Do not reply to this notification.`}});
}

export async function notifyReply(ticket, message) {
  const customer = await prisma.user.findUnique({where:{id:ticket.userId},select:{email:true}});
  if (message.authorRole === "ADMIN") {
    await enqueueSupportEvent({ticket,recipientId:ticket.userId,kind:"SUPPORT_REPLY",title:"Customer care replied",body:`A new response is available for ticket ${ticket.id}. Sign in to view it.`,eventKey:`message:${message.id}:customer`,email:customer?.email,whatsappPhone:ticket.whatsappPhone});
  } else {
    const admins = await prisma.user.findMany({where:{role:"ADMIN",status:"ACTIVE"},select:{id:true}});
    for (const admin of admins) await enqueueSupportEvent({ticket,recipientId:admin.id,kind:"CUSTOMER_REPLY",title:"Customer replied",body:`New message on ticket ${ticket.id}.`,eventKey:`message:${message.id}:admin:${admin.id}`});
    await prisma.supportDelivery.upsert({where:{eventKey:`message:${message.id}:inbox`},update:{},create:{eventKey:`message:${message.id}:inbox`,channel:"EMAIL",destination:process.env.SUPPORT_EMAIL || "nexacore70@gmail.com",subject:`Reply on ticket ${ticket.id}`,body:`Customer replied to ticket ${ticket.id}. Open the Admin Support Desk to read it.`}});
  }
}
