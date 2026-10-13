// Adapted from the user's Luau-Developer-Playground (LuauForge),
// src/v1-editor.js, src/highlight.js and src/editor-line-layout.js.
// This shared component deliberately uses the same textarea/overlay model;
// the collaboration transport is separate from the editor itself.
const KEYWORDS=new Set('and break continue do else elseif end export false for function if in local nil not or repeat return then true type until while'.split(' '));
const BUILTINS=new Set('assert error getmetatable ipairs next pairs pcall print require select setmetatable tonumber tostring type typeof unpack xpcall math string table task coroutine os bit32 buffer vector utf8'.split(' '));
const TYPES=new Set('any boolean number string thread unknown never nil vector buffer'.split(' '));
const esc=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const COMMENT=/(?:--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*)/y;
const STRING=/(?:\[(=*)\[[\s\S]*?\]\1\]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/y;
const NUMBER=/(?:0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)/y;
const IDENT=/[A-Za-z_][A-Za-z_0-9]*/y;
export function highlightLuau(source){
  const parts=[];let i=0;
  while(i<source.length){let rule=null,cls='';const ch=source[i];
    if(ch==='-'&&source[i+1]==='-'){rule=COMMENT;cls='comment';}
    else if(['"',"'",'`','['].includes(ch)){rule=STRING;cls='string';}
    else if(ch>='0'&&ch<='9'){rule=NUMBER;cls='number';}
    else if(ch==='_'||(ch>='a'&&ch<='z')||(ch>='A'&&ch<='Z'))rule=IDENT;
    if(rule){rule.lastIndex=i;const match=rule.exec(source);if(match){const word=match[0];if(rule===IDENT)cls=KEYWORDS.has(word)?'keyword':TYPES.has(word)?'type':BUILTINS.has(word)?'builtin':'';const text=esc(word);parts.push(cls?`<span class="token ${cls}">${text}</span>`:text);i+=word.length;continue;}}
    parts.push(esc(ch));i++;
  }
  return parts.join('')+'\n';
}
export function newlineIndent(source,cursor){const before=source.slice(source.lastIndexOf('\n',cursor-1)+1,cursor);const indent=before.match(/^\s*/)?.[0]||'';const deeper=/(?:\b(?:then|do|else|repeat|function)\b|\{)\s*(?:--[^\n]*)?$/.test(before);return '\n'+indent+(deeper?'    ':'');}
export class CodeEditor {
  constructor({input,highlight,gutter,onChange=()=>{},onCursor=()=>{},onShortcut=()=>{}}){
    Object.assign(this,{input,highlight,gutter,onChange,onCursor,onShortcut});
    this.source=null;this.lastCount=-1;this.frame=0;this.cleanupFns=[];
    const listen=(target,type,fn)=>{target.addEventListener(type,fn);this.cleanupFns.push(()=>target.removeEventListener(type,fn));};
    listen(input,'input',()=>{this.render();onChange(input.value);onCursor();});
    listen(input,'scroll',()=>{highlight.parentElement.scrollTop=input.scrollTop;highlight.parentElement.scrollLeft=input.scrollLeft;gutter.scrollTop=input.scrollTop;});
    for(const type of ['click','keyup','select'])listen(input,type,()=>onCursor());
    listen(input,'keydown',event=>this.keydown(event));
    listen(input,'beforeinput',event=>{if(['insertParagraph','insertLineBreak'].includes(event.inputType)&&event.cancelable&&!event.isComposing){event.preventDefault();this.insertNewline();}});
    if(typeof ResizeObserver==='function'){this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(input);}
  }
  load(text,path=''){this.source=path;this.input.dataset.path=path;this.input.value=text;this.input.selectionStart=this.input.selectionEnd=0;this.render();this.onCursor();}
  render(){const source=this.input.value;const rows=source.split('\n');if(rows.length!==this.lastCount){this.lastCount=rows.length;this.gutter.textContent=rows.map((_,i)=>i+1).join('\n');}
    if(this.highlight.style&&this.input.clientWidth>0)this.highlight.style.width=this.input.clientWidth+'px';
    cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{this.highlight.innerHTML=highlightLuau(source);this.highlight.parentElement.scrollTop=this.input.scrollTop;this.highlight.parentElement.scrollLeft=this.input.scrollLeft;});
  }
  insertNewline(){const s=this.input.selectionStart;this.replace(s,this.input.selectionEnd,newlineIndent(this.input.value,s));}
  replace(start,end,text,cursor=start+text.length){this.input.focus();this.input.setRangeText(text,start,end,'end');this.input.setSelectionRange(cursor,cursor);this.input.dispatchEvent(new Event('input',{bubbles:true}));}
  keydown(e){const input=this.input,ctrl=e.ctrlKey||e.metaKey;
    if(ctrl&&['s','S','p','P','Enter'].includes(e.key)){e.preventDefault();this.onShortcut(e.key.toLowerCase());return;}
    if(e.key==='Tab'){e.preventDefault();const s=input.selectionStart,t=input.selectionEnd;if(s===t&&!e.shiftKey)this.replace(s,t,'    ');else{const before=input.value.lastIndexOf('\n',s-1)+1;const after=input.value.indexOf('\n',t);const last=after<0?input.value.length:after;const source=input.value.slice(before,last);let updated;if(e.shiftKey)updated=source.replace(/^ {1,4}/gm,'');else updated=source.replace(/^/gm,'    ');this.replace(before,last,updated,before+updated.length);}return;}
    if(e.key==='Enter'&&!ctrl&&!e.altKey&&!e.isComposing){e.preventDefault();this.insertNewline();return;}
    if(!ctrl&&!e.altKey&&!e.isComposing&&input.selectionStart===input.selectionEnd){const pos=input.selectionStart;const pairs={'(':')','[':']','{':'}','"':'"',"'":"'"};if(pairs[e.key]){e.preventDefault();this.replace(pos,pos,e.key+pairs[e.key],pos+1);return;}if([')',']','}'].includes(e.key)&&input.value[pos]===e.key){e.preventDefault();input.setSelectionRange(pos+1,pos+1);this.onCursor();}}
  }
  get position(){const before=this.input.value.slice(0,this.input.selectionStart);const lines=before.split('\n');return {line:lines.length,column:lines.at(-1).length+1};}
  destroy(){cancelAnimationFrame(this.frame);this.resizeObserver?.disconnect();this.cleanupFns.forEach(f=>f());}
}
