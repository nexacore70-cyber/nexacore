import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const safe = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
const fail = (res, e) => { console.error("Community error:", e.message); return res.status(500).json({message:"Community request failed."}); };
const isAdmin = (u) => u.role === "ADMIN";

router.use(requireAuth);
router.get("/", async (req,res) => {
  try {
    const groups = await prisma.communityGroup.findMany({
      where:{ OR:[{visibility:"PUBLIC"},{ownerId:req.user.id},{members:{some:{userId:req.user.id}}}] },
      orderBy:{createdAt:"desc"},take:100,
      include:{_count:{select:{members:true,posts:true}},members:{where:{userId:req.user.id},select:{id:true}}}
    });
    res.json({groups:groups.map(({members,...g})=>({...g,joined:members.length>0}))});
  } catch(e){fail(res,e);}
});
router.post("/",async(req,res)=>{
  const name=safe(req.body?.name,80),description=safe(req.body?.description,500);
  if(name.length<3 || !["PUBLIC","PRIVATE"].includes(req.body?.visibility)) return res.status(400).json({message:"Provide a group name and visibility."});
  try {
    const group=await prisma.communityGroup.create({data:{name,description,visibility:req.body.visibility,ownerId:req.user.id,members:{create:{userId:req.user.id}}}});
    res.status(201).json({group});
  }catch(e){fail(res,e);}
});
router.post("/:id/join",async(req,res)=>{
  try {
    const group=await prisma.communityGroup.findUnique({where:{id:req.params.id}});
    if(!group)return res.status(404).json({message:"Group not found."});
    if(group.visibility!=="PUBLIC" && group.ownerId!==req.user.id)return res.status(403).json({message:"Private group requires an invitation."});
    await prisma.communityMember.upsert({where:{groupId_userId:{groupId:group.id,userId:req.user.id}},create:{groupId:group.id,userId:req.user.id},update:{}});
    res.json({joined:true});
  }catch(e){fail(res,e);}
});
router.get("/:id/posts",async(req,res)=>{
  try{
    const member=await prisma.communityMember.findUnique({where:{groupId_userId:{groupId:req.params.id,userId:req.user.id}}});
    if(!member)return res.status(403).json({message:"Join the group to view posts."});
    const posts=await prisma.communityPost.findMany({where:{groupId:req.params.id},orderBy:{createdAt:"desc"},take:100});
    res.json({posts});
  }catch(e){fail(res,e);}
});
router.post("/:id/posts",async(req,res)=>{
  const body=safe(req.body?.body,2000);
  if(body.length<2)return res.status(400).json({message:"Post must contain at least two characters."});
  try{
    const member=await prisma.communityMember.findUnique({where:{groupId_userId:{groupId:req.params.id,userId:req.user.id}}});
    if(!member)return res.status(403).json({message:"Join the group before posting."});
    const post=await prisma.communityPost.create({data:{groupId:req.params.id,authorId:req.user.id,body}});
    res.status(201).json({post});
  }catch(e){fail(res,e);}
});
router.delete("/:id/posts/:postId",async(req,res)=>{
  try{
    const post=await prisma.communityPost.findFirst({where:{id:req.params.postId,groupId:req.params.id}});
    if(!post)return res.status(404).json({message:"Post not found."});
    const group=await prisma.communityGroup.findUnique({where:{id:req.params.id}});
    if(post.authorId!==req.user.id && group.ownerId!==req.user.id && !isAdmin(req.user))return res.status(403).json({message:"Not authorized."});
    await prisma.communityPost.delete({where:{id:post.id}});
    res.json({deleted:true});
  }catch(e){fail(res,e);}
});
export default router;
