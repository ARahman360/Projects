import {createHash} from 'node:crypto';
import {db} from '@/src/prisma/db';
import {pickupSnapshot} from './pickup-snapshot';
type Location={address?:string|null;city?:string|null;latitude?:number|null;longitude?:number|null};
export const kitchenLocationHash=(shop:Location)=>createHash('sha256').update(JSON.stringify([shop.address,shop.city,shop.latitude,shop.longitude])).digest('hex');
export function verifiedKitchenLocation(shop:Location&{locationVerifiedAt?:string|null;locationVerificationHash?:string|null}){return !!shop.locationVerifiedAt&&shop.latitude!=null&&shop.longitude!=null&&shop.locationVerificationHash===kitchenLocationHash(shop);}
/** Lock the kitchen in the same order as checkout, then preserve legacy pickups before moving it. */
export async function saveKitchenLocation(id:number,sellerId:number,location:Required<Location>){
 return db.transaction(async tx=>{
  await tx.execute(tx.sql.public.shop.update({updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,id),fn.eq(f.sellerId,sellerId))).build());
  const previous=await tx.orm.public.Shop.where({id,sellerId}).first();if(!previous)throw Error('Kitchen not found.');
  for(const order of await tx.orm.public.Order.where({shopId:id}).all())if(!order.pickupSnapshot)await tx.orm.public.Order.where({id:order.id}).update({pickupSnapshot:pickupSnapshot(previous)});
  return tx.orm.public.Shop.where({id,sellerId}).update({...location,locationVerifiedAt:new Date().toISOString(),locationVerificationHash:kitchenLocationHash(location)});
 });
}
