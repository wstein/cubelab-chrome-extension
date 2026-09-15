(async()=>{
 const $=id=>document.getElementById(id),D=CubeLabDetector;
 let settings={...D.DEFAULTS,...(await chrome.storage.local.get('settings')).settings};
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const host=tab?.url?new URL(tab.url).hostname:'';
 $('enabled').checked=settings.enabled;$('site').checked=!settings.disabledHosts.includes(host);$('site').disabled=!host;
 const prefs=settings.sitePreferences[host]||{};
 $('size').value=prefs.size||'';$('lowercaseMode').value=prefs.lowercaseMode||settings.lowercaseMode;
 for(const id of ['size','lowercaseMode'])$(id).onchange=async()=>{settings.sitePreferences={...settings.sitePreferences,[host]:{size:Number($('size').value)||null,lowercaseMode:$('lowercaseMode').value}};await chrome.storage.local.set({settings});};
 async function status(){try{const s=await chrome.tabs.sendMessage(tab.id,{type:'status'});$('status').textContent=`${s.count} links on ${s.hostname}`;}catch{$('status').textContent='Reload the page after installing. Chrome internal pages and CubeLab itself are excluded.';}}
 $('enabled').onchange=async()=>{settings.enabled=$('enabled').checked;await chrome.storage.local.set({settings});};
 $('site').onchange=async()=>{settings.disabledHosts=settings.disabledHosts.filter(h=>h!==host);if(!$('site').checked)settings.disabledHosts.push(host);await chrome.storage.local.set({settings});};
 $('scan').onclick=async()=>{try{await chrome.tabs.sendMessage(tab.id,{type:'scan'});}catch{}await status();};
 $('options').onclick=()=>chrome.runtime.openOptionsPage();await status();
})();
