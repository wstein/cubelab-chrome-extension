/* Pure detection and URL construction, shared by content script, worker and tests. */
(function (root) {
  'use strict';
  const DEFAULTS = Object.freeze({enabled:true, disabledHosts:[], minMoves:3, sitePreferences:{}, lowercaseMode:"Wide", scheme:"Western",
    movesTemplate:'https://wstein.github.io/cubelab/workbench#moves={notation}',
    algTemplate:'https://wstein.github.io/cubelab/#alg={notation}'});
  const MAX = 2000;
  const normalize = s => s.replace(/[’‘′´`]/g,"'").replace(/²/g,'2').replace(/[·•]/g,' ')
    .replace(/\u00a0/g,' ');
  const moveRE = /^(?:[2-5]-[2-5][URFDLB]w|[2-5]?[URFDLB]w|[2-5][URFDLB]|[URFDLBMESxyzurfdlb])(?:2'?|'2|3|'|i)?/;
  function parseMoves(source) {
    if (!source || source.length > 8000) return null;
    const s=normalize(source).replace(/([URFDLB])([₂₃₄₅])/g,(_,f,n)=>'₂₃₄₅'.indexOf(n)+2+f+'w').replace(/(?<=[URFDLBMESxyzurfdlbw'i])-(?=[2-5URFDLBMESxyzurfdlb([])/g,' '); let pos=0, depth=0, minSize=2;
    const skip=()=>{while (/\s/.test(s[pos]||'') && pos<s.length) pos++;};
    const inv=a=>a.slice().reverse().map(m=>m.endsWith('2')?m:m.endsWith("'")?m.slice(0,-1):m+"'");
    function seq(stops='') {
      if (++depth>12) throw Error('depth');
      let out=[];
      while (true) {
        skip(); if (pos>=s.length || stops.includes(s[pos])) break;
        let part;
        if (s[pos]==='(' || s[pos]==='[') {
          const open=s[pos++]; part=seq(open==='(' ? ')' : ',:]'); skip();
          if(open==='[') {
            const op=s[pos++]; if(op!==',' && op!==':') throw Error('operator');
            const b=seq(']'); if(!part.length || !b.length) throw Error('empty');
            part=op===',' ? [...part,...b,...inv(part),...inv(b)] : [...part,...b,...inv(part)];
          }
          if(s[pos++]!==(open==='('?')':']') || !part.length) throw Error('close');
          const suffix=s.slice(pos).match(/^(\d{1,3})?(')?/)[0]; pos+=suffix.length;
          const count=Number(suffix.replace("'",'')||1); if(count<1 || count>100) throw Error('repeat');
          if(suffix.endsWith("'")) part=inv(part);
          if(part.length*count>MAX) throw Error('size');
          part=Array.from({length:count},()=>part).flat();
        } else {
          const m=s.slice(pos).match(moveRE); if(!m) throw Error('token');
          pos+=m[0].length;
          let move=m[0].replace(/i$/,"'").replace(/(?:2'|'2)$/,'2').replace(/3$/,"'");
          const base=move.replace(/[2']$/,'');
          if(/[MES]/.test(base)) minSize=Math.max(minSize,3);
          if(/^[2-5]-[2-5]/.test(base)) {
            if(Number(base[0])>Number(base[2])) throw Error('layer range');
            minSize=Math.max(minSize,Number(base[2])+1);
          } else if(/^[urfdlb]$/.test(base) || /w$/.test(base)) {
            minSize=Math.max(minSize,Number(base.match(/^[2-5]/)?.[0]||2)+1);
          } else if(/^[2-5]/.test(base)) minSize=Math.max(minSize,Number(base[0])+1);
          part=[move];
        }
        out.push(...part); if(out.length>MAX) throw Error('size');
      }
      depth--; return out;
    }
    try {const moves=seq(); skip(); return pos===s.length && moves.length && minSize<=5 ? {moves,minSize}:null;} catch {return null;}
  }
  function facelets(source) {
    const compact=source.replace(/\s/g,''); const size=Math.sqrt(compact.length/6);
    if(![2,3,4,5].includes(size)) return null;
    const alphabet=/^[URFDLB]+$/.test(compact)?'URFDLB':/^[WOGRBY]+$/.test(compact)?'WOGRBY':null;
    if(!alphabet || ![...alphabet].every(f=>compact.split(f).length-1===size*size)) return null;
    let notation=compact,format=alphabet==='URFDLB'?'facelets':'colours';
    const rows=source.trim().split(/\r?\n/).map(r=>r.replace(/\s/g,''));
    // A canonical U / L F R B / D net must be reordered, not merely flattened.
    if(rows.length===size*3 && rows.every((r,i)=>r.length===(i>=size && i<size*2?size*4:size))) {
      const bands=[0,1,2,3].map(b=>rows.slice(size,size*2).map(r=>r.slice(b*size,(b+1)*size)).join(''));
      notation=rows.slice(0,size).join('')+bands[2]+bands[1]+rows.slice(size*2).join('')+bands[0]+bands[3];
      format+=' net';
    }
    return {kind:'state',format,notation,size,confidence:'high'};
  }
  function cubieState(source) {
    const terms=source.trim().split(/\s+/);
    const canon=t=>[...t.toUpperCase()].sort().join('');
    const distinct=(list,width)=>list.every(t=>new RegExp('^[URFDLB]{'+width+'}$','i').test(t) && new Set(t.toUpperCase()).size===width && !['UD','RL','FB'].some(p=>[...p].every(c=>t.toUpperCase().includes(c)))) && new Set(list.map(canon)).size===list.length;
    if(terms.length===20 && distinct(terms.slice(0,12),2) && distinct(terms.slice(12),3))
      return {kind:'state',format:'ACube positional',notation:source.trim(),size:3,dialect:'Acube',confidence:'high'};
    return null;
  }
  function coordinates(source) {
    const match=source.trim().match(/^cp:\s*([0-9\s]+);\s*co:\s*([0-9\s]+)(?:;\s*ep:\s*([0-9\s]+);\s*eo:\s*([0-9\s]+))?$/i);
    if(!match)return null;
    const values=match.slice(1).map(s=>s?.trim().split(/\s+/).map(Number));
    const perm=(a,n)=>a.length===n && new Set(a).size===n && a.every(v=>v>=0 && v<n);
    const ori=(a,n,max)=>a.length===n && a.every(v=>v>=0 && v<max);
    if(!perm(values[0],8)||!ori(values[1],8,3)||values[2]&&(!perm(values[2],12)||!ori(values[3],12,2)))return null;
    return {kind:'state',format:'cubie coordinates',notation:source.trim(),size:values[2]?3:2,confidence:'high'};
  }
  function permutation(source) {
    const s=normalize(source).trim(); const cycles=s.match(/\([^()]+\)/g);
    if(!cycles || cycles.join('').replace(/\s/g,'')!==s.replace(/\s/g,'')) return null;
    const faces=t=> {
      const f=t.replace(/[+\-0-9]/g,'').toLowerCase();
      return /^[urfdlb]{1,3}$/.test(f) && new Set(f).size===f.length &&
        !['ud','rl','fb'].some(pair=>[...pair].every(c=>f.includes(c)));
    };
    let pieces=0;
    for(const cycle of cycles) {
      const tokens=cycle.slice(1,-1).split(/[\s,]+/).map(t=>t.trim()).filter(Boolean);
      if(tokens.some(t=>!/^[-+]*[urfdlb]{1,3}[0-9]*[-+]*$/i.test(t)||!faces(t))) return null;
      if(tokens.length===1 && !/[+-]/.test(tokens[0])) return null;
      if(tokens.some(t=>t.replace(/[+\-0-9]/g,'').length===1) && tokens.length>1)return null;
      pieces+=tokens.length;
    }
    return pieces>=2?{kind:'permutation',notation:s,size:null,confidence:'high'}:null;
  }
  function classify(source, options={}) {
    const s=normalize(source).trim(); if(!s || s.length>8000) return null;
    const state=facelets(s)||cubieState(s)||coordinates(s); if(state)return state;
    // Never reinterpret a malformed facelet-shaped string as a move sequence.
    if(/^[URFDLB\s]+$/.test(s) && [24,54,96,150].includes(s.replace(/\s/g,'').length)) return null;
    const perm=permutation(s); if(perm)return options.size>3?null:{...perm,size:options.size||3};
    // Preserve legacy CubeTwister syntax rather than guess its semantics.
    if(/[CMST][URFDLB]/.test(s) && /^(?:\s*(?:[CMST]?[URFDLB])(?:2|'|3)?\s*)+$/.test(s))
      return options.size && options.size!==3?null:{kind:'legacy',notation:s,size:3,dialect:'Sse',confidence:'high'};
    const parsed=parseMoves(s);
    if(parsed && options.size && ((options.size!==3 && options.size!==5 && parsed.moves.some(m=>/^[MES]/.test(m))) || parsed.minSize>options.size))return null;
    if(!parsed || parsed.moves.length<(options.minMoves??3)) return null;
    return {kind:'moves',notation:parsed.moves.join(' '),size:options.size||Math.max(3,parsed.minSize),
      lowercaseMode:options.lowercaseMode||'Wide',minSize:parsed.minSize,confidence:'medium'};
  }
  function inferSize(text) {
    const found=[...text.matchAll(/\b([2-9])\s*[x×]\s*\1(?:\s*[x×]\s*\1)?\b/gi)].map(m=>Number(m[1]));
    return found.length && new Set(found).size===1 ? found[0] : null;
  }
  function detect(text, options={}) {
    if(typeof text!=='string' || text.length>32000 || options.size && ![2,3,4,5].includes(options.size)) return [];
    const found=[];
    // Structured states take precedence over move-like cubie labels.
    const structured=facelets(text)||cubieState(text)||coordinates(text);
    if(structured)return [{...structured,start:0,end:text.trimEnd().length,source:text.trimEnd()}];
    function add(start,end,result) {
      if(result?.kind==='moves' && /^[A-Za-z]+$/.test(text.slice(start,end)) && (!options.cubeContext || text.slice(start,end).length<6))return;
      if(!result || found.some(x=>start<x.end && end>x.start))return;
      if(options.size && result.minSize>options.size)return;
      found.push({...result,start,end,source:text.slice(start,end)});
    }
    // Orbit64 is only autodetected with an explicit label, never arbitrary short IDs.
    for(const m of text.matchAll(/\bOrbit64\s*[:=]\s*([A-P][A-Za-z0-9_-]*)(?![A-Za-z0-9_-])/gi)) {
      const token=m[1],size={5:2,12:3,27:4,43:5}[token.length];
      if(size && /^[A-P]/.test(token))add(m.index+m[0].lastIndexOf(token),m.index+m[0].length,{kind:'state',format:'Orbit64 candidate',notation:token,size,confidence:'medium'});
    }
    // Long facelet runs before algorithms. Spaces/newlines between faces are allowed.
    for(const m of text.matchAll(/(?<![A-Za-z0-9])[URFDLBWOGY](?:[URFDLBWOGY\s]*[URFDLBWOGY])?(?![A-Za-z0-9])/g)) {
      const r=facelets(m[0]); if(r)add(m.index,m.index+m[0].length,r);
    }
    for(const m of text.matchAll(/(?:\([^()]+\)\s*)+/g)) {
      const raw=m[0].trimEnd(); const p=options.size>3?null:permutation(raw);add(m.index,m.index+raw.length,p?{...p,size:options.size||3}:null);
    }
    // Try complete standalone expressions, including nested groups/commutators.
    const trim=text.trim(); const whole=classify(trim,options);
    if(whole) add(text.indexOf(trim),text.indexOf(trim)+trim.length,whole);
    // Candidate runs bounded by prose; unmatched syntax is rejected, not repaired.
    const run=/(?<![A-Za-z0-9])(?:[2-5]-[2-5][URFDLB]w|[2-5]?[URFDLB]w|[2-5][URFDLB]|[CMST][URFDLB]|[URFDLBMESxyzurfdlb]|[([])(?:[URFDLBMESxyzurfdlbCMSTwi₂₃₄₅2-5\-'’‘′´`²\s·•()[\],:0-9]*)(?![A-Za-z0-9])/g;
    for(const m of text.matchAll(run)) {
      let raw=m[0].trimEnd();
      // Metric suffixes in Pretty Patterns are deliberately outside the notation.
      raw=raw.replace(/\s+\(\d+\s*$/,'').trimEnd();
      if(!raw || /[A-Za-z]/.test(text[m.index+raw.length]||''))continue;
      const r=classify(raw,options);
      if(r && (options.cubeContext || /[URFDLBMES]/.test(raw))) add(m.index,m.index+raw.length,r);
    }
    return found.sort((a,b)=>a.start-b.start);
  }
  function makeURL(result, settings=DEFAULTS) {
    const template=['moves','legacy'].includes(result.kind)?settings.movesTemplate:settings.algTemplate;
    const encoded=new URLSearchParams({n:result.notation}).toString().slice(2);
    const value=template.replaceAll('{notation}',encoded).replaceAll('{size}',String(result.size||3));
    const url=new URL(value); if(url.protocol!=='https:')throw Error('Only HTTPS destinations are allowed');
    if(url.hostname==='wstein.github.io' && url.pathname.startsWith('/cubelab/')) {
      const params=new URLSearchParams(url.hash.slice(1));
      if(result.size && result.size!==3)params.set('size',String(result.size));
      if(result.setup)params.set('alg',result.setup);
      if(result.dialect)params.set('dialect',result.dialect);
      if((result.lowercaseMode||settings.lowercaseMode)==='InnerSlice' && result.size>=4)params.set('lowercase','InnerSlice');
      if(settings.scheme==='Japanese')params.set('scheme','Japanese');
      url.hash=params.toString();
    }
    return url.href;
  }
  const api={DEFAULTS,normalize,parseMoves,facelets,cubieState,coordinates,permutation,classify,detect,inferSize,makeURL};
  root.CubeLabDetector=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
