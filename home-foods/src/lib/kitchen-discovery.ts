import {normalizeCatalogSearchText as normalize} from './catalog-filter';
export type Kitchen = {id:number;name:string;description?:string|null;logoUrl?:string|null;coverImageUrl?:string|null;city?:string|null;cuisine?:string;isOnline?:boolean;rating?:number|null;reviewCount?:number;estimatedMinutes?:number|null;deliveryFee?:number|null;orderCount?:number;favoriteCount?:number;createdAt?:string;deliverable?:boolean|null;deliveryStatus?:string|null;deliveryDistanceKm?:number|null};
export const kitchenCollections = {
 'featured-kitchens':'Featured Kitchens', 'popular-restaurants':'Popular Restaurants', 'highly-rated':'Highly Rated Kitchens', 'new-on-homefoods':'Recently Added Kitchens', 'international-kitchens':'International Kitchens',
} as const;
export function filterKitchens(shops:Kitchen[],filters:{query:string;cuisine:string;collection:string;sort:string;quick:boolean;free:boolean}) {
 const query=normalize(filters.query.trim());
 const result=shops.filter(s=>(!query||normalize(`${s.name} ${s.cuisine??''} ${s.city??''} ${s.description??''}`).includes(query))&&(!filters.cuisine||s.cuisine===filters.cuisine)&&(!filters.quick||(s.estimatedMinutes!=null&&s.estimatedMinutes<=30))&&(!filters.free||s.deliveryFee===0)
  &&(filters.collection!=='highly-rated'||(s.reviewCount??0)>0&&(s.rating??0)>=4.5)
  &&(filters.collection!=='popular-restaurants'||(s.orderCount??0)>0)
  &&(filters.collection!=='international-kitchens'||!/bangla|bengali/i.test(s.cuisine??'')));
 const sort=filters.sort||({'popular-restaurants':'popular','new-on-homefoods':'newest'}[filters.collection]??'rating');
 return result.sort((a,b)=> (sort==='fee'?(a.deliveryFee??Infinity)-(b.deliveryFee??Infinity):sort==='quick'?(a.estimatedMinutes??Infinity)-(b.estimatedMinutes??Infinity):sort==='newest'?String(b.createdAt??'').localeCompare(String(a.createdAt??'')):sort==='popular'?(b.orderCount??0)-(a.orderCount??0):(b.rating??-1)-(a.rating??-1))||a.name.localeCompare(b.name));
}
