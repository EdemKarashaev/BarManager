const fs = require('node:fs');
const path = require('node:path');
function patchHome(source) {
  let s=source;
  if (!/import\s*\{[^}]*\brouter\b[^}]*\}\s*from\s*['"]expo-router['"]/.test(s)) s="import { router } from 'expo-router';\n"+s;
  const sections=/const SECTIONS\s*:[\s\S]*?=\s*\[([\s\S]*?)\];/;
  const m=s.match(sections);
  if(!m)throw Error('Не найден массив SECTIONS. Пришлите текущий src/app/home.tsx.');
  if(!/route:\s*['"]storage['"]/.test(m[1]))s=s.replace(sections,whole=>whole.replace(/=\s*\[/,"= [\n  { route: 'storage', label: 'Нормы хранения' },"));
  const routeType=/type Route\s*=([\s\S]*?);/;
  if(!routeType.test(s))throw Error('Не найден type Route. Пришлите текущий home.tsx.');
  s=s.replace(routeType,(whole,body)=>/['"]storage['"]/.test(body)?whole:whole.replace('=',"= 'storage' | "));
  const open=/const openSection\s*=\s*\(route:\s*Route\)\s*=>\s*\{/;
  if(!open.test(s)||!source.includes('setDropdownOpen'))throw Error('Обработчик разделов изменён. Пришлите текущий home.tsx.');
  if(!s.includes('// storage-rules: linked route'))s=s.replace(open,whole=>whole+"\n    // storage-rules: linked route\n    if (route === 'storage') {\n      setDropdownOpen(false);\n      router.push('/storage');\n      return;\n    }\n");
  const guide=/const guideItems = SECTIONS\.filter\(\(item\) =>\s*\[([^\]]*)\]/;
  const g=s.match(guide);
  if(!g)throw Error('Структура Справочника изменена. Пришлите текущий home.tsx.');
  if(!/['"]storage['"]/.test(g[1]))s=s.replace(guide,whole=>whole.replace('[',"['storage', "));
  return s;
}
function patchLayout(s){
  if(/<Stack\.Screen\s+name=['"]storage['"]/.test(s))return s;
  const home=/<Stack\.Screen\s+name=['"]home['"]\s*\/>/;
  if(!home.test(s))throw Error('Навигация изменена. Пришлите src/app/_layout.tsx.');
  return s.replace(home,whole=>whole+'\n      <Stack.Screen name="storage" />');
}
function install(project=process.cwd()){
 const root=path.resolve(project);
 if(!fs.existsSync(path.join(root,'package.json')))throw Error('Запустите команду из корня BarManager, где находится package.json.');
 if(!fs.existsSync(path.join(root,'src/providers/auth.tsx')))throw Error('Не найден модуль авторизации. Пришлите актуальные home.tsx и _layout.tsx.');
 const files=['src/lib/storage-rules.ts','src/lib/storage-api.ts','src/app/storage.tsx'];
 const updates=new Map([
 ['src/app/home.tsx',patchHome(fs.readFileSync(path.join(root,'src/app/home.tsx'),'utf8'))],
 ['src/app/_layout.tsx',patchLayout(fs.readFileSync(path.join(root,'src/app/_layout.tsx'),'utf8'))],
 ...files.map(f=>[f,fs.readFileSync(path.join(__dirname,'payload',f),'utf8')])]);
 const changed=[...updates].filter(([f,v])=>!fs.existsSync(path.join(root,f))||fs.readFileSync(path.join(root,f),'utf8')!==v);
 if(!changed.length){console.log('Нормы хранения уже подключены. Изменений нет.');return;}
 const backup=path.join(root,'storage-update-backups',new Date().toISOString().replace(/[:.]/g,'-'));
 const originals=new Map();
 for(const [f] of changed){const target=path.join(root,f);const old=fs.existsSync(target)?fs.readFileSync(target):null;originals.set(f,old);if(old){const b=path.join(backup,f+'.bak');fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,old);}}
 try{for(const [f,v] of changed){const target=path.join(root,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,v);}}
 catch(error){for(const [f,old] of originals){const target=path.join(root,f);if(old)fs.writeFileSync(target,old);else if(fs.existsSync(target))fs.unlinkSync(target);}throw error;}
 console.log('Готово: кнопка «Нормы хранения» подключена к таблице storage_norms в Supabase.');
 console.log('Резервная копия изменённых файлов: '+backup);
 console.log('Следующий шаг: npx expo start -c');
}
module.exports={patchHome,patchLayout,install};
if(require.main===module){try{install();}catch(e){console.error('Обновление остановлено: '+e.message);process.exitCode=1;}}
