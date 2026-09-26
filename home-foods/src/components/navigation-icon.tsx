import type { NavigationIcon } from '@/src/lib/navigation';
const paths: Record<NavigationIcon,string> = {
 home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 orders:'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6',heart:'M20 5c-3-3-6 0-8 2-2-2-5-5-8-2-5 5 4 12 8 15 4-3 13-10 8-15Z',
 calendar:'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
 kitchen:'M4 12h16l-2 9H6ZM8 8c-3-3 3-3 0-6m5 6c-3-3 3-3 0-6m5 6c-3-3 3-3 0-6',delivery:'M2 5h12v13H2ZM14 10h4l4 5v3h-8M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m11 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
 workspace:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',arrow:'M4 12h16m-6-6 6 6-6 6',menu:'M4 6h16M4 12h16M4 18h16',close:'m6 6 12 12M6 18 18 6',cart:'M2 3h3l3 13h11l3-10H6M9 20h1m7 0h1'
};
export default function NavigationIcon({name}:{name:NavigationIcon}) {return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}
