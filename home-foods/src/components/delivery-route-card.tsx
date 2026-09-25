type Point={latitude?:unknown;longitude?:unknown};
export function navigationUrl(point:Point){
  if(typeof point.latitude!=="number"||typeof point.longitude!=="number"||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=driving`;
}
export default function DeliveryRouteCard({shop,address,notes}:{shop:Point&{name?:unknown;address?:unknown};address:Point&{addressLine1?:unknown;addressLine2?:unknown;postalCode?:unknown;city?:unknown};notes?:unknown}){
  const pickup=navigationUrl(shop),dropoff=navigationUrl(address);
  return <div className="delivery-route-card"><div><span className="eyebrow">01 · PICKUP</span><strong>{String(shop.name??'Kitchen')}</strong><p>{String(shop.address??'Kitchen address not available')}</p>{pickup&&<a target="_blank" rel="noopener noreferrer" href={pickup}>Navigate to kitchen ↗</a>}</div><div><span className="eyebrow">02 · DELIVERY</span><strong>{[address.addressLine1,address.addressLine2,address.postalCode,address.city].filter(Boolean).join(', ')||'Delivery address not available'}</strong>{dropoff&&<a target="_blank" rel="noopener noreferrer" href={dropoff}>Navigate to customer ↗</a>}</div>{typeof notes==='string'&&notes&&<aside><b>Order instructions</b><p>{notes}</p></aside>}</div>;
}
