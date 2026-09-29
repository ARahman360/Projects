import {getSession,jsonError} from '@/src/lib/auth';
import {db} from '@/src/prisma/db';
import {isSameOriginRequest} from '@/src/lib/request-security';
import {MAX_IMAGE_BYTES} from '@/src/lib/upload-policy';
import {normalizeImage,storeImage,UploadError} from '@/src/lib/image-storage';
export const runtime='nodejs';
const active=new Set<number>();
const attempts=new Map<number,{count:number;until:number}>();
export async function POST(request:Request){
  if(!isSameOriginRequest(request))return jsonError('Request origin could not be verified.',403);
  const session=await getSession();if(!session)return jsonError('Sign in to upload an image.',401);
  if(session.role!=='SELLER')return jsonError('Only kitchen owners can upload menu images.',403);
  const shop=await db.orm.public.Shop.where({sellerId:session.userId}).first();if(!shop)return jsonError('Set up your kitchen first.',404);
  for(const [id,a] of attempts)if(a.until<Date.now())attempts.delete(id);
  const attempt=attempts.get(shop.id)??{count:0,until:Date.now()+3600000};attempt.count++;attempts.set(shop.id,attempt);
  if(attempt.count>60||active.has(shop.id)||active.size>=4)return jsonError('Please wait before uploading another image.',429);
  active.add(shop.id);
  try{
    if(Number(request.headers.get('content-length'))>MAX_IMAGE_BYTES)throw new UploadError('This image is too large. Please choose an image under 8 MB.',413);
    const reader=request.body?.getReader();if(!reader)throw new UploadError('Choose an image first.');
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new UploadError('This image is too large. Please choose an image under 8 MB.',413);}chunks.push(value);}}finally{reader.releaseLock();}
    const imageUrl=await storeImage(shop.id,await normalizeImage(Buffer.concat(chunks)));
    return Response.json({imageUrl},{status:201});
  }catch(e){return jsonError(e instanceof UploadError?e.message:'Upload failed. Please try again.',e instanceof UploadError?e.status:503);}
  finally{active.delete(shop.id);}
}
