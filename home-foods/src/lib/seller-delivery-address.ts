import {db} from '@/src/prisma/db';
import {verifiedKitchenLocation} from './kitchen-location-history';
import {verificationFields,validateAddressFields} from './address-policy';
import {verifyAddressText,distanceKm} from './location';

/** A delivery copy never updates the kitchen's operational location. */
export async function ensureSellerDeliveryAddress(userId:number){
 const existing=await db.orm.public.Address.where({userId,isArchived:false}).first();
 if(existing)return existing;
 const shop=await db.orm.public.Shop.where({sellerId:userId}).first();
 if(!shop?.address||!verifiedKitchenLocation(shop))throw Error('Add a verified personal delivery address or verify your kitchen address first.');
 // Reuse the server-verified location when its formatted address has all fields.
 const postalCode=shop.address.match(/\b\d{5}\b/)?.[0];
 const street=shop.address.split(',')[0].trim();
 let location;
 if(postalCode&&shop.city&&/\d/.test(street)&&!street.includes('[SANDBOX')){
  location={addressLine1:street,city:shop.city,postalCode,latitude:shop.latitude!,longitude:shop.longitude!};
 }else{
  location=await verifyAddressText(shop.address);
  if(distanceKm(location,{latitude:shop.latitude!,longitude:shop.longitude!})>.2)throw Error('Confirm your kitchen address before using it for personal delivery.');
 }
 const fields={addressLine1:location.addressLine1,city:location.city,postalCode:location.postalCode,countryCode:'FI',latitude:location.latitude,longitude:location.longitude};
 validateAddressFields(fields);
 return db.transaction(async tx=>{
  await tx.orm.public.User.where({id:userId}).update({updatedAt:new Date().toISOString()});
  const saved=await tx.orm.public.Address.where({userId,isArchived:false}).first();
  if(saved)return saved;
  return tx.orm.public.Address.create({userId,label:'Kitchen address',...fields,...verificationFields(fields),isDefault:true});
 });
}
