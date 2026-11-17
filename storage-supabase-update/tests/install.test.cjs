const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {patchHome,patchLayout,install}=require('../install.cjs');
const home=`import { router } from 'expo-router';
type Route = 'ttk' | 'info';
const SECTIONS: { route: Route; label: string }[] = [
{ route: 'ttk', label: 'ТТК' },
];
const openSection = (route: Route) => {
setDropdownOpen(false);
setActiveSection(route);
};
const guideItems = SECTIONS.filter((item) =>
 ['ttk', 'info'].includes(item.route)
);
// preserve my custom code`;
const layout='<Stack.Protected guard={!!session && !!staff}><Stack.Screen name="home" /></Stack.Protected>';
test('restores missing button and guide entry; repeated patch is idempotent',()=>{const s=patchHome(home);assert.match(s,/router.push\('\/storage'\)/);assert.match(s,/route: 'storage'/);assert.match(s,/\['storage', 'ttk'/);assert.match(s,/preserve my custom code/);assert.equal(patchHome(s),s);});
test('screen added in same protected group as home',()=>{const s=patchLayout(layout);assert.ok(s.indexOf('name="storage"')<s.indexOf('</Stack.Protected>'));assert.equal(patchLayout(s),s);});
test('installer preserves config and creates backups without replacing unrelated code',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'storage-test-'));try{fs.mkdirSync(path.join(root,'src/app'),{recursive:true});fs.mkdirSync(path.join(root,'src/providers'),{recursive:true});fs.writeFileSync(path.join(root,'src/providers/auth.tsx'),'test');for(const [f,v] of [['package.json','{}'],['.env','do-not-touch'],['src/app/home.tsx',home],['src/app/_layout.tsx',layout]])fs.writeFileSync(path.join(root,f),v);install(root);install(root);assert.equal(fs.readFileSync(path.join(root,'.env'),'utf8'),'do-not-touch');assert.equal(fs.readFileSync(path.join(root,'package.json'),'utf8'),'{}');assert.equal(fs.readdirSync(path.join(root,'storage-update-backups')).length,1);assert.ok(fs.existsSync(path.join(root,'src/lib/storage-api.ts')));assert.equal(fs.existsSync(path.join(root,'src/data/storage-rules.json')),false);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('unknown layout fails before any project file is changed',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'storage-test-'));try{fs.mkdirSync(path.join(root,'src/app'),{recursive:true});fs.mkdirSync(path.join(root,'src/providers'),{recursive:true});fs.writeFileSync(path.join(root,'src/providers/auth.tsx'),'test');fs.writeFileSync(path.join(root,'package.json'),'{}');fs.writeFileSync(path.join(root,'src/app/home.tsx'),home);fs.writeFileSync(path.join(root,'src/app/_layout.tsx'),'unknown layout');assert.throws(()=>install(root));assert.equal(fs.readFileSync(path.join(root,'src/app/home.tsx'),'utf8'),home);assert.equal(fs.existsSync(path.join(root,'src/app/storage.tsx')),false);}finally{fs.rmSync(root,{recursive:true,force:true});}});
