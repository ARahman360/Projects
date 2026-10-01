import { canBuy } from '@/src/lib/buyer-policy';
export type AccountRole = 'CUSTOMER' | 'SELLER' | 'RIDER' | 'ADMIN';
export type NavigationIcon = 'home' | 'search' | 'orders' | 'heart' | 'calendar' | 'settings' | 'kitchen' | 'delivery' | 'workspace' | 'arrow' | 'menu' | 'close' | 'cart';
export type NavigationItem = { label: string; href: string; icon: NavigationIcon };
export const accountHref = '/workspace#profile';
export const roleLabels: Record<AccountRole, string> = {CUSTOMER:'Customer', SELLER:'Kitchen owner', RIDER:'Delivery rider', ADMIN:'Administrator'};
export const roleDestinations: Partial<Record<AccountRole, NavigationItem>> = {
 SELLER: {label:'Your Kitchen', href:'/workspace#seller-dashboard', icon:'kitchen'},
 RIDER: {label:'Deliver', href:'/workspace#rider-dashboard', icon:'delivery'},
 ADMIN: {label:'Workspace', href:'/workspace/admin', icon:'workspace'},
};
export const discoveryNavigation: NavigationItem[] = [{label:'Home',href:'/',icon:'home'},{label:'Explore Kitchens',href:'/kitchens',icon:'search'}];
export function personalNavigation(role?: AccountRole): NavigationItem[] {
 if(!role) return [];
 return [{label:'Orders',href:'/orders',icon:'orders'}, ...(canBuy(role) ? [{label:'Meal Plans',href:'/meal-plans',icon:'calendar'},{label:'Favourites',href:'/favorites',icon:'heart'}] as NavigationItem[] : [])];
}
export const adminSections = [["overview", "Overview"], ["kitchens", "Kitchens"], ["riders", "Riders"], ["deliveries", "Deliveries"], ["customers", "Customers"], ["orders", "Orders"], ["meal-plans", "Meal Plans"], ["payments", "Payments & Payouts"], ["promotions", "Promotions"], ["reviews", "Reviews"], ["support", "Support"], ["reports", "Reports & Analytics"], ["settings", "Settings"]] as const;
export function workspaceDefaultHash(role?:AccountRole) {
 return role==='SELLER'?'#seller-dashboard':role==='RIDER'?'#rider-dashboard':'#profile';
}
export function isNavigationActive(href:string, pathname:string, hash:string) {
 const [path, anchor] = href.split('#');
 if(href==='/kitchens') return pathname==='/kitchens' || pathname.startsWith('/kitchens/');
 if(anchor) return pathname===path && hash===`#${anchor}`;
 if(path==='/workspace/admin/overview' && pathname==='/workspace/admin') return true;
 if(path==='/') return pathname==='/';
 return pathname===path || pathname.startsWith(`${path}/`);
}
export function workspaceNavigation(role:AccountRole): NavigationItem[] {
 const item=(label:string,hash:string,icon:NavigationIcon):NavigationItem=>({label,href:`/workspace#${hash}`,icon});
 if(role==='CUSTOMER') return [item('Profile','profile','settings'),item('Saved Addresses','addresses','home')];
 if(role==='SELLER') return [item('Overview','seller-dashboard','kitchen'),item('Orders to prepare','orders','orders'),item('Meal-plan obligations','obligations','calendar'),item('Delivery requests','delivery-requests','delivery'),item('Menu & kitchen','seller-menu','kitchen'),item('Kitchen Settings','kitchen-settings','settings'),item('Profile','profile','settings'),item('Saved Addresses','addresses','home')];
 if(role==='RIDER') return [item('Availability','rider-dashboard','delivery'),item('Active delivery','orders','delivery'),item('Available jobs','available-jobs','search'),item('Delivery history','delivery-history','orders'),item('Earnings','earnings','workspace'),item('Profile','profile','settings')];
 return [item('Profile','profile','settings'),{label:'Admin Workspace',href:'/workspace/admin',icon:'workspace'}];
}
