(() => {
  'use strict';
  if (globalThis.__cubeLabLinker) return;
  globalThis.__cubeLabLinker = true;
  const D=CubeLabDetector;
  const BLOCK='p,li,td,th,pre,div,section,article,h1,h2,h3,h4,h5,h6,dd,dt,figcaption,body';
  const SKIP='script,style,noscript,textarea,input,select,button,a,svg,canvas,math,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"],.cubelab-link';
  let settings={...D.DEFAULTS}, timer, count=0, running=false;
  const observer=new MutationObserver(changes=>{
    if(changes.some(c=>!c.target.parentElement?.closest('.cubelab-link'))) schedule();
  });
  function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;scan();},250);}
  function active(){return settings.enabled && !settings.disabledHosts.includes(location.hostname);}
  function makeLink(match) {
    const link=document.createElement('a');link.className='cubelab-link';
    try {link.href=D.makeURL(match,settings);}catch{return null;}
    link.target='_blank';link.rel='noopener noreferrer';
    const label=match.kind==='moves'?`${match.size}×${match.size} moves`:match.kind==='state'?`${match.size}×${match.size} state`:match.kind==='legacy'?'SSE moves':'cycles';
    link.textContent=`↗ CubeLab · ${label}`;
    link.title=`Open ${(match.source||match.notation).slice(0,300)} in CubeLab`;
    link.setAttribute('aria-label',link.title);
    link.addEventListener('click',event=>event.stopPropagation());
    return link;
  }
  function scan(){
    if(running||!document.body)return;
    running=true;observer.disconnect();
    try {
      document.querySelectorAll('.cubelab-link').forEach(a=>a.remove());count=0;
      if(!active())return;
      const blocks=new Map();
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{
        acceptNode(node){
          if(node.nodeType===1)return node.tagName==='BR'?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let node,previousBlock=null,visited=0;
      while((node=walker.nextNode()) && visited++<100000){
        const parent=node.nodeType===1?node:node.parentElement;
        if(!parent)continue;
        const skipped=!!parent.closest(SKIP);
        const block=parent.closest(BLOCK);if(!block || block.getClientRects().length===0)continue;
        if(!blocks.has(block))blocks.set(block,{text:'',parts:[]});
        const item=blocks.get(block);
        if(previousBlock!==block && item.parts.length)item.text+='\0';
        previousBlock=block;
        const value=skipped?'\0':node.nodeType===3?(parent.closest('sub')?node.nodeValue.replace(/[2-5]/g,n=>'₂₃₄₅'[Number(n)-2]):node.nodeValue):'\n';
        // Keep offsets across inline tags, superscripts and explicit line breaks.
        item.parts.push({node,start:item.text.length,end:item.text.length+value.length});item.text+=value;
      }
      const pageSize=D.inferSize(document.title+' '+decodeURI(location.pathname)+' '+[...document.querySelectorAll('h1')].map(x=>x.textContent).join(' '));
      const headings=[...document.querySelectorAll('h1,h2,h3,h4')];
      const nonCube=t=>/pyraminx|megaminx|skewb|square[ -]?1|rubik.?s? clock/i.test(t);
      const pageNonCube=nonCube(document.title+' '+location.pathname);
      const cubeContext=/rubik|cubing|cube|würfel/i.test(document.title+' '+location.hostname);
      for(const [block,item] of blocks){
        if(count>=500)break;
        const prefs=settings.sitePreferences?.[location.hostname]||{};
        const heading=headings.filter(h=>h===block || (h.compareDocumentPosition(block)&Node.DOCUMENT_POSITION_FOLLOWING)).at(-1)?.textContent||'';
        const localSize=D.inferSize(item.text)||D.inferSize(heading);
        if(!prefs.size && (nonCube(heading)||pageNonCube&&!localSize))continue;
        const size=Number(prefs.size)||localSize||pageSize;
        const matches=D.detect(item.text,{size,cubeContext,minMoves:settings.minMoves,lowercaseMode:prefs.lowercaseMode||settings.lowercaseMode});
        // Inserting from right to left keeps offsets valid even if a text node splits.
        for(const match of matches.reverse()){
          if(count>=500)break;
          const part=item.parts.find(p=>p.node.nodeType===3 && p.start<match.end && p.end>=match.end);
          if(!part)continue;
          const link=makeLink(match);if(!link)continue;
          const range=document.createRange();range.setStart(part.node,match.end-part.start);range.collapse(true);range.insertNode(link);count++;
        }
      }
      // Explicit public widget attributes: Ruwix gallery cards, Roofpig and Twizzle.
      for(const widget of document.querySelectorAll('[data-alg],[data-algorithm],[data-roofpig],twisty-player[alg]')) {
        if(count>=500)break;
        if(widget.closest(SKIP)||widget.getClientRects().length===0||widget.querySelector('.cubelab-link'))continue;
        const raw=widget.getAttribute('data-alg')||widget.getAttribute('data-algorithm')||widget.getAttribute('alg')||widget.getAttribute('data-roofpig')?.match(/(?:^|\|)\s*alg=([^|]+)/)?.[1];
        if(!raw)continue;
        const prefs=settings.sitePreferences?.[location.hostname]||{};
        const puzzle=widget.getAttribute('puzzle')||widget.getAttribute('data-puzzle')||'';
        const heading=headings.filter(h=>h.compareDocumentPosition(widget)&Node.DOCUMENT_POSITION_FOLLOWING).at(-1)?.textContent||'';
        const size=Number(prefs.size)||D.inferSize(puzzle)||D.inferSize(heading)||pageSize;
        if(nonCube(puzzle+' '+heading)||size && ![2,3,4,5].includes(size))continue;
        const match=D.classify(raw,{size,minMoves:settings.minMoves,lowercaseMode:prefs.lowercaseMode||settings.lowercaseMode});
        if(!match)continue;
        // A nonempty setup changes meaning; carry it into CubeLab's Setup field.
        const setup=widget.getAttribute('experimental-setup-alg');
        if(setup){if(setup.length>8000)continue;match.setup=setup;}
        const link=makeLink(match);if(!link)continue;
        if(widget.tagName==='TWISTY-PLAYER')widget.after(link);else widget.append(link);
        count++;
      }
    } finally {
      running=false;
      observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','style','alg','data-alg','data-algorithm','data-roofpig','puzzle','data-puzzle','experimental-setup-alg']});
    }
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message.type==='status')respond({count,hostname:location.hostname,enabled:active()});
    if(message.type==='scan'){scan();respond({count});}
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local' && changes.settings){settings={...D.DEFAULTS,...changes.settings.newValue};schedule();}
  });
  chrome.storage.local.get('settings').then(data=>{settings={...D.DEFAULTS,...data.settings};scan();});
})();
