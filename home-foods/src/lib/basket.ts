export type Dish = { id: number; shopId: number; name: string; shop: string; cuisine: string; category: string; price: number; rating: number | null; time: string; estimatedMinutes?: number | null; deliveryDistanceKm?: number | null; image: string | null; description: string; deliveryFee: number; orderCount?: number; favoriteCount?: number; isFeatured?: boolean };
export type CartLine = {dish:Dish;quantity:number};
export function basketTotals(cart:CartLine[]){
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.dish.price, 0);
  const deliveryTotal = [...new Map(cart.map(({ dish }) => [dish.shopId, dish.deliveryFee])).values()].reduce((sum, fee) => sum + fee, 0);
  const serviceFee = Math.round([...new Set(cart.map(line => line.dish.shopId))].reduce((total, shopId) => total + Math.round(cart.filter(line => line.dish.shopId === shopId).reduce((sum, line) => sum + line.dish.price * line.quantity, 0) * 5) / 100, 0) * 100) / 100;
  const cartTotal = subtotal + deliveryTotal + serviceFee;
return {subtotal,deliveryTotal,serviceFee,cartTotal};
}
