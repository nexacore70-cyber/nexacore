import { prisma } from "../db.js";
export async function requireOnboardedWhenAuthenticated(req,res,next){
 const authorization=req.headers.authorization;
 if (!authorization?.startsWith("Bearer ")) return next(); // Existing endpoint authentication still applies.
 try {
  const crypto=await import("node:crypto");
  const hash=crypto.createHash("sha256").update(authorization.slice(7).trim()).digest("hex");
  const session=await prisma.session.findUnique({where:{tokenHash:hash},include:{user:true}});
  if(session?.expiresAt>new Date() && session.user.role!=="ADMIN" && !session.user.onboardingCompletedAt)
   return res.status(403).json({message:"Complete your NexaCore account setup first.",code:"ONBOARDING_REQUIRED"});
  next();
 }catch(e){next(e)}
}
