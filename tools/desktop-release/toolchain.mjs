// Narrowly scoped M15 Windows build contract: same Node runtime as hosted CI;
// accept npm 10.x in the existing lockfile ecosystem. No M20 release pin.
export function npmVersionFromUserAgent(userAgent){
 return String(userAgent??'').match(/(?:^|\s)npm\/(\d+\.\d+\.\d+)(?:\s|$)/)?.[1];
}
export function toolchainMismatch(expected,actual){
 const mismatches=[];
 if(actual.node!==expected.node)mismatches.push(`Node.js ${actual.node??'unknown'} (expected ${expected.node})`);
 if(!/^10\./.test(actual.npm??''))mismatches.push(`npm ${actual.npm??'unknown'} (expected npm 10.x for this M15 lockfile)`);
 return mismatches.length?`Unsupported M15 Windows validation toolchain: ${mismatches.join('; ')}.`:null;
}
