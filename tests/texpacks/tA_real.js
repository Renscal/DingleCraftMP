/* tA_real.js (Package A): the world shader patch against the REAL three r128 sources (assets/vendor/three.r128.min.js, the
   file the build inlines since Release 1.0). The browser checks cover the rest (shader compile on real r128, GPU-vs-JS
   rotation readback). Kept deliberately small: the game is booted on the stubs (hr_boot + stubs_A), and only the shader
   strings come from the real three. The minified r128 inlines GL enums as numbers (TEXTURE_2D_ARRAY = 35866). */
'use strict';
const real3=require('../lib/real3.js');
if(!real3.available()){console.log('SKIP tA_real (no vendored three r128)');console.log('0 passed, 0 failed');process.exit(0);}
const boot=require('../lib/hr_boot.js'),{ok}=boot,fs=require('fs');
const T3=real3.three();
const V=boot({stubs:['A'],assets:'fake'});
boot.run(async()=>{
  ok('real three is r128 with DataTexture2DArray',T3.REVISION==='128'&&typeof T3.DataTexture2DArray==='function');
  for(const lib of ['standard','physical']){const L=T3.ShaderLib[lib],sh={uniforms:{},vertexShader:L.vertexShader,fragmentShader:L.fragmentShader};
    let err='';try{V.hrWPatch(sh);}catch(e){err=e.message;}
    ok('hrWPatch applies to the real ShaderLib.'+lib+(err?' ('+err+')':''),!err);}
  /* 6.26: the block-light patch (world/p03e_light.js) against the real Lambert shader the OG world materials use, and the
     same pieces inside the Hyperreal patch against the real standard shader */
  {const L=T3.ShaderLib.lambert,sh={uniforms:{},vertexShader:L.vertexShader,fragmentShader:L.fragmentShader};
    V.blightObc(sh);
    const vs=sh.vertexShader,fr=sh.fragmentShader;
    ok('the block-light patch finds all four of its places in the real Lambert shader',vs.includes('attribute float blight;')&&vs.indexOf('vBl=blight;')>vs.indexOf('void main()')&&fr.includes('uniform vec3 uBlCol;')&&fr.indexOf('gl_FragColor.rgb+=diffuseColor.rgb*pow(max(vBl,0.0),1.6)*uBlCol;')>fr.indexOf('void main()'));
    ok('...where what it uses is already there: diffuseColor is declared and gl_FragColor set before it adds to them, and nothing else is called vBl or blight',fr.indexOf('vec4 diffuseColor')>0&&fr.indexOf('vec4 diffuseColor')<fr.indexOf('gl_FragColor.rgb+=')&&fr.indexOf('gl_FragColor = vec4( outgoingLight')<fr.indexOf('gl_FragColor.rgb+=')&&!/vBl|blight/.test(L.vertexShader+L.fragmentShader));
    const S=T3.ShaderLib.standard,hs={uniforms:{},vertexShader:S.vertexShader,fragmentShader:S.fragmentShader};V.hrWPatch(hs);
    ok('the Hyperreal patch carries the same light: the attribute in, and the glow added to the emissive light inside main',hs.vertexShader.includes('attribute float blight;')&&hs.vertexShader.includes('vBl=blight;')&&hs.fragmentShader.includes('uniform vec3 uBlCol;')&&hs.fragmentShader.indexOf('totalEmissiveRadiance+=diffuseColor.rgb*pow(max(vBl,0.0),1.6)*uBlCol;')>hs.fragmentShader.indexOf('vec3 totalEmissiveRadiance'));}
  const D=T3.ShaderLib.depth,ds={uniforms:{},vertexShader:D.vertexShader,fragmentShader:D.fragmentShader};
  let err='';try{V.hrWPatchDepth(ds);}catch(e){err=e.message;}
  ok('hrWPatchDepth applies to the real ShaderLib.depth'+(err?' ('+err+')':''),!err);
  const stub=THREE.ShaderChunk;THREE.ShaderChunk=T3.ShaderChunk;
  let P='';try{P=V.hrWPerturbSrc(true);}catch(e){err=e.message;}finally{THREE.ShaderChunk=stub;V.hrWPerturbSrc(true);}
  ok('perturbNormal2Arb extracts from the real normalmap_pars_fragment',/vec3 hrPerturb\(/.test(P)&&!P.includes('vUv')&&/faceDirection/.test(P));
  const src=fs.readFileSync(real3.VENDOR,'utf8');
  ok('r128 uploads 2D-array textures and generates their mipmaps (TEXTURE_2D_ARRAY 35866 + generateMipmap)',(src.includes('TEXTURE_2D_ARRAY')||/\b35866\b/.test(src))&&src.includes('generateMipmap'));
  ok('r128 binds sampler2DArray uniforms (SAMPLER_2D_ARRAY 36289 / setValueT2DArray1)',src.includes('setValueT2DArray1')||/\b36289\b/.test(src));
});
