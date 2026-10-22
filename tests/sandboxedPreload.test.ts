import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
describe('Electron sandboxed preload compatibility',()=>{
  for(const file of ['electron/preload.ts','electron/runtime/appPreload.ts','electron/recoveryPreload.ts']){
    it(file+' imports no runtime relative module or Node filesystem dependency',()=>{
      const source=readFileSync(path.join(root,file),'utf8');
      const imports=[...source.matchAll(/^\s*import\s+(?!type\b)[^\n]*?\sfrom\s['"]([^'"]+)['"]/gm)].map(match=>match[1]);
      expect(imports).toEqual(imports.filter(name=>name==='electron'));
      expect(source).not.toMatch(/(?:^|\W)require\s*\(\s*['"]\./);
    });
  }
});
