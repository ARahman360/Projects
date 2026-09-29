/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs');
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('app/layout.tsx',s=>s.replace('import SiteEnhancements','import AppShell from "@/src/components/app-shell";\nimport "./app-navigation.css";\nimport SiteEnhancements').replace('<SiteEnhancements />{children}','<SiteEnhancements /><AppShell>{children}</AppShell>'));
// Put navigation styles after existing page styles.
edit('app/layout.tsx',s=>s.replace('import "./app-navigation.css";\n','').replace('import "./admin-workspace.css";','import "./admin-workspace.css";\nimport "./app-navigation.css";'));
edit('app/page.tsx',s=>{
 s=s.replace('import { ThemeToggle } from "@/src/components/site-enhancements";','import { AppHeader } from "@/src/components/app-shell";');
 s=s.replace(/^.*const sidebarRef =.*\r?\n/m,'').replace(/^.*const menuTriggerRef =.*\r?\n/m,'').replace(/^.*const \[mobileMenuOpen, setMobileMenuOpen\].*\r?\n/m,'');
 s=s.replace(/        <OverlayLayer open=\{mobileMenuOpen\}[\s\S]*?<\/OverlayLayer>/,'');
 const start=s.indexOf('        <header className="site-header market-topbar">');const end=s.indexOf('</header>',start)+9;
 let h=s.slice(start,end);h=h.replace(/\s*<button ref=\{menuTriggerRef\}[\s\S]*?<\/button>/,'').replace(/\s*<Brand href="#top" \/>/,'');
 const actionStart=h.indexOf('<div className="header-actions">');const actionEnd=h.lastIndexOf('</div>')+6;
 const actions=h.slice(actionStart,actionEnd);h=h.slice(0,actionStart)+h.slice(actionEnd);
 h=h.replace('<header className="site-header market-topbar">',`<AppHeader actions={${actions}}>`).replace('</header>','</AppHeader>');
 s=s.slice(0,start)+h+s.slice(end);
 s=s.replace('if (params.get("cart") === "open")','if (params.get("q")) setQuery(params.get("q")!);\n      if (params.get("cart") === "open")');
 s=s.replace(/^  async function signOut\(\).*\r?\n/m,'');return s;
});
for(const p of ['app/orders/page.tsx','app/favorites/page.tsx','app/meal-plans/page.tsx'])edit(p,s=>{
 s=s.replace(/^import Brand .*\r?\n/m,'');
 s=s.replace(/<header className="(?:orders-header|favorites-topbar)">[\s\S]*?<\/header>/,'');
 s=s.replace(/<aside className="(?:orders-sidebar|favorites-sidebar)"[\s\S]*?<\/aside>/,'');
 s=s.replace(/^  async function signOut\(\).*\r?\n/m,'');return s;
});
edit('app/workspace/page.tsx',s=>{
 s=s.replace('import SavedAddresses','import { SecondaryNavigation } from "@/src/components/app-shell";\nimport { workspaceNavigation } from "@/src/lib/navigation";\nimport SavedAddresses');
 s=s.replace(/^  const workspaceLinks =.*\r?\n/m,'');
 s=s.replace(/<header className="workspace-header">[\s\S]*?<\/header>/,'');
 s=s.replace(/<nav className="workspace-nav"[\s\S]*?<\/nav>/,'<SecondaryNavigation items={workspaceNavigation(user.role)} label="Workspace sections"/>');return s;
});
edit('src/components/admin-workspace.tsx',s=>s.replace(/^import Brand .*\r?\n/m,'import { SecondaryNavigation } from "./app-shell";\n').replace(/<header className="workspace-header">[\s\S]*?<\/header>/,'').replace(/<nav className="ops-nav"[\s\S]*?<\/nav>/,'<SecondaryNavigation items={sections.map(([key,name])=>({label:name,href:`/workspace/admin/${key}`,icon:"workspace" as const}))} label="Administrator sections"/>'));
for(const p of ['src/components/kitchen-page.tsx','src/components/collection-page.tsx']) edit(p,s=>s.replace(/^import Brand .*\r?\n/m,'').replace(/<header className="(?:kitchen-header|collection-header)">[\s\S]*?<\/header>/,''));
