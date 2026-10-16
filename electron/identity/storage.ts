import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { staging } from '../sdk/environment';
export const adequateStorage = (platform:string,available:boolean,backend:string) => available && (platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(backend));
export interface SecretProvider { available(): boolean; encrypt(value:string):Promise<Buffer>; decrypt(value:Buffer):Promise<string> }
export class CredentialStore {
  private file:string;
  constructor(private dir:string,private provider:SecretProvider){this.file=path.join(dir,'refresh.enc');}
  available(){try{return this.provider.available();}catch{return false;}}
  private async directory(){
    await fs.mkdir(this.dir,{recursive:true,mode:0o700});const s=await fs.lstat(this.dir);
    if(!s.isDirectory()||s.isSymbolicLink()||(process.platform!=='win32'&&(s.mode&0o077)!==0))throw new Error('Unsafe credential directory');
  }
  private async inspect(){
    try{const s=await fs.lstat(this.file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>32_768||(process.platform!=='win32'&&(s.mode&0o077)!==0))throw new Error('Unsafe credential file');return true;}
    catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}
  }
  async load():Promise<string|null>{
    if(!this.available())return null;await this.directory();if(!await this.inspect())return null;
    const handle=await fs.open(this.file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
    try{const s=await handle.stat();if(!s.isFile()||s.nlink!==1||s.size>32_768)throw new Error('Unsafe credential file');
      const value=JSON.parse(await this.provider.decrypt(await handle.readFile()));
      if(value.version!==1||value.project!==staging.firebaseProject||typeof value.refreshToken!=='string'||!value.refreshToken||value.refreshToken.length>16_384)throw new Error('Invalid protected credential');return value.refreshToken;
    }finally{await handle.close();}
  }
  async save(refreshToken:string){
    if(!this.available())throw new Error('Protected storage unavailable');await this.directory();await this.inspect();
    const encrypted=await this.provider.encrypt(JSON.stringify({version:1,project:staging.firebaseProject,refreshToken}));
    if(!encrypted.length||encrypted.length>32_768)throw new Error('Invalid encrypted record');
    const temporary=path.join(this.dir,`.refresh-${randomUUID()}.tmp`);let handle;
    try{handle=await fs.open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600);await handle.writeFile(encrypted);await handle.sync();await handle.close();handle=undefined;await this.inspect();await fs.rename(temporary,this.file);}
    finally{await handle?.close();await fs.rm(temporary,{force:true});}
  }
  async clear(){await this.directory();if(await this.inspect())await fs.unlink(this.file);}
}
