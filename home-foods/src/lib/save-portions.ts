import type {db} from '@/src/prisma/db';
import {PortionError,type PortionDraft} from './portion-options';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Called inside the same transaction as the parent dish update. The dish row is
// locked first, matching checkout's lock order so price/availability cannot race.
export async function savePortions(tx:Transaction,menuItemId:number,options:PortionDraft[]){
  const existing=await tx.orm.public.MenuItemOption.where({menuItemId}).all();
  if(options.some(option=>option.id&&!existing.some(row=>row.id===option.id)))throw new PortionError('A portion changed or belongs to another dish. Reload the menu.');
  for(const row of existing)if(!options.some(option=>option.id===row.id))await tx.orm.public.MenuItemOption.where({id:row.id,menuItemId}).delete();
  for(const {id,...values} of options){
    if(id)await tx.orm.public.MenuItemOption.where({id,menuItemId}).update(values);
    else await tx.orm.public.MenuItemOption.create({menuItemId,...values});
  }
}
