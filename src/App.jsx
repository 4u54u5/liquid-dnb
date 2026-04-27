import{useState,useEffect,useRef}from"react";
const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const sn=(r,s)=>NOTES[(NOTES.indexOf(r)+s)%12]||r;
const KEY_MIDI={C:48,'C#':49,D:50,'D#':51,E:52,F:53,'F#':54,G:55,'G#':56,A:57,'A#':58,B:59};
const SCALE={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10]};
const CDEFS={'i-VII-VI-VII':[[0,'m7'],[6,'M7'],[5,'M7'],[6,'M7']],'i-iv-VII-i':[[0,'m7'],[3,'m7'],[6,'M7'],[0,'m7']],'i-VI-III-VII':[[0,'m7'],[5,'M7'],[2,'m7'],[6,'M7']],'i-v-iv-VII':[[0,'m7'],[4,'m7'],[3,'m7'],[6,'M7']],'II-V-I-VI':[[1,'m7'],[4,'d7'],[0,'M7'],[5,'m7']],'I-V-vi-IV':[[0,'M7'],[4,'M7'],[5,'m7'],[3,'M7']]};
const CSHAPE={m7:[0,3,7,10],M7:[0,4,7,11],d7:[0,4,7,10]};
function vl(n){if(n<128)return[n];const b=[];b.unshift(n&127);n>>=7;while(n>0){b.unshift((n&127)|128);n>>=7;}return b;}
function nOn(ch,n,v,d){return[...vl(d),144|ch,n&127,v&127];}
function nOf(ch,n,d){return[...vl(d),128|ch,n&127,0];}
function u32(n){return[(n>>24)&255,(n>>16)&255,(n>>8)&255,n&255];}
function u16(n){return[(n>>8)&255,n&255];}
function midiFile(tracks,bpm=174,ppq=480){
  const hdr=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,...u16(tracks.length),...u16(ppq)];
  const us=Math.round(60000000/bpm);
  const tempo=[0,255,81,3,(us>>16)&255,(us>>8)&255,us&255];
  const eot=[0,255,47,0];
  const chunks=tracks.map((e,i)=>{const d=i===0?[...tempo,...e,...eot]:[...e,...eot];return[0x4d,0x54,0x72,0x6b,...u32(d.length),...d];});
  return new Uint8Array([...hdr,...chunks.flat()]);
}
function chordTrack(root,mode,ck,ppq=480){
  const sc=SCALE[mode].map(i=>root+i);const chords=CDEFS[ck]||CDEFS['i-VII-VI-VII'];const bar=ppq*4;const e=[];e.push(0,0xC0,4);
  for(let lp=0;lp<2;lp++)chords.forEach(([deg,tp])=>{const notes=CSHAPE[tp].map(i=>sc[deg%7]+i+12);notes.forEach((n,i)=>e.push(...nOn(0,n,i?62:72,0)));const off=Math.round(bar*.88);notes.forEach((n,i)=>e.push(...nOf(0,n,i?0:off)));e.push(...vl(bar-off));});
  return e;
}
function bassTrack(root,mode,ck,ppq=480){
  const sc=SCALE[mode].map(i=>root+i);const chords=CDEFS[ck]||CDEFS['i-VII-VI-VII'];const bar=ppq*4;const e=[];e.push(0,0xC1,32);
  const bp=[0,Math.round(ppq*1.5),Math.round(ppq*.75),Math.round(ppq*.75)];const dp=[Math.round(ppq*1.4),Math.round(ppq*.65),Math.round(ppq*.65),Math.round(ppq*.9)];
  for(let lp=0;lp<2;lp++)chords.forEach(([deg])=>{const rn=sc[deg%7]-12;let el=0;bp.forEach((delta,bi)=>{e.push(...nOn(1,rn,80,bi===0&&el===0?0:delta));e.push(...nOf(1,rn,dp[bi]));el+=delta+dp[bi];});const rem=bar-el;if(rem>0)e.push(...vl(rem));});
  return e;
}
function drumTrack(ppq=480){
  const e=[];e.push(0,0xC9,0);const t=Math.round(ppq/4);
  const pat=[[1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[0,0,0,0,0,0,1,0,0,0,0,1,0,0,1,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1]];
  const dn=[36,38,37,42,46],dv=[100,95,50,60,75];
  for(let bar=0;bar<8;bar++){
    const all=[];
    for(let s=0;s<16;s++)pat.forEach((row,ri)=>{if(row[s]){all.push({t:s*t,tp:'on',n:dn[ri],v:dv[ri]});all.push({t:s*t+Math.round(t*.7),tp:'off',n:dn[ri]});}});
    all.sort((a,b)=>a.t-b.t||(a.tp==='off'?-1:1));
    let prev=0;all.forEach(ev=>{const d=ev.t-prev;ev.tp==='on'?e.push(...nOn(9,ev.n,ev.v,d)):e.push(...nOf(9,ev.n,d));prev=ev.t;});
    const rem=16*t-prev;if(rem>0)e.push(...vl(rem));
  }
  return e;
}
function dlMidi(bytes,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'audio/midi'}));a.download=name;a.click();}

const SCENES={
  highway:{label:'夜の高速',mood:'nocturnal highway drive, city lights, late night cruise',base:'deep liquid dnb, smooth rolling bassline, jazz chords',extra:'warm reverb on snare',struct:[{t:'intro',l:'INTRO',b:'8bars'},{t:'build',l:'BUILD',b:'8bars'},{t:'drop',l:'DROP A',b:'32bars'},{t:'break',l:'BREAKDOWN',b:'16bars'},{t:'build',l:'BUILD 2',b:'8bars'},{t:'drop',l:'DROP B',b:'32bars'},{t:'outro',l:'OUTRO',b:'8bars'}]},
  mountain:{label:'夜明け山道',mood:'pre-dawn mountain road, misty forest, solitude',base:'ambient liquid dnb, ethereal pads, sparse piano',extra:'long reverb tails, near silence',struct:[{t:'intro',l:'INTRO',b:'16bars'},{t:'build',l:'BUILD',b:'8bars'},{t:'drop',l:'DROP A',b:'24bars'},{t:'break',l:'DEEP BREAK',b:'16bars'},{t:'drop',l:'DROP B',b:'24bars'},{t:'outro',l:'FADE',b:'16bars'}]},
  dawn:{label:'夜明け平野',mood:'early dawn, open plains, golden horizon, hopeful',base:'melodic liquid dnb, warm piano, gentle strings',extra:'bright highs, airy mix',struct:[{t:'intro',l:'INTRO',b:'8bars'},{t:'build',l:'BUILD',b:'8bars'},{t:'drop',l:'DROP A',b:'32bars'},{t:'break',l:'BREAKDOWN',b:'8bars'},{t:'build',l:'BUILD 2',b:'8bars'},{t:'drop',l:'DROP B VAR',b:'32bars'},{t:'outro',l:'RISE',b:'8bars'}]},
};
const REFS={paulsg:'Paul SG style, Song of a Bird, organic textures, acoustic warmth',calibre:'Calibre style, introspective, jazzy breakbeats',bukem:'LTJ Bukem style, Good Looking Records, ambient jungle',bungle:'Bungle style, melodic amen breaks, euphoric drops'};
const CHORDS={'i-VII-VI-VII':{l:'i–♭VII–♭VI–♭VII',d:'aeolian floating loop, nocturnal, unresolved'},'i-iv-VII-i':{l:'i–iv–♭VII–i',d:'minor cadence, introspective, gentle resolution'},'i-VI-III-VII':{l:'i–♭VI–♭III–♭VII',d:'epic minor, cinematic, expansive'},'i-v-iv-VII':{l:'i–v–iv–♭VII',d:'deep liquid minor, melancholic, Calibre'},'II-V-I-VI':{l:'IIm7–V7–Imaj7–VIm7',d:'jazz ii-V-I, warm, sophisticated'},'I-V-vi-IV':{l:'I–V–vi–IV',d:'major loop, hopeful, dawn feeling'}};
const CSEC={'i-VII-VI-VII':{intro:'i (tonic)',build:'i→♭VII',drop:'i→♭VII→♭VI→♭VII',break:'♭VI→♭VII',outro:'i resolve'},'i-iv-VII-i':{intro:'i',build:'i→iv',drop:'i→iv→♭VII→i',break:'iv open',outro:'♭VII→i'},'i-VI-III-VII':{intro:'i expansive',build:'i→♭VI',drop:'i→♭VI→♭III→♭VII',break:'♭III→♭VII',outro:'i resolve'},'i-v-iv-VII':{intro:'i',build:'i→v',drop:'i→v→iv→♭VII',break:'iv→♭VII',outro:'i resolve'},'II-V-I-VI':{intro:'Imaj7',build:'IIm7→V7',drop:'IIm7→V7→Imaj7→VIm7',break:'Imaj7 warm',outro:'VIm7→Imaj7'},'I-V-vi-IV':{intro:'I major',build:'I→V',drop:'I→V→vi→IV',break:'vi→IV reflective',outro:'I bright'}};
const INSTRS={rhodes:{s:'Rhodes electric piano, warm electric keys',drop:'Rhodes chords',break:'solo Rhodes',intro:'Rhodes pad'},upright:{s:'acoustic upright bass, pizzicato',drop:'upright walking',break:'solo upright',intro:'upright note'},brushkit:{s:'jazz brush drum kit, brush snare',drop:'brush breakbeat',break:'brush half-time',intro:'brush hi-hat'},vibraphone:{s:'warm vibraphone, soft mallets',drop:'vibraphone melody',break:'solo vibraphone',intro:'vibraphone shimmer'},flugelhorn:{s:'muted flugelhorn',drop:'flugelhorn phrase',break:'solo flugelhorn',intro:'distant flugelhorn'},strings:{s:'warm chamber strings, legato',drop:'string pad',break:'string swell',intro:'string fade-in'},wurlitzer:{s:'Wurlitzer electric piano, tremolo',drop:'Wurlitzer comping',break:'solo Wurlitzer',intro:'Wurlitzer pad'},synth_bass:{s:'warm Moog synth bass',drop:'Moog bass groove',break:'Moog pulse',intro:'Moog sub tone'}};
const SDESC={intro:{highway:'[pad texture only, no beat]',mountain:'[silence, single piano note]',dawn:'[first light, soft chord swell]'},build:{highway:'[hi-hat entering, bass pulse]',mountain:'[kick faint, mist clearing]',dawn:'[rhythm awakens, strings rise]'},drop:{highway:'[full liquid groove, rolling bass]',mountain:'[breakbeat through forest]',dawn:'[open melodic drop, expansive]'},break:{highway:'[beat strips back, city lights receding]',mountain:'[near silence, one chord held]',dawn:'[pause at hill crest, horizon visible]'},outro:{highway:'[elements fading, streetlights slower]',mountain:'[dissolve into birdsong]',dawn:'[held chord into silence]'}};
const EXCL='no vocals, no singing, no rap, no harsh distortion, no neurofunk, no dubstep wobble, no EDM buildup, no compression pumping, no muddy low-mid, no over-reverb, no over-compression';

function buildOutputs({scene,dark,jazz,amb,clar,bpm,refs,instrs,key,mode,chord}){
  const S=SCENES[scene],C=CHORDS[chord];
  const refKw=[...refs].map(r=>REFS[r]).join(', ');
  const instrW=[...instrs].map(k=>INSTRS[k]?.s).filter(Boolean).join(', ');
  const darkW=dark>70?'dark, melancholic, introspective':dark>40?'moody, contemplative':'peaceful, serene';
  const jazzW=jazz>70?'heavy jazz, swing feel, organic drums':jazz>40?'jazz-inflected, organic':'subtle jazz touch';
  const ambW=amb>70?'vast reverb, dreamlike space':amb>40?'spacious mix, room reverb':'dry intimate mix';
  const clarW=clar>75?'crystal clear mix, transparent production, pristine highs, clean separation, crisp transients':clar>50?'clean mix, clear high end, good separation':'warm dense mix';
  const style=[`liquid drum and bass, ${bpm}bpm`,`key of ${key} ${mode}`,`${C.l} chord loop`,instrW,S.base,darkW,jazzW,ambW,clarW,S.extra,S.mood,refKw,'no vocals, instrumental, amen breakbeat, high fidelity'].filter(Boolean).join(', ');
  const sC=CSEC[chord]||{};
  const header=`[Key: ${key} ${mode} | ${C.l}]\n[${C.d}]`;
  const tags=header+'\n\n'+S.struct.map(sec=>{
    const desc=(SDESC[sec.t]||{})[scene]||`[${sec.t}]`;
    const ch=sC[sec.t]?`[chords: ${sC[sec.t]}]`:'';
    const ih=[...instrs].map(k=>INSTRS[k]?.[sec.t]).filter(Boolean);
    const iht=ih.length?`[instruments: ${ih.join(', ')}]`:'';
    return[`[${sec.l}]`,desc,ch,iht].filter(Boolean).join('\n');
  }).join('\n\n');
  const excl=EXCL+(dark<30?', no dark chords':'')+(jazz<30?', no jazz':'')+(clar>70?', no reverb wash, no dense layering':'');
  return{style,tags,excl,C,S};
}

function buildAiOutput({scene,dark,jazz,amb,clar,bpm,refs,instrs,key,mode,chord,C,S}){
  const N='\n',SEP='━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const instrList=[...instrs].map(k=>INSTRS[k]?.s).filter(Boolean);
  const refList=[...refs].map(r=>REFS[r]);
  const moodCore=dark>70?'dark, melancholic':dark>40?'moody, late night':'peaceful, serene';
  const jazzCore=jazz>70?'heavy jazz, swing':jazz>40?'jazz-inflected':'subtle jazz';
  const ambCore=amb>70?'vast reverb, dreamlike':amb>40?'spacious reverb':'dry intimate';
  const mixCore=clar>75?'transparent mix, pristine highs, audiophile quality':clar>50?'clean mix, clear highs':'warm dense mix';
  const sceneKw={highway:'nocturnal drive, city lights',mountain:'misty forest, pre-dawn',dawn:'golden horizon, open plains, hopeful'}[scene];
  const optStyle=['liquid drum and bass',bpm+'bpm',`key of ${key} ${mode}`,C.l+' chord loop',instrList.slice(0,2).join(', '),mixCore,moodCore,jazzCore,ambCore,sceneKw,refList.slice(0,1).map(r=>r.split(',')[0]).join(''),'no vocals, instrumental, amen breakbeat, high fidelity'].filter(Boolean).join(', ');
  const cc=optStyle.length;
  const ccNote=(cc>900?'⚠ '+cc+'文字 (900文字超)':'✓ '+cc+'文字 (900文字以内)');

  const vLines=[`【ボイシング - ${key} ${mode}】`];
  if(chord==='i-VII-VI-VII'){
    vLines.push(`  • ${key}m7 = ${key}-${sn(key,3)}-${sn(key,7)}-${sn(key,10)}`);
    vLines.push(`  • ♭VII maj7 = ${sn(key,10)}-${sn(key,14)}-${sn(key,17)}-${sn(key,21)}`);
    vLines.push(`  • ♭VI maj7 = ${sn(key,8)}-${sn(key,12)}-${sn(key,15)}-${sn(key,19)}`);
    vLines.push(`  テンション: 9th(${sn(key,2)})追加で浮遊感。♭VIIにsus4でさらに未解決。`);
    vLines.push('  Liquid Tip: C4〜C5域でボイシング → Rhodesの倍音が前に出る');
  } else if(chord==='II-V-I-VI'){
    vLines.push(`  • IIm7=${sn(key,2)}m7, V7=${sn(key,7)}7(♭9), Imaj7=${key}maj7, VIm7=${sn(key,9)}m7`);
    vLines.push('  Liquid Tip: Imaj7のルートはベースに任せ上3声のみRhodesで');
  } else {
    vLines.push(`  • 全コードmin7/maj7の4声、ルートはベースへ`);
    vLines.push(`  • 9th(${sn(key,2)})をカラーノートに追加するとLiquid感増`);
    vLines.push('  Liquid Tip: C4-C5域でボイシング → Rhodesの倍音が際立つ');
  }

  const bPat=['【Amenスケルトン (ベース)】','Step:1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16','K:   K  .  .  K  .  .  .  K  .  .  K  .  .  K  .  .','S:   .  .  .  .  S  .  .  .  .  .  .  .  S  .  .  .','G:   .  .  .  .  .  .  G  .  .  .  .  G  .  .  G  .','H:   H  .  H  .  H  .  H  .  H  .  H  .  H  .  H  .','O:   .  .  .  .  .  .  .  .  .  O  .  .  .  .  .  O'];
  const vPat={
    highway:['','【夜の高速バリエーション】','K:   K  .  .  .  .  .  .  K  K  .  .  .  .  K  .  .  ←9拍目先行','S:   .  .  .  .  S  .  .  .  .  .  .  .  S  .  .  S  ←16拍目予告','H:   H  .  H  H  H  .  H  .  H  .  H  H  H  .  H  .  ←3-4連ハット','※BREAKDOWN: Kickゼロ、HH+Ghost+Open Hatのみ'],
    mountain:['','【山道バリエーション】','K:   K  .  .  .  .  .  .  .  .  .  K  .  .  .  .  .  ←Kick大幅削減','H:   H  .  .  .  H  .  .  .  H  .  .  .  H  .  .  .  ←余白最大化','G:   .  .  G  .  .  .  .  G  .  .  .  G  .  .  .  .  ←3拍系Ghost'],
    dawn:['','【夜明けバリエーション】','K:   K  .  .  K  .  .  K  .  K  .  .  K  .  .  K  .  ←Kick多め','H:   H  H  H  .  H  H  H  .  H  H  H  .  H  H  H  .  ←3連ハット','G:   .  G  .  G  .  G  .  .  .  G  .  G  .  G  .  .  ←Ghost密に'],
  };
  const drumOut=[...bPat,...(vPat[scene]||vPat.highway)].join(N);

  const sC=CSEC[chord]||{};
  const lyricBlocks=S.struct.map(sec=>{
    const chTag=sC[sec.t]?`[chords: ${sC[sec.t]}]`:'';
    const ih=[...instrs].map(k=>INSTRS[k]?.[sec.t]).filter(Boolean);
    const mTag={intro:`[${moodCore}, sparse]`,build:`[tension, ${jazzCore}]`,drop:`[full groove, ${C.l}]`,break:`[stripped, ${ambCore}]`,outro:'[dissolving, peaceful]'}[sec.t]||'';
    return[`[${sec.l}]`,mTag,chTag,ih.length?`[instruments: ${ih.join(', ')}]`:''].filter(Boolean).join(N);
  });

  return[SEP,'1. OPTIMIZED STYLE PROMPT',SEP,optStyle,'',ccNote,'',SEP,'2. CHORD VOICING HINTS',SEP,vLines.join(N),'',SEP,'3. DRUM PATTERN VARIATION',SEP,drumOut,'',SEP,'4. SUNO LYRICS FIELD (OPTIMIZED)',SEP,`[Key: ${key} ${mode} | ${C.l}]`,'['+C.d+']','',lyricBlocks.join(N+N)].join(N);
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{--ni:#080c12;--pa:#111a28;--bo:#1e2e42;--gl:#3a7bd5;--g2:#00c9a7;--tx:#c8d8e8;--dm:#5a7090;--ac:#7eb8f7;--wa:#f0c070;}
body{background:var(--ni);color:var(--tx);font-family:'DM Mono',monospace;min-height:100vh;}
.w{max-width:680px;margin:0 auto;padding:40px 20px 80px;}
h1{font-family:'DM Serif Display',serif;font-style:italic;font-size:clamp(24px,5vw,38px);color:var(--ac);text-align:center;margin-bottom:6px;text-shadow:0 0 40px rgba(126,184,247,.3);}
.sub{text-align:center;font-size:10px;color:var(--dm);letter-spacing:3px;text-transform:uppercase;margin-bottom:40px;}
.sl{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--dm);margin-bottom:8px;}
.ssl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--dm);opacity:.6;margin:12px 0 7px;}
hr{border:none;border-top:1px solid var(--bo);margin:24px 0;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:28px;}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-bottom:20px;}
.g6{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:10px;}
.btn{background:transparent;border:1px solid var(--bo);color:var(--dm);padding:9px 6px;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;text-align:center;transition:all .15s;line-height:1.4;}
.btn:hover{border-color:var(--gl);color:var(--tx);}
.on{background:rgba(58,123,213,.12);border-color:var(--gl)!important;color:var(--ac)!important;}
.ong{background:rgba(0,201,167,.08);border-color:var(--g2)!important;color:var(--g2)!important;}
.onw{background:rgba(240,192,112,.1);border-color:var(--wa)!important;color:var(--wa)!important;}
.onp{background:rgba(167,139,250,.1);border-color:#a78bfa!important;color:#c4b5fd!important;}
.si{display:block;font-size:17px;margin-bottom:4px;}
.pr{margin-bottom:18px;}
.ph{display:flex;justify-content:space-between;margin-bottom:7px;}
.pn{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--dm);}
.pv{font-size:12px;color:var(--ac);}
input[type=range]{width:100%;appearance:none;height:2px;background:var(--bo);cursor:pointer;}
input[type=range]::-webkit-slider-thumb{appearance:none;width:13px;height:13px;border-radius:50%;background:var(--gl);cursor:pointer;}
.cb{display:flex;flex-direction:column;gap:4px;margin-bottom:20px;}
.cbt{background:transparent;border:1px solid var(--bo);color:var(--dm);padding:9px 12px;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;text-align:left;transition:all .15s;display:flex;justify-content:space-between;align-items:center;}
.cbt:hover{border-color:var(--wa);color:var(--tx);}
.cr{font-size:9px;opacity:.45;}
.cf{font-size:9px;color:var(--dm);display:block;margin-top:2px;}
.ait{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;background:var(--pa);border:1px solid var(--bo);margin-bottom:20px;cursor:pointer;transition:border-color .2s;}
.ait.on{border-color:#a78bfa;}
.aitl{display:flex;flex-direction:column;gap:3px;}
.aitt{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--dm);}
.ait.on .aitt{color:#c4b5fd;}
.aitd{font-size:9px;color:var(--dm);opacity:.6;}
.sw{width:38px;height:20px;background:var(--bo);border-radius:10px;position:relative;transition:background .2s;}
.ait.on .sw{background:#7c3aed;}
.kn{position:absolute;top:2px;left:2px;width:16px;height:16px;background:white;border-radius:50%;transition:transform .2s;}
.ait.on .kn{transform:translateX(18px);}
.gb{width:100%;padding:16px;background:transparent;border:1px solid var(--gl);color:var(--ac);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:4px;text-transform:uppercase;cursor:pointer;margin-bottom:20px;transition:all .3s;}
.gb:hover{background:rgba(58,123,213,.08);}
.gb:disabled{opacity:.4;cursor:not-allowed;}
.ob{background:var(--pa);border:1px solid var(--bo);margin-bottom:10px;}
.oh{padding:9px 14px;border-bottom:1px solid var(--bo);font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--dm);display:flex;justify-content:space-between;align-items:center;}
.ot{padding:14px;font-size:11px;line-height:1.8;white-space:pre-wrap;word-break:break-word;}
.cpb{background:transparent;border:1px solid var(--bo);color:var(--dm);padding:3px 9px;font-family:'DM Mono',monospace;font-size:9px;cursor:pointer;}
.cpb:hover{border-color:var(--g2);color:var(--g2);}
.sv{display:flex;gap:3px;padding:14px;overflow-x:auto;}
.sb{flex-shrink:0;padding:7px 9px;font-size:9px;text-align:center;line-height:1.3;}
.sbb{display:block;font-size:8px;opacity:.55;margin-top:2px;}
.sb.intro{background:rgba(58,123,213,.12);border:1px solid rgba(58,123,213,.25);color:#7eb8f7;}
.sb.build{background:rgba(126,184,247,.08);border:1px solid rgba(126,184,247,.18);color:#a0c8f0;}
.sb.drop{background:rgba(0,201,167,.12);border:1px solid rgba(0,201,167,.25);color:#00c9a7;}
.sb.break{background:rgba(240,192,112,.08);border:1px solid rgba(240,192,112,.18);color:#f0c070;}
.sb.outro{background:rgba(58,123,213,.05);border:1px solid rgba(58,123,213,.12);color:#5a7090;}
.aiob{background:var(--pa);border:1px solid #2d1f5a;margin-bottom:10px;}
.aioh{padding:9px 14px;background:rgba(124,58,237,.06);border-bottom:1px solid #2d1f5a;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#a78bfa;display:flex;justify-content:space-between;}
.aibg{font-size:8px;background:rgba(124,58,237,.2);color:#c4b5fd;padding:2px 6px;border:1px solid rgba(124,58,237,.3);}
.aisp{padding:18px 14px;font-size:11px;color:var(--dm);display:flex;align-items:center;gap:8px;}
@keyframes spin{to{transform:rotate(360deg)}}
.sp{width:12px;height:12px;border:2px solid #2d1f5a;border-top-color:#a78bfa;border-radius:50%;animation:spin .8s linear infinite;}
.aiot{padding:14px;font-size:11px;line-height:1.9;color:#d4c8f0;white-space:pre-wrap;word-break:break-word;}
.ma{padding:12px 14px;display:flex;flex-direction:column;gap:7px;}
.mr{display:flex;align-items:center;gap:8px;}
.mi{font-size:9px;color:var(--dm);flex:1;line-height:1.4;}
.mb{background:transparent;border:1px solid #2a3f5a;color:var(--ac);padding:9px 12px;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:130px;}
.mb:hover{border-color:var(--ac);}
.mbi{font-size:15px;}
.mbs{font-size:8px;opacity:.45;}
.mba{flex:1;min-width:unset;width:100%;border-color:rgba(0,201,167,.35);color:var(--g2);flex-direction:row;justify-content:center;gap:7px;padding:10px;}
.mba:hover{border-color:var(--g2);}
.ib{display:block;font-size:10px;margin-bottom:2px;}
.ia{display:block;font-size:9px;opacity:.45;}
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fi{animation:fu .35s ease;}
`;

export default function App(){
  const[scene,setScene]=useState('highway');
  const[dark,setDark]=useState(50);
  const[jazz,setJazz]=useState(60);
  const[amb,setAmb]=useState(70);
  const[clar,setClar]=useState(80);
  const[bpm,setBpm]=useState(174);
  const[refs,setRefs]=useState(new Set(['paulsg']));
  const[instrs,setInstrs]=useState(new Set(['rhodes','brushkit']));
  const[key,setKey]=useState('G');
  const[mode,setMode]=useState('minor');
  const[chord,setChord]=useState('i-VII-VI-VII');
  const[aiMode,setAiMode]=useState(false);
  const[gen,setGen]=useState(false);
  const[busy,setBusy]=useState(false);
  const[styleOut,setStyleOut]=useState('');
  const[tagsOut,setTagsOut]=useState('');
  const[exclOut,setExclOut]=useState('');
  const[aiOut,setAiOut]=useState('');
  const[aiLoad,setAiLoad]=useState(false);
  const[copied,setCopied]=useState({});
  const ref=useRef(null);

  useEffect(()=>{
    const el=document.createElement('style');
    el.textContent=CSS;document.head.appendChild(el);
    return()=>document.head.removeChild(el);
  },[]);

  const togRef=r=>setRefs(p=>{const n=new Set(p);if(n.has(r)&&n.size>1)n.delete(r);else n.add(r);return n;});
  const togInstr=k=>setInstrs(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n;});

  const go=()=>{
    setBusy(true);
    const p={scene,dark,jazz,amb,clar,bpm,refs,instrs,key,mode,chord};
    const{style,tags,excl,C,S}=buildOutputs(p);
    setStyleOut(style);setTagsOut(tags);setExclOut(excl);setGen(true);setBusy(false);
    if(aiMode){setAiLoad(true);setAiOut('');setTimeout(()=>{setAiOut(buildAiOutput({...p,C,S}));setAiLoad(false);},500);}
    else setAiOut('');
  };

  const cp=async(txt,id)=>{
    await navigator.clipboard.writeText(txt);
    setCopied(p=>({...p,[id]:true}));
    setTimeout(()=>setCopied(p=>({...p,[id]:false})),2000);
  };

  const exp=type=>{
    const r=KEY_MIDI[key]||55,ppq=480,fn=`liquid_dnb_${key}${mode}_${bpm}bpm`,m=[];
    const cT=chordTrack(r,mode,chord,ppq),bT=bassTrack(r,mode,chord,ppq),dT=drumTrack(ppq);
    if(type==='chords')dlMidi(midiFile([m,cT],bpm,ppq),fn+'_chords.mid');
    else if(type==='bass')dlMidi(midiFile([m,bT],bpm,ppq),fn+'_bass.mid');
    else if(type==='drums')dlMidi(midiFile([m,dT],bpm,ppq),fn+'_drums.mid');
    else{setTimeout(()=>dlMidi(midiFile([m,cT],bpm,ppq),fn+'_chords.mid'),0);setTimeout(()=>dlMidi(midiFile([m,bT],bpm,ppq),fn+'_bass.mid'),250);setTimeout(()=>dlMidi(midiFile([m,dT],bpm,ppq),fn+'_drums.mid'),500);}
  };

  const cLabel={'i-VII-VI-VII':'浮遊・夜道感 Paul SG','i-iv-VII-i':'内省・帰還感','i-VI-III-VII':'映画的・広大','i-v-iv-VII':'Calibre的・憂鬱','II-V-I-VI':'Jazz・温かいドライブ','I-V-vi-IV':'夜明け・希望感'};
  const cRoman={'i-VII-VI-VII':'Aeolian loop','i-iv-VII-i':'Minor cadence','i-VI-III-VII':'Epic minor','i-v-iv-VII':'Deep liquid','II-V-I-VI':'Jazz ii-V-I','I-V-vi-IV':'Maj loop'};

  return(
    <div style={{background:'#080c12',minHeight:'100vh'}}>
      <div className="w" ref={ref}>
        <h1>Liquid D&B<br/>Drive Generator</h1>
        <div className="sub">Paul SG / Calibre style · Suno Prompt</div>

        <div className="sl">// Scene</div>
        <div className="g3">
          {[['highway','🌉','夜の高速'],['mountain','🌫','夜明け山道'],['dawn','🌄','夜明け平野']].map(([s,ic,lb])=>(
            <button key={s} className={`btn${scene===s?' on':''}`} onClick={()=>setScene(s)}>
              <span className="si">{ic}</span>{lb}
            </button>
          ))}
        </div>
        <hr/>

        <div className="sl">// Parameters</div>
        {[['Darkness',dark,setDark],['Jazz Feel',jazz,setJazz],['Ambience',amb,setAmb],['Clarity',clar,setClar]].map(([nm,val,set])=>(
          <div key={nm} className="pr">
            <div className="ph"><span className="pn">{nm}</span><span className="pv">{val}</span></div>
            <input type="range" min="0" max="100" value={val} onChange={e=>set(+e.target.value)}/>
          </div>
        ))}
        <div className="pr">
          <div className="ph"><span className="pn">BPM</span><span className="pv">{bpm}</span></div>
          <input type="range" min="170" max="180" value={bpm} onChange={e=>setBpm(+e.target.value)}/>
        </div>
        <hr/>

        <div className="sl">// Reference Artist</div>
        <div className="g2">
          {[['paulsg','Paul SG'],['calibre','Calibre'],['bukem','LTJ Bukem'],['bungle','Bungle']].map(([r,lb])=>(
            <button key={r} className={`btn${refs.has(r)?' ong':''}`} style={{display:'flex',alignItems:'center',gap:7}} onClick={()=>togRef(r)}>
              <span style={{width:6,height:6,borderRadius:'50%',background:refs.has(r)?'#00c9a7':'#1e2e42',flexShrink:0,display:'inline-block'}}/>
              {lb}
            </button>
          ))}
        </div>
        <hr/>

        <div className="sl">// Instruments</div>
        <div className="g2">
          {[['rhodes','Rhodes','piano → Rhodes electric piano'],['upright','Upright Bass','bass → acoustic upright bass'],['brushkit','Brush Kit','drums → jazz brush drum kit'],['vibraphone','Vibraphone','mallets → warm vibraphone'],['flugelhorn','Flugelhorn','brass → muted flugelhorn'],['strings','String Pad','strings → chamber strings'],['wurlitzer','Wurlitzer','piano → Wurlitzer electric piano'],['synth_bass','Moog Bass','bass → warm Moog synth bass']].map(([k,nm,alt])=>(
            <button key={k} className={`btn${instrs.has(k)?' onp':''}`} style={{textAlign:'left'}} onClick={()=>togInstr(k)}>
              <span className="ib">{nm}</span><span className="ia">{alt}</span>
            </button>
          ))}
        </div>
        <hr/>

        <div className="sl">// Key & Chord</div>
        <div className="ssl">Root Key</div>
        <div className="g6">
          {NOTES.map(k=><button key={k} className={`btn${key===k?' onw':''}`} onClick={()=>setKey(k)}>{k}</button>)}
        </div>
        <div className="ssl">Mode</div>
        <div className="g3">
          {['minor','major','dorian'].map(m=><button key={m} className={`btn${mode===m?' onw':''}`} onClick={()=>setMode(m)} style={{textTransform:'capitalize'}}>{m}</button>)}
        </div>
        <div className="ssl">Chord Progression</div>
        <div className="cb">
          {Object.entries(CHORDS).map(([k,v])=>(
            <button key={k} className={`cbt${chord===k?' onw':''}`} onClick={()=>setChord(k)}>
              <span>{v.l}<span className="cf">{cLabel[k]}</span></span>
              <span className="cr">{cRoman[k]}</span>
            </button>
          ))}
        </div>
        <hr/>

        <div className={`ait${aiMode?' on':''}`} onClick={()=>setAiMode(p=>!p)}>
          <div className="aitl">
            <span className="aitt">✦ AI High Quality Mode</span>
            <span className="aitd">ボイシング・ドラムパターン・最適化プロンプトを生成</span>
          </div>
          <div className="sw"><div className="kn"/></div>
        </div>

        <button className="gb" disabled={busy||aiLoad} onClick={go}>
          {busy?'...':gen?'Regenerate':'Generate Prompt'}
        </button>

        {gen&&(
          <div className="fi">
            {aiMode&&(
              <div className="aiob">
                <div className="aioh"><span>AI Enhanced Output</span><span className="aibg">Local Engine</span></div>
                {aiLoad&&<div className="aisp"><div className="sp"/><span>生成中...</span></div>}
                {aiOut&&<div className="aiot">{aiOut}</div>}
              </div>
            )}
            <div className="ob">
              <div className="oh"><span>Structure</span></div>
              <div className="sv">
                {SCENES[scene].struct.map((s,i)=>(
                  <div key={i} className={`sb ${s.t}`}>{s.l}<span className="sbb">{s.b}</span></div>
                ))}
              </div>
            </div>
            {[['Style Prompt',styleOut,'sp'],['Lyrics / Structure Tags',tagsOut,'lt'],['Exclude Styles',exclOut,'ex']].map(([title,txt,id])=>(
              <div key={id} className="ob">
                <div className="oh"><span>{title}</span><button className="cpb" onClick={()=>cp(txt,id)}>{copied[id]?'Copied ✓':'Copy'}</button></div>
                <div className="ot">{txt}</div>
              </div>
            ))}
            <div className="ob">
              <div className="oh"><span>MIDI Export</span><span style={{fontSize:9,color:'#5a7090'}}>8-bar · {bpm}bpm</span></div>
              <div className="ma">
                {[['chords','♩','Chord MIDI','Rhodes voicing',`${key} ${mode} · ${CHORDS[chord].l}`],['bass','♪','Bass MIDI','Root pattern','syncopated walk'],['drums','◈','Drum MIDI','Amen skeleton','16th grid']].map(([t,ic,lb,sub,info])=>(
                  <div key={t} className="mr">
                    <div className="mi">{info}</div>
                    <button className="mb" onClick={()=>exp(t)}><span className="mbi">{ic}</span>{lb}<span className="mbs">{sub}</span></button>
                  </div>
                ))}
                <div className="mr" style={{marginTop:4}}>
                  <div className="mi"/>
                  <button className="mb mba" onClick={()=>exp('all')}>↓ Download All 3</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
