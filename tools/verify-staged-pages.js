#!/usr/bin/env node
/* Assert every PWA offline resource was staged in GitHub Pages _site.
   Protects icons, branding and local CC0 food photos from missing-path deploys. */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const root=resolve(process.argv[2]??'_site')
const sw=readFileSync(resolve(root,'sw.js'),'utf8')
const list=sw.match(/const PRECACHE = \[([\s\S]*?)\]/)
if(!list)throw new Error('Missing service-worker precache definition')
const paths=[...list[1].matchAll(/'([^']+)'/g)].map(x=>x[1])
const missing=paths.filter(p=>!existsSync(resolve(root,p)))
if(missing.length) {
  console.error('Missing staged PWA files:',missing.join(', '))
  process.exit(1)
}
for(const asset of ['branding/lfms/logo-full.svg','branding/lfms/logo-mark.svg','branding/lfms/logo-wordmark.svg','art/food/chicken.jpg','icons/icon-512.png']){
  if(!existsSync(resolve(root,asset)))throw new Error('Missing release asset '+asset)
}
console.log('Verified '+paths.length+' offline assets in GitHub Pages stage')
