// One branded layout for every email Daily Ledger sends. Tables and inline styles only, so it holds up in Gmail, Outlook and Apple Mail.
// Nothing depends on remote images (many mail apps block them): the logo mark is plain CSS. A copy button is not possible in email (no scripts),
// so the verification code is a single selectable block: one click or tap selects all of it.
export const esc=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export type EmailBlock={type:'p';text:string}|{type:'code';text:string}|{type:'list';items:string[]}|{type:'note';text:string};
export interface EmailParts{preheader:string;heading:string;blocks:EmailBlock[];cta?:{label:string;url:string};footer?:string}
const font="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const mono="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";
const lime='#b6f26b',emerald='#2dd4a3',gradient=`linear-gradient(135deg,${lime},${emerald})`;
function block(b:EmailBlock){
 if(b.type==='p')return `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#b4bfb8">${esc(b.text)}</p>`;
 if(b.type==='code')return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px"><tr><td style="padding:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${lime}">Your verification code</td></tr><tr><td align="center" bgcolor="#080c0a" style="background:#080c0a;border:1px solid #2b3d34;border-radius:16px;padding:26px 12px"><div style="font-family:${mono};font-size:42px;line-height:1.1;font-weight:700;letter-spacing:12px;padding-left:12px;color:${lime};user-select:all;-webkit-user-select:all;cursor:text">${esc(b.text)}</div></td></tr><tr><td align="center" style="padding:12px 0 22px;font-size:12px;line-height:1.5;color:#7d8a83">Double-click, or tap and hold, the code to copy it.</td></tr></table>`;
 if(b.type==='note')return `<p style="margin:6px 0 4px;padding-top:18px;border-top:1px solid #1f2a25;font-size:13px;line-height:1.7;color:#7d8a83">${esc(b.text)}</p>`;
 return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px">${b.items.map(item=>`<tr><td valign="top" style="padding:0 12px 12px 0"><div style="width:20px;height:20px;line-height:20px;border-radius:10px;background:${gradient};background-color:${lime};text-align:center;font-size:12px;font-weight:700;color:#06140d">&#10003;</div></td><td style="padding:0 0 12px;font-size:15px;line-height:1.6;color:#c3cec7">${esc(item)}</td></tr>`).join('')}</table>`;
}
export function renderEmail(parts:EmailParts){
 const mark=`<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="38" height="38" align="center" valign="middle" bgcolor="${lime}" style="width:38px;height:38px;border-radius:11px;background:${gradient};background-color:${lime};font-family:${font};font-size:15px;font-weight:800;letter-spacing:-.5px;color:#06140d">DL</td><td style="padding-left:12px;font-family:${font};font-size:18px;font-weight:700;letter-spacing:-.3px;color:#ffffff">Daily Ledger</td></tr></table>`;
 const button=parts.cta?`<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:10px 0 22px"><tr><td align="center" bgcolor="${lime}" style="border-radius:14px;background:${gradient};background-color:${lime}"><a href="${esc(parts.cta.url)}" style="display:inline-block;padding:16px 32px;font-family:${font};font-size:16px;font-weight:700;color:#06140d;text-decoration:none;border-radius:14px">${esc(parts.cta.label)}</a></td></tr></table><p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#7d8a83">Button not working? Paste this link into your browser:<br><a href="${esc(parts.cta.url)}" style="color:${emerald};word-break:break-all;text-decoration:none">${esc(parts.cta.url)}</a></p>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(parts.heading)}</title></head><body style="margin:0;padding:0;background:#070a09" bgcolor="#070a09">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(parts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#070a09" style="background:#070a09"><tr><td align="center" style="padding:36px 16px 40px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;font-family:${font}">
<tr><td style="padding:0 4px 22px">${mark}</td></tr>
<tr><td bgcolor="#101513" style="background:#101513;border:1px solid #212c26;border-radius:22px;overflow:hidden">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${gradient};background-color:${lime}">&nbsp;</td></tr>
<tr><td style="padding:38px 34px 30px;font-family:${font}">
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-.7px;color:#ffffff">${esc(parts.heading)}</h1>
${parts.blocks.map(block).join('')}${button}
</td></tr></table>
</td></tr>
<tr><td style="padding:24px 8px 0;text-align:center;font-family:${font};font-size:12px;line-height:1.7;color:#66736b">${esc(parts.footer||'You are receiving this because of activity on your Daily Ledger account.')}<br><span style="color:#8a978f">Daily Ledger</span> &middot; A little more clarity, every day.</td></tr>
</table></td></tr></table></body></html>`;
}
export function renderText(parts:EmailParts){
 const lines=[parts.heading,''];
 for(const b of parts.blocks){if(b.type==='list')lines.push(...b.items.map(i=>`- ${i}`));else lines.push(b.text);lines.push('');}
 if(parts.cta)lines.push(`${parts.cta.label}: ${parts.cta.url}`,'');
 lines.push(parts.footer||'You are receiving this because of activity on your Daily Ledger account.');
 return lines.join('\n');
}
