import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// بناء الموقع: نسخ ملفات واضحة كما هي، دون تجميع أو ضغط الكود.
const files=['index.html','styles.css','app.js','state.js','missions.js','manifest.webmanifest'];
await fs.mkdir('dist',{recursive:true});
for(const name of files)await fs.copyFile(name,path.join('dist',name));
await fs.cp('assets','dist/assets',{recursive:true});
const contents=await Promise.all(files.map(file=>fs.readFile(file)));
contents.push(await fs.readFile('assets/fonts.css'));
const version=crypto.createHash('sha256').update(Buffer.concat(contents)).digest('hex').slice(0,12);
await fs.writeFile('dist/sw.js',(await fs.readFile('sw.js','utf8')).replace('__VERSION__',version));
await fs.writeFile('dist/.nojekyll','');

// ملف واحد يُفتح بالنقر المزدوج دون خادم أو إنترنت.
let html=await fs.readFile('index.html','utf8');
html=html.replace('<html lang="ar"','<html data-standalone lang="ar"');
html=html.replace(/<link rel="(?:manifest|apple-touch-icon|icon)"[^>]*>/g,'');
for(const stylesheet of ['assets/fonts.css','styles.css']) {
  let css=await fs.readFile(stylesheet,'utf8');
  const image=await fs.readFile('assets/icon.svg');
  css=css.replaceAll("url('assets/icon.svg')",`url('data:image/svg+xml;base64,${image.toString('base64')}')`);
  html=html.replace(`<link rel="stylesheet" href="${stylesheet}">`,`<style>${css}</style>`);
}
let javascript='';
for(const filename of ['missions.js','state.js','app.js']) {
  let code=await fs.readFile(filename,'utf8');
  code=code.replace(/^import .*from ['"].*['"];?\r?\n/gm,'').replace(/^export /gm,'');
  javascript+=code+'\n';
}
for(const filename of ['assets/hero.svg','assets/icon.svg']) {
  const uri='data:image/svg+xml;base64,'+(await fs.readFile(filename)).toString('base64');
  html=html.replaceAll(filename,uri);
  javascript=javascript.replaceAll(filename,uri);
}
const license=await fs.readFile('assets/FONT-LICENSE.txt','utf8');
html=html.replace('<head>',`<!-- IBM Plex font license\n${license}\n--><head>`);
html=html.replace('<script type="module" src="app.js"></script>',`<script type="module">${javascript.replace(/<\/script/gi,'<\\/script')}</script>`);
await fs.mkdir('standalone',{recursive:true});
await fs.writeFile('standalone/المنقذ الرقمي.html',html);
console.log('Built website + standalone HTML. Version: '+version);
