import type {CartLine} from './basket';
/** Refresh image references without changing quantities or checkout pricing. */
export async function currentBasketImages(cart:CartLine[]) {
  const images=new Map<number,string|null>();
  await Promise.all([...new Set(cart.map(line=>line.dish.shopId))].map(async id=>{
    try{const response=await fetch(`/api/kitchens/${id}`,{cache:'no-store'});if(!response.ok)return;const data=await response.json();for(const item of data.shop?.menuItems??[])images.set(item.id,item.imageUrl??null);}catch{/* Keep the last working image while offline. */}
  }));
  return images;
}
export function applyBasketImages(cart:CartLine[],images:Map<number,string|null>){return cart.map(line=>images.has(line.dish.id)?{...line,dish:{...line.dish,image:images.get(line.dish.id)??null}}:line);}
