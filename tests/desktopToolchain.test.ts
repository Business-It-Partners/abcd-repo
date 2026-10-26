import {describe,expect,it} from 'vitest';
import {npmVersionFromUserAgent,toolchainMismatch} from '../tools/desktop-release/toolchain.mjs';
describe('M15 Windows build toolchain',()=>{
 const expected={node:'22.13.1'};
 it('accepts the pinned Node version and npm 10',()=>{
  expect(toolchainMismatch(expected,{node:'22.13.1',npm:'10.9.2'})).toBeNull();
 });
 it('rejects a different Node runtime and unsupported npm majors',()=>{
  const message=toolchainMismatch(expected,{node:'24.1.0',npm:'11.2.0'});
  expect(message).toContain('Node.js 24.1.0');
  expect(message).toContain('npm 11.2.0');
 });
 it('reads the npm lifecycle agent and rejects unrelated package managers',()=>{
  expect(npmVersionFromUserAgent('npm/10.9.2 node/v22.13.1 win32 x64')).toBe('10.9.2');
  expect(npmVersionFromUserAgent('yarn/4.0.0 node/v22.13.1')).toBeUndefined();
 });
});
