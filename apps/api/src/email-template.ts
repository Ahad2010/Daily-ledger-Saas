// One branded layout for every email Daily Ledger sends. Inline styles and tables keep it readable in Gmail, Outlook and Apple Mail.
export const esc=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const origin=()=>(process.env.FRONTEND_ORIGIN||'').replace(/\/$/,'');
export type EmailBlock={type:'p';text:string}|{type:'code';text:string}|{type:'list';items:string[]}|{type:'note';text:string};
export interface EmailParts{preheader:string;heading:string;blocks:EmailBlock[];cta?:{label:string;url:string};footer?:string}
const font="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
function block(b:EmailBlock){
 if(b.type==='p')return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3a4540">${esc(b.text)}</p>`;
 if(b.type==='code')return `<div style="margin:6px 0 22px;padding:18px 12px;text-align:center;background:#0f1512;border-radius:12px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:34px;letter-spacing:10px;font-weight:700;color:#8ff0c5">${esc(b.text)}</div>`;
 if(b.type==='note')return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#7a857f">${esc(b.text)}</p>`;
 return `<ul style="margin:0 0 20px;padding:0;list-style:none">${b.items.map(item=>`<li style="margin:0 0 10px;padding-left:26px;position:relative;font-size:15px;line-height:1.55;color:#3a4540"><span style="position:absolute;left:0;top:7px;width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block"></span>${esc(item)}</li>`).join('')}</ul>`;
}
export function renderEmail(parts:EmailParts){
 const logo=origin()&&!/localhost|127\.0\.0\.1/.test(origin())?`<img src="${esc(origin())}/daily-ledger-logo.png" width="46" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:10px">`:'';
 const button=parts.cta?`<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:#34d399"><a href="${esc(parts.cta.url)}" style="display:inline-block;padding:14px 26px;font-family:${font};font-size:15px;font-weight:700;color:#06140d;text-decoration:none;border-radius:10px">${esc(parts.cta.label)}</a></td></tr></table><p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#8a948f">Button not working? Copy this link into your browser:<br><a href="${esc(parts.cta.url)}" style="color:#1d9d73;word-break:break-all">${esc(parts.cta.url)}</a></p>`:'';
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(parts.heading)}</title></head><body style="margin:0;padding:0;background:#edf1ef">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(parts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf1ef"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;font-family:${font}">
<tr><td style="background:#0b0e0d;border-radius:16px 16px 0 0;padding:26px 30px;color:#fafafa;font-size:18px;font-weight:700;letter-spacing:-.2px">${logo}<span style="vertical-align:middle">Daily Ledger</span></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,#b6f26b,#2dd4a3)">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:34px 30px 20px;border-radius:0 0 16px 16px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;letter-spacing:-.4px;color:#0f1512">${esc(parts.heading)}</h1>
${parts.blocks.map(block).join('')}${button}
</td></tr>
<tr><td style="padding:18px 30px 6px;text-align:center;font-size:12px;line-height:1.6;color:#8a948f">${esc(parts.footer||'You are receiving this because of activity on your Daily Ledger account.')}<br>Daily Ledger. A little more clarity, every day.</td></tr>
</table></td></tr></table></body></html>`;
}
export function renderText(parts:EmailParts){
 const lines=[parts.heading,''];
 for(const b of parts.blocks){if(b.type==='list')lines.push(...b.items.map(i=>`- ${i}`));else lines.push(b.text);lines.push('');}
 if(parts.cta)lines.push(`${parts.cta.label}: ${parts.cta.url}`,'');
 lines.push(parts.footer||'You are receiving this because of activity on your Daily Ledger account.');
 return lines.join('\n');
}
