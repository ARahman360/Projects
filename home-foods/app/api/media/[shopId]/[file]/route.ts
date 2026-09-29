import {readStoredImage} from '@/src/lib/image-storage';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{shopId:string;file:string}>}){
  const {shopId,file}=await params;
  try{const bytes=await readStoredImage(`/api/media/${shopId}/${file}`);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/webp','Content-Length':String(bytes.length),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch{return new Response('Image not found.',{status:404});}
}
