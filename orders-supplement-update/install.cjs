const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),base=__dirname,hashes=require('./previous-hashes.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!fs.existsSync(path.join(root,'package.json')))throw Error('Запустите из папки проекта рядом с package.json');
const changes=[];
for(const [file,previous] of Object.entries(hashes)){
 const target=path.join(root,file),next=fs.readFileSync(path.join(base,'payload',file)),old=fs.existsSync(target)?fs.readFileSync(target):null;
 if(old&&hash(old)===hash(next))continue;
 if((old&&hash(old)!==previous)||(!old&&previous))throw Error('Файл отличается от установленного orders-update: '+file+'. Ничего не изменено. Пришлите текущий файл для объединения.');
 changes.push({file,target,next,old});
}
const backup=path.join(root,'orders-update-backups','supplement-'+Date.now());
for(const c of changes)if(c.old){const p=path.join(backup,c.file+'.bak');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c.old);}
try{for(const c of changes){fs.mkdirSync(path.dirname(c.target),{recursive:true});fs.writeFileSync(c.target,c.next);}}
catch(e){for(const c of changes){if(c.old)fs.writeFileSync(c.target,c.old);else if(fs.existsSync(c.target))fs.unlinkSync(c.target);}throw e;}
console.log(changes.length?'Обновление установлено. Резервная копия: '+backup:'Обновление уже установлено.');
