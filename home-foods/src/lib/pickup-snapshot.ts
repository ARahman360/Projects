type Pickup={name?:unknown;address?:unknown;city?:unknown;latitude?:unknown;longitude?:unknown};
export function pickupSnapshot(shop:Pickup){return JSON.stringify({name:shop.name,address:shop.address,city:shop.city,latitude:shop.latitude,longitude:shop.longitude});}
export function pickupForOrder<T extends Pickup>(order:{pickupSnapshot?:unknown},shop:T):T{
 if(typeof order.pickupSnapshot!=='string')return shop;
 try{const p=JSON.parse(order.pickupSnapshot);if(!p||typeof p!=='object')return shop;return {...shop,...Object.fromEntries(['name','address','city','latitude','longitude'].filter(k=>k in p).map(k=>[k,p[k]]))};}catch{return shop;}
}
