import Link from 'next/link';

export default function SellerKitchenAccess({shop}:{shop:Record<string,unknown>}) {
  if (shop.status === 'SUSPENDED' || shop.status === 'CLOSED') return <span className="workspace-muted">Kitchen {String(shop.status).toLowerCase()}</span>;
  if (!shop.id || !shop.profileCompletedAt || !shop.locationIsVerified) return <Link className="seller-kitchen-link" href="/workspace#kitchen-settings">Complete Kitchen Setup</Link>;
  if (shop.status !== 'ACTIVE') return <span className="workspace-muted">Kitchen awaiting approval</span>;
  return <Link className="seller-kitchen-link" href={`/kitchens/${Number(shop.id)}`}>View My Kitchen <span aria-hidden="true">↗</span></Link>;
}
