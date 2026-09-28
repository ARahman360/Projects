import {getSession,jsonError} from '@/src/lib/auth';
import {db} from '@/src/prisma/db';
import {syncAccountNotifications} from '@/src/lib/account-notifications';
import {isSameOriginRequest} from '@/src/lib/request-security';
export const runtime='nodejs';
export async function GET(){
 const session=await getSession();if(!session)return jsonError('Sign in to see notifications.',401);
 try{
  await syncAccountNotifications(session);
  const notifications=await db.orm.public.Notification.where({userId:session.userId}).orderBy(n=>n.createdAt.desc()).limit(100).all();
  const unread=await db.orm.public.Notification.where({userId:session.userId,readAt:null}).select('id').all();
  return Response.json({userId:session.userId,notifications,unreadCount:unread.length},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return jsonError('Notifications could not be refreshed. Please try again.',503);}
}
export async function PATCH(request:Request){
 if(!isSameOriginRequest(request))return jsonError('Request origin could not be verified.',403);
 const session=await getSession();if(!session)return jsonError('Sign in to update notifications.',401);
 try{
  const body=await request.json();
  if(body.all===true){const unread=await db.orm.public.Notification.where({userId:session.userId,readAt:null}).select('id').all(); await db.transaction(async tx=>{for(const n of unread)await tx.orm.public.Notification.where({id:n.id,userId:session.userId}).update({readAt:new Date().toISOString()});});}
  else{if(!Number.isInteger(body.id))return jsonError('Choose a notification.',422);const notice=await db.orm.public.Notification.where({id:body.id,userId:session.userId}).first();if(!notice)return jsonError('Notification not found.',404);await db.orm.public.Notification.where({id:notice.id,userId:session.userId}).update({readAt:notice.readAt??new Date().toISOString()});}
  return Response.json({success:true});
 }catch{return jsonError('Could not mark notifications as read.',503);}
}
