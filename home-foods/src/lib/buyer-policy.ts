/** Buying is a capability shared by customers, sellers and delivery partners. */
export function canBuy(role: unknown): boolean {
  return role === 'CUSTOMER' || role === 'SELLER' || role === 'RIDER';
}
export function ownsKitchen(userId: number | undefined, sellerId: number | undefined): boolean {
  return userId !== undefined && sellerId !== undefined && userId === sellerId;
}
export function canDeliverOrder(userId: number, customerId: number): boolean {
  return userId !== customerId;
}
