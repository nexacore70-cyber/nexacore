import "dotenv/config";
import nodemailer from "nodemailer";
import { prisma } from "../db.js";

const emailReady = ["EMAIL_HOST","EMAIL_USER","EMAIL_PASSWORD","EMAIL_FROM"].every(k=>Boolean(process.env[k]));
const mailer = emailReady ? nodemailer.createTransport({host:process.env.EMAIL_HOST,port:Number(process.env.EMAIL_PORT || 587),secure:process.env.EMAIL_SECURE === "true",auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASSWORD}}) : null;
const whatsappReady = ["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID","WHATSAPP_TEMPLATE_NAME"].every(k=>Boolean(process.env[k]));

async function send(job) {
 if (job.channel === "EMAIL") {
  if (!mailer) throw new Error("Email SMTP not configured");
  await mailer.sendMail({from:process.env.EMAIL_FROM,to:job.destination,subject:job.subject,text:job.body});
  return;
 }
 if (job.channel === "WHATSAPP") {
  // Recheck consent immediately before sending, including previously queued jobs.
  const parts=job.eventKey.split(":");
  let ticketId=null;
  if(parts[0]==="ticket")ticketId=parts[1];
  if(parts[0]==="message"){
   const msg=await prisma.supportMessage.findUnique({where:{id:parts[1]},select:{ticketId:true}});
   ticketId=msg?.ticketId;
  }
  const ticket=ticketId?await prisma.supportTicket.findUnique({where:{id:ticketId},select:{whatsappOptIn:true,whatsappPhone:true}}):null;
  if(!ticket?.whatsappOptIn || ticket.whatsappPhone!==job.destination) return "CANCELED";
  if (!whatsappReady) throw new Error("WhatsApp Cloud API or approved template not configured");
  // A pre-approved utility template with one body variable: the ticket reference.
  // Do not send arbitrary complaint text to WhatsApp.
  const match = job.body.match(/ticket\s+([\w-]+)/i);
  if (!match) throw new Error("No ticket reference for WhatsApp template");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const r = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,{method:"POST",headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:job.destination,type:"template",template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en"},components:[{type:"body",parameters:[{type:"text",text:match[1]}]}]}})});
  if (!r.ok) throw new Error(`WhatsApp provider rejected request (${r.status})`);
  return;
 }
 throw new Error("Unsupported channel");
}

async function processBatch() {
 // Recover abandoned jobs (e.g. worker crashed). Retries can cause duplicate sends if provider accepted before crash.
 await prisma.supportDelivery.updateMany({where:{status:"PROCESSING",lockedAt:{lt:new Date(Date.now()-10*60*1000)}},data:{status:"PENDING",lockedAt:null}});
 const jobs = await prisma.supportDelivery.findMany({where:{status:"PENDING",nextAttemptAt:{lte:new Date()}},orderBy:{createdAt:"asc"},take:20});
 for (const job of jobs) {
  const claim = await prisma.supportDelivery.updateMany({where:{id:job.id,status:"PENDING"},data:{status:"PROCESSING",lockedAt:new Date(),attempts:{increment:1}}});
  if (!claim.count) continue;
  try {const result=await send(job);await prisma.supportDelivery.update({where:{id:job.id},data:{status:result==="CANCELED"?"CANCELED":"SENT",sentAt:result==="CANCELED"?null:new Date(),lockedAt:null,lastError:null}});}
  catch (e) {const attempts=job.attempts+1;await prisma.supportDelivery.update({where:{id:job.id},data:{status:attempts>=5?"FAILED":"PENDING",lockedAt:null,lastError:String(e.message).slice(0,500),nextAttemptAt:new Date(Date.now()+Math.min(60,2**attempts)*60000)}});}
 }
}
// Stop immediately if Prisma Client was generated before Phase 18 models existed.
// This prevents an endless loop of "undefined (reading updateMany)" messages.
if (!prisma.supportDelivery || typeof prisma.supportDelivery.updateMany !== "function") {
 console.error("SupportDelivery is missing from Prisma Client. Stop worker; run npx prisma validate, npx prisma migrate deploy, and npx prisma generate in backend, then restart.");
 await prisma.$disconnect();
 process.exit(1);
}
try {
 await prisma.supportDelivery.findFirst({select:{id:true}});
} catch (error) {
 console.error("Support delivery database preflight failed. Confirm Phase 18 migration and DATABASE_URL:", error.message);
 await prisma.$disconnect();
 process.exit(1);
}
let busy=false;
async function tick(){if(busy)return;busy=true;try{await processBatch();}catch(e){console.error("Support delivery worker:",e.message);}finally{busy=false;}}
console.log("Support delivery worker started. SMTP:",emailReady,"WhatsApp:",whatsappReady);
await tick();setInterval(tick,15000);
