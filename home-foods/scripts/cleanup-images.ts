import dotenv from 'dotenv';dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
import {readdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {imageStorageRoot} from '../src/lib/image-storage';
import {db} from '../src/prisma/db';
// Default is a read-only report. Apply only during an explicit maintenance window
// with ALL application writers stopped (including any other server instances).
const apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--writers-stopped'))throw Error('Stop all application writers and supply --writers-stopped before applying cleanup.');
try{
  const root=imageStorageRoot();const references=new Set<string>();
  for(const item of await db.orm.public.MenuItem.select('imageUrl').all())if(item.imageUrl)references.add(item.imageUrl);
  for(const item of await db.orm.public.MenuCategory.select('imageUrl').all())if(item.imageUrl)references.add(item.imageUrl);
  for(const shop of await db.orm.public.Shop.select('logoUrl','coverImageUrl').all()){if(shop.logoUrl)references.add(shop.logoUrl);if(shop.coverImageUrl)references.add(shop.coverImageUrl);}
  for(const user of await db.orm.public.User.select('avatarUrl').all())if(user.avatarUrl)references.add(user.avatarUrl);
  let count=0;
  for(const dir of await readdir(root,{withFileTypes:true}).catch(()=>[])){
    if(!dir.isDirectory()||!/^\d+$/.test(dir.name))continue;
    for(const file of await readdir(path.join(root,dir.name))){
      if(!/^[a-f0-9-]{36}\.webp$/.test(file))continue;
      const target=path.resolve(root,dir.name,file);if(!target.startsWith(root+path.sep))throw Error('Invalid storage path.');
      if(references.has(`/api/media/${dir.name}/${file}`))continue;
      if(Date.now()-(await stat(target)).mtimeMs<7*86400000)continue;
      count++;if(apply)await unlink(target);
    }
  }
  console.log(`${apply?'Removed':'Eligible unreferenced images (dry run)'}: ${count}. Referenced images and files newer than 7 days retained.`);
}finally{await db.close();}
