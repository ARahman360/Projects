import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {imageFileError,imageReferenceError,managedImageParts,MAX_IMAGE_BYTES} from '../src/lib/upload-policy.ts';
import {normalizeImage} from '../src/lib/image-storage.ts';
test('client upload limits reject unsafe, empty and oversized files',()=>{
  for(const [name,type,size] of [['x.exe','image/jpeg',10],['x.heic','image/heic',10],['x.jpg','image/jpeg',0],['x.png','image/png',MAX_IMAGE_BYTES+1]])assert.ok(imageFileError({name,type,size}));
  assert.equal(imageFileError({name:'photo.JPG',type:'image/jpeg',size:1000}),null);
});
test('image references reject local paths, data, traversal and credential URLs',()=>{
  for(const url of ['C:\\image.jpg','data:image/png;base64,abc','//evil.com/x','/api/media/1/../../secret','https://user:pass@host/a.jpg','https://host/api/media/2/x'])assert.ok(imageReferenceError(url));
  assert.equal(imageReferenceError('https://example.com/photo.jpg'),null);
  assert.equal(managedImageParts('/api/media/1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp')?.shopId,1);
});
test('server decodes JPG PNG WebP and produces metadata-free webp',async()=>{
  for(const format of ['jpeg','png','webp']){const bytes=await sharp({create:{width:100,height:80,channels:3,background:'red'}}).toFormat(format).toBuffer();const output=await normalizeImage(bytes);const info=await sharp(output).metadata();assert.equal(info.format,'webp');assert.equal(info.width,100);assert.equal(info.exif,undefined);}
});
test('server rejects corrupt, empty, oversized and undersized images',async()=>{
  for(const bytes of [Buffer.alloc(0),Buffer.from('not a picture'),Buffer.alloc(MAX_IMAGE_BYTES+1),await sharp({create:{width:10,height:10,channels:3,background:'red'}}).png().toBuffer()])await assert.rejects(normalizeImage(bytes));
});
