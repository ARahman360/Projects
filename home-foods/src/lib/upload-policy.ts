export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
export const IMAGE_HELP = 'JPG, PNG or WebP · up to 8 MB. For HEIC photos, export as JPG first.';
export function imageFileError(file: {size:number;type:string;name:string}) {
  if (!file.size) return 'This file is empty. Please choose another image.';
  if (file.size > MAX_IMAGE_BYTES) return 'This image is too large. Please choose an image under 8 MB.';
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) || (file.type && !['image/jpeg','image/png','image/webp'].includes(file.type))) return 'Please choose a JPG, PNG or WebP image. Export HEIC photos as JPG first.';
  return null;
}
export function managedImageParts(value: string) {
  const match = /^\/api\/media\/([1-9]\d*)\/([a-f0-9-]{36}\.webp)$/.exec(value);
  return match ? {shopId:Number(match[1]),file:match[2]} : null;
}
export function imageReferenceError(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return 'Choose an image or enter a valid HTTPS image URL.';
  if (!value || managedImageParts(value)) return null;
  try {const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.pathname.startsWith('/api/media/'))return null;}catch{}
  return 'Choose an image or enter a valid HTTPS image URL.';
}
