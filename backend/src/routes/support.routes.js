import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.middleware.js";
import { prisma } from "../db.js";
import { supportEvents, normalizePhone, notifyTicketCreated, notifyReply, enqueueSupportEvent } from "../services/supportNotifications.js";

const router = Router();
const aiLimiter = rateLimit({windowMs: 15*60*1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false});
router.use(rateLimit({windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false}));
const whatsapp = "2348104633565";
const categories = new Set(["ACCOUNT", "PAYMENT", "COURSE", "PROJECT", "CALL", "OTHER"]);
const faqs = [
  {match: /login|sign.?in|password|account/i, answer: "For login problems, check your email verification and try password recovery. Never share passwords or verification codes with support."},
  {match: /pay|refund|wallet|withdraw/i, answer: "For payment issues, create a support ticket with the transaction reference (not your card details). A staff member must review refunds or balances."},
  {match: /video|audio|microphone|camera|call/i, answer: "Check browser microphone/camera permissions, use HTTPS, and verify your network. If the issue persists, submit a support ticket."},
  {match: /bootcamp|internship|programme/i, answer: "Open Programme Enrollment to view cohorts and your applications. Admission is controlled by the programme organizer."},
];
router.get("/contact", (_req, res) => res.json({ email: process.env.SUPPORT_EMAIL || "nexacore70@gmail.com", whatsapp, whatsappUrl: `https://wa.me/${whatsapp}`, chatbotAvailable: true }));
router.post("/chat", (req, res) => {
  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 1000) return res.status(400).json({message: "Enter a message of up to 1000 characters."});
  const found = faqs.find(item => item.match.test(message));
  return res.json({reply: found?.answer || "I can help with account, payment, programmes, calls and project questions. For an issue needing investigation, sign in and create a support ticket, or contact customer care.", automated: true, escalationAvailable: true});
});
// Optional AI customer care. Never send ticket records, passwords or payment details to the model.
router.post("/chat/ai", aiLimiter, async (req, res) => {
  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 800) return res.status(400).json({message:"Enter a question of up to 800 characters."});
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({message:"AI support is not configured. Use the support chatbot or create a complaint ticket."});
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try { response = await fetch("https://api.openai.com/v1/chat/completions", {method:"POST", signal:controller.signal, headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"}, body:JSON.stringify({model:process.env.OPENAI_MODEL || "gpt-4o-mini", max_tokens:350, temperature:0.2, messages:[{role:"system",content:"You are NexaCore customer support. Help users of every role: students, tutors, clients, talent, service providers, bootcamp and internship participants, admins. Offer general troubleshooting only. Never claim access to accounts, transactions or tickets. Never promise refunds, admission or account changes. Never request passwords, OTPs, bank details or card information. When an issue requires account review, direct the user to create a support ticket or email nexacore70@gmail.com or WhatsApp +2348104633565. Be concise."},{role:"user",content:message.trim()}]})}); } finally {clearTimeout(timeout);}
    if (!response.ok) return res.status(502).json({message:"AI support is temporarily unavailable. Please use the support ticket form."});
    const data = await response.json();
    return res.json({reply:data?.choices?.[0]?.message?.content || "Please contact customer care for assistance.", automated:true, escalationAvailable:true});
  } catch {return res.status(502).json({message:"AI support is temporarily unavailable. Please use the support ticket form."});}
});
router.use(requireAuth);
router.post("/tickets", async (req, res, next) => {
  try {
    const {subject, category, description, whatsappOptIn = false, whatsappPhone} = req.body || {};
    if (typeof whatsappOptIn !== "boolean") return res.status(400).json({message:"Invalid WhatsApp consent."});
    const phone = whatsappOptIn ? normalizePhone(whatsappPhone) : null;
    if (whatsappOptIn && !phone) return res.status(400).json({message:"Enter a valid WhatsApp phone number and explicitly opt in."});
    if (typeof subject !== "string" || subject.trim().length < 5 || subject.length > 160 || !categories.has(category) || typeof description !== "string" || description.trim().length < 15 || description.length > 4000) return res.status(400).json({message: "Enter a subject (5–160 characters), valid category and description (15–4000 characters)."});
    const ticket = await prisma.supportTicket.create({data: {userId: req.user.id, subject: subject.trim(), category, description: description.trim(),whatsappOptIn,whatsappPhone:phone}});
    const customer = await prisma.user.findUnique({where:{id:req.user.id},select:{email:true}});
    try { await notifyTicketCreated(ticket,customer); } catch (error) {console.error("Support notification enqueue failed:",error.message);}
    return res.status(201).json({ticket});
  } catch (error) {next(error);}
});
router.get("/tickets", async (req, res, next) => {
  try {
    const where = req.user.role === "ADMIN" ? {} : {userId: req.user.id};
    const tickets = await prisma.supportTicket.findMany({where, orderBy: {createdAt: "desc"}, take: 100});
    return res.json({tickets});
  } catch (error) {next(error);}
});
router.patch("/tickets/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({message: "Admin access required."});
    const {status, adminReply} = req.body || {};
    if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status) || (adminReply !== undefined && (typeof adminReply !== "string" || adminReply.length > 4000))) return res.status(400).json({message: "Invalid ticket update."});
    const result = await prisma.supportTicket.updateMany({where: {id: req.params.id}, data: {status, ...(adminReply !== undefined ? {adminReply: adminReply.trim()} : {})}});
    if (!result.count) return res.status(404).json({message: "Ticket not found."});
    const ticket = await prisma.supportTicket.findUnique({where:{id:req.params.id}});
    if (adminReply !== undefined && adminReply.trim()) {
      const customer = await prisma.user.findUnique({where:{id:ticket.userId},select:{email:true}});
      try {await enqueueSupportEvent({ticket,recipientId:ticket.userId,kind:"SUPPORT_UPDATE",title:"Support ticket updated",body:`Ticket ${ticket.id} has a new Admin update. Sign in to read it.`,eventKey:`ticket:${ticket.id}:update:${ticket.updatedAt.getTime()}`,email:customer?.email,whatsappPhone:ticket.whatsappPhone});}catch(error){console.error("Support notification enqueue failed:",error.message);}
    }
    return res.json({updated: true});
  } catch (error) {next(error);}
});
// A ticket owner can withdraw WhatsApp consent at any time.
router.post("/tickets/:id/whatsapp-opt-out", async (req,res,next)=>{
 try {const result=await prisma.supportTicket.updateMany({where:{id:req.params.id,userId:req.user.id},data:{whatsappOptIn:false,whatsappPhone:null}});if(!result.count)return res.status(404).json({message:"Ticket not found."});await prisma.supportDelivery.updateMany({where:{channel:"WHATSAPP",status:"PENDING",eventKey:{startsWith:`ticket:${req.params.id}:`}},data:{status:"CANCELED"}});res.json({updated:true});}catch(e){next(e);}
});
// Ticket thread: only the ticket owner or an Admin can read or post.
router.get("/tickets/:id/messages", async (req, res, next) => {
 try {
  const ticket = await prisma.supportTicket.findUnique({where:{id:req.params.id}, select:{id:true,userId:true}});
  if (!ticket || (req.user.role !== "ADMIN" && ticket.userId !== req.user.id)) return res.status(404).json({message:"Ticket not found."});
  const messages = await prisma.supportMessage.findMany({where:{ticketId:ticket.id},orderBy:{createdAt:"asc"},take:200});
  res.json({messages});
 } catch(e){next(e);}
});
router.post("/tickets/:id/messages", async (req, res, next) => {
 try {
  const body = req.body?.body;
  if (typeof body !== "string" || !body.trim() || body.length > 4000) return res.status(400).json({message:"Message must be 1–4000 characters."});
  const ticket = await prisma.supportTicket.findUnique({where:{id:req.params.id}, select:{id:true,userId:true,status:true}});
  if (!ticket || (req.user.role !== "ADMIN" && ticket.userId !== req.user.id)) return res.status(404).json({message:"Ticket not found."});
  if (ticket.status === "RESOLVED" && req.user.role !== "ADMIN") return res.status(409).json({message:"This ticket is resolved. Open a new ticket for further assistance."});
  const message = await prisma.supportMessage.create({data:{ticketId:ticket.id,authorId:req.user.id,authorRole:req.user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",body:body.trim()}});
  try {await notifyReply(ticket,message);} catch(error){console.error("Support notification enqueue failed:",error.message);}
  res.status(201).json({message});
 } catch(e){next(e);}
});
// Notification feed and authenticated Server-Sent Events stream.
router.get("/notifications", async (req,res,next)=>{try {const notifications=await prisma.supportNotification.findMany({where:{recipientId:req.user.id},orderBy:{createdAt:"desc"},take:50});res.json({notifications});}catch(e){next(e);}});
router.patch("/notifications/:id/read", async (req,res,next)=>{try {const result=await prisma.supportNotification.updateMany({where:{id:req.params.id,recipientId:req.user.id},data:{readAt:new Date()}});res.json({updated:Boolean(result.count)});}catch(e){next(e);}});
router.get("/notifications/stream", async (req,res)=>{
 res.setHeader("Content-Type","text/event-stream");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive");res.flushHeaders?.();
 const eventName=`user:${req.user.id}`;
 const listener=(notification)=>res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
 supportEvents.on(eventName,listener);
 res.write(": connected\n\n");
 const heartbeat=setInterval(()=>res.write(": heartbeat\n\n"),25000);
 req.on("close",()=>{clearInterval(heartbeat);supportEvents.off(eventName,listener);});
});
export default router;
