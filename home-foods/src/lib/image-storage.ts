import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { MAX_IMAGE_BYTES, managedImageParts, imageReferenceError } from './upload-policy';

export class UploadError extends Error { constructor(message:string,public status=422){super(message);} }
export function imageStorageRoot() {
  const configured=process.env.HOMEFOODS_UPLOAD_DIR;
  if(process.env.NODE_ENV==='production'&&!configured)throw new UploadError('Image uploads need persistent storage configured. Please contact support.',503);
  return path.resolve(configured || path.join(process.cwd(),'.data','uploads'));
}
export async function normalizeImage(bytes:Buffer) {
  if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw new UploadError('Choose a non-empty image under 8 MB.');
  try {
    const decoder=sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'});
    const info=await decoder.metadata();
    if(!['jpeg','png','webp'].includes(info.format??'')||(info.pages??1)>1)throw new Error();
    if(!info.width||!info.height||info.width<64||info.height<64)throw new Error();
    // Fully decode and re-encode: discard filenames, metadata/GPS and appended payloads.
    return await decoder.rotate().resize(2000,2000,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  }catch{throw new UploadError('This image could not be read. Choose a single JPG, PNG or WebP photo, at least 64 × 64 pixels and at most 40 megapixels.');}
}
export async function storeImage(shopId:number,bytes:Buffer) {
  const dir=path.join(imageStorageRoot(),String(shopId));await mkdir(dir,{recursive:true});
  const files=await readdir(dir);const stats=await Promise.all(files.filter(f=>f.endsWith('.webp')).map(f=>stat(path.join(dir,f))));
  if(stats.reduce((n,s)=>n+s.size,bytes.length)>250*1024*1024||stats.length>=1000)throw new UploadError('Your kitchen image storage is full. Please contact support.',429);
  if(stats.filter(s=>Date.now()-s.mtimeMs<3600000).length>=30)throw new UploadError('Too many uploads. Please try again in an hour.',429);
  const file=`${randomUUID()}.webp`;await writeFile(path.join(dir,file),bytes,{flag:'wx',mode:0o600});
  return `/api/media/${shopId}/${file}`;
}
export async function validateImageReference(value:unknown,shopId:number,previous?:string|null) {
  // Preserve existing external image references while sellers edit unrelated fields.
  if(value===previous)return;
  const error=imageReferenceError(value);if(error)throw new UploadError(error);
  const parts=managedImageParts(String(value));if(!parts)return;
  if(parts.shopId!==shopId)throw new UploadError('Choose an image uploaded by your own kitchen.',403);
  try{await stat(path.join(imageStorageRoot(),String(shopId),parts.file));}catch{throw new UploadError('This uploaded image is no longer available. Please upload it again.');}
}
export async function readStoredImage(reference:string) {
  const parts=managedImageParts(reference);if(!parts)throw new UploadError('Image not found.',404);
  return readFile(path.join(imageStorageRoot(),String(parts.shopId),parts.file));
}
export async function queueImageCleanup(previous:unknown,next:unknown) {
  if(typeof previous!=='string'||previous===next||!managedImageParts(previous))return;
  // Queue only after a successful database mutation. Cleanup runs in maintenance
  // with writes stopped and checks every live reference before removing anything.
  try{const dir=path.join(imageStorageRoot(),'cleanup');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,`${randomUUID()}.json`),JSON.stringify({reference:previous,queuedAt:new Date().toISOString()}),{flag:'wx'});}catch{console.error('Image cleanup could not be queued; the old image was retained.');}
}
