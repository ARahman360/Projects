import {db} from '@/src/prisma/db';
import {getSession,hashPassword,verifyPassword,setSession,jsonError} from '@/src/lib/auth';
import {isSameOriginRequest} from '@/src/lib/request-security';
import {profileInputError} from '@/src/lib/profile-policy';
export const runtime='nodejs';
const failures=new Map<number,{count:number;until:number}>();
export async function GET(){
 const session=await getSession();if(!session)return jsonError('Sign in to manage your account.',401);
 const user=await db.orm.public.User.where({id:session.userId}).select('id','name','email','phone','avatarUrl','role','createdAt','accountStatus').first();
 return Response.json({user},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:Request){
 if(!isSameOriginRequest(request))return jsonError('Request origin could not be verified.',403);
 const session=await getSession();if(!session)return jsonError('Sign in to manage your account.',401);
 try{
  const body=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))return jsonError('Invalid profile request.',400);
  const invalid=profileInputError(body);if(invalid)return jsonError(invalid,422);
  const user=await db.orm.public.User.where({id:session.userId}).first();if(!user)return jsonError('Account unavailable.',404);
  if(body.action==='profile'){await db.orm.public.User.where({id:user.id}).update({name:body.name.trim(),phone:body.phone.trim()||null});return Response.json({message:'Profile updated.'});}
  if(body.action!=='password')return jsonError('Unknown account action.',400);
  const failure=failures.get(user.id);if(failure&&failure.until>Date.now()&&failure.count>=5)return jsonError('Too many attempts. Try again in 15 minutes.',429);
  if(typeof body.currentPassword!=='string'||body.currentPassword.length>200||!await verifyPassword(body.currentPassword,user.password)){
   if(failures.size>5000)for(const [id,value] of failures)if(value.until<Date.now())failures.delete(id);
   failures.set(user.id,{count:failure&&failure.until>Date.now()?failure.count+1:1,until:Date.now()+900000});return jsonError('Your current password is incorrect.',403);
  }
  const password=await hashPassword(body.newPassword);
  await db.transaction(async tx=>{
   const updated=await tx.execute(tx.sql.public.user.update({password,authVersion:user.authVersion+1}).where((f,fn)=>fn.and(fn.eq(f.id,user.id),fn.eq(f.authVersion,user.authVersion))).build());
   if(!updated.affectedRows)throw Error('Account changed. Sign in again.');
   await tx.execute(tx.sql.public.passwordResetToken.delete().where((f,fn)=>fn.eq(f.userId,user.id)).build());
  });
  failures.delete(user.id);await setSession({userId:user.id,role:user.role,email:user.email,name:user.name});
  return Response.json({message:'Password updated. Other sessions have been signed out.'});
 }catch{return jsonError('Unable to save. Your input has been kept.',503);}
}
