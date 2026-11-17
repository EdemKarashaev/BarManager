const fs=require('node:fs');const path=require('node:path');
const root=process.cwd();
const files=['src/app/recipes/index.tsx','src/lib/recipes.ts','src/lib/recipe-model.ts','src/lib/recipe-sections.ts'];
try{
 if(!fs.existsSync(path.join(root,'package.json'))||!fs.existsSync(path.join(root,'src/providers/auth.tsx'))||!fs.existsSync(path.join(root,'src/components/recipe-ui.tsx')))throw Error('Запустите из корня текущего BarManager. Если структура отличается, пришлите актуальный проект.');
 const changes=files.map(f=>[f,fs.readFileSync(path.join(__dirname,'payload',f))]).filter(([f,data])=>!fs.existsSync(path.join(root,f))||!fs.readFileSync(path.join(root,f)).equals(data));
 if(!changes.length){console.log('Обновление уже установлено.');process.exit(0);}
 const backup=path.join(root,'ttk-update-backups',new Date().toISOString().replace(/[:.]/g,'-'));
 const originals=new Map();
 for(const [f] of changes){const target=path.join(root,f);const old=fs.existsSync(target)?fs.readFileSync(target):null;originals.set(f,old);if(old){const dest=path.join(backup,f+'.bak');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,old);}}
 try{for(const [f,data] of changes){const target=path.join(root,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);}}
 catch(error){for(const [f,old] of originals){const target=path.join(root,f);if(old)fs.writeFileSync(target,old);else if(fs.existsSync(target))fs.unlinkSync(target);}throw error;}
 console.log('Готово: сверху в ТТК разделы по листам. Цветовые статусы сохранены на карточках.');console.log('Резервная копия: '+backup);
}catch(error){console.error(error.message);process.exitCode=1;}
