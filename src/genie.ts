import { GENIE_DURATION, canonicalProgress, clamp, meshPositions, usable, type Rect } from './motion';

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('Shader compilation failed'); }
  return s;
}
export function prepareGenie(canvas: HTMLCanvasElement, image: HTMLImageElement, source: Rect, target: Rect) {
  if (!usable(source, target)) throw new Error('Overlapping Genie geometry');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl || gl.isContextLost()) throw new Error('WebGL unavailable');
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
  const rows = clamp(Math.ceil(source.height * ratio / 5) + 1, 64, 160);
  const program = gl.createProgram()!;
  const vs = shader(gl, gl.VERTEX_SHADER, `attribute vec2 a_position; attribute vec2 a_uv; uniform vec2 u_size; varying vec2 v_uv; void main(){ vec2 p=a_position/u_size*2.0-1.0; gl_Position=vec4(p.x,-p.y,0,1); v_uv=a_uv; }`);
  const fs = shader(gl, gl.FRAGMENT_SHADER, `precision mediump float; varying vec2 v_uv; uniform sampler2D u_image; void main(){gl_FragColor=texture2D(u_image,v_uv);}`);
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
  gl.useProgram(program); gl.uniform2f(gl.getUniformLocation(program, 'u_size'), innerWidth, innerHeight);
  const position = gl.createBuffer()!, uv = gl.createBuffer()!, index = gl.createBuffer()!;
  const positions = new Float32Array(rows * 4), uvs = new Float32Array(rows * 4), indices = new Uint16Array((rows - 1) * 6);
  for (let row = 0; row < rows; row++) {
    uvs.set([0, row / (rows - 1), 1, row / (rows - 1)], row * 4);
    if (row < rows - 1) { const a = row * 2; indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], row * 6); }
  }
  function attribute(name: string, buffer: WebGLBuffer, data: Float32Array, mode: number) {
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer); gl!.bufferData(gl!.ARRAY_BUFFER, data, mode);
    const location = gl!.getAttribLocation(program, name); gl!.enableVertexAttribArray(location); gl!.vertexAttribPointer(location, 2, gl!.FLOAT, false, 0, 0);
  }
  attribute('a_position', position, positions, gl.DYNAMIC_DRAW); attribute('a_uv', uv, uvs, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.viewport(0, 0, canvas.width, canvas.height);
  let request = 0, finish: (() => void) | undefined, disposed = false;
  function draw(t: number) {
    if (gl!.isContextLost()) throw new Error('WebGL context lost');
    meshPositions(source, target, t, rows, positions);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, position); gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, positions);
    gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);
  }
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(request);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.deleteTexture(texture); [position, uv, index].forEach(b => gl!.deleteBuffer(b));
    gl!.deleteProgram(program); gl!.deleteShader(vs); gl!.deleteShader(fs);
    if (window.motionStats) window.motionStats.active = false;
    finish?.();
  }
  return {
    draw,
    play(minimizing: boolean) {
      window.motionStats = { frames: 0, intervals: [], renderer: String(gl.getParameter(gl.RENDERER)), direction: minimizing ? 'minimize' : 'restore', active: true };
      return new Promise<void>(resolve => {
        finish = resolve; let start: number | undefined, last = 0;
        const tick = (now: number) => {
          if (disposed) return;
          start ??= now;
          const t = clamp((now - start) / GENIE_DURATION);
          const stats = window.motionStats!; stats.frames++; if (last) stats.intervals.push(now - last); last = now;
          try { draw(canonicalProgress(t, minimizing)); } catch { dispose(); return; }
          if (t < 1) request = requestAnimationFrame(tick); else resolve();
        };
        request = requestAnimationFrame(tick);
      });
    },
    dispose,
  };
}
