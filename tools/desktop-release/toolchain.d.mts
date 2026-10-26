export function npmVersionFromUserAgent(userAgent?: string): string | undefined;
export function toolchainMismatch(expected: {node: string},actual: {node?:string,npm?:string}): string|null;
