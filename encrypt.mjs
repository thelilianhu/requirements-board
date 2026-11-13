// 把明文看板加密成"密码解锁"页面（AES-256-GCM + PBKDF2）
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const plain = readFileSync(process.argv[2] || '/tmp/board-plain.html', 'utf8');
const password = process.argv[3];
if (!password) throw new Error('need password');
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>需求管理看板 · 加密</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#f6f7f9;font:14px/1.6 "PingFang SC",system-ui,sans-serif;color:#1f2329}
.card{width:min(380px,90vw);background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:26px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
h1{margin:0 0 6px;font-size:17px}p{margin:0 0 16px;color:#6b7280;font-size:12.5px}
input{width:100%;height:38px;padding:0 12px;border:1px solid #e5e7eb;border-radius:9px;font:inherit;outline:none}
input:focus{border-color:#4f6bed}button{width:100%;height:38px;margin-top:10px;border:0;border-radius:9px;background:#4f6bed;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.err{margin-top:10px;color:#dc2626;font-size:12px;display:none}#content{display:none}</style></head>
<body><div class="card" id="gate"><h1>需求管理看板</h1><p>输入访问密码后查看</p>
<input id="pw" type="password" placeholder="访问密码" autofocus><button id="go">解锁</button><div class="err" id="err">密码不正确</div></div>
<div id="content"></div>
<script>
const SALT="${b64(salt)}",IV="${b64(iv)}",DATA="${b64(cipher)}";
const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function unlock(){
  const pw=document.getElementById('pw').value;
  try{
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(SALT),iterations:200000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
    const buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(IV)},key,b64d(DATA));
    const html=new TextDecoder().decode(buf);
    const doc=new DOMParser().parseFromString(html,'text/html');
    document.head.innerHTML=doc.head.innerHTML;document.body.innerHTML=doc.body.innerHTML;
    const s=document.createElement('script');s.textContent=[...doc.querySelectorAll('script')].map(x=>x.textContent).join('\\n');document.body.appendChild(s);
    sessionStorage.setItem('req.board.pw',pw);
  }catch(e){document.getElementById('err').style.display='block';}
}
document.getElementById('go').onclick=unlock;
document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')unlock();});
</script></body></html>`;
writeFileSync(process.argv[4] || 'index.html', page);
console.log('encrypted page written');
