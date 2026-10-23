// A steady colour per category name, so the same category looks the same everywhere.
const hues=[200,265,28,330,48,290,215,18];
export function categoryColor(name:string,type?:string){if(type==='income')return {fg:'hsl(145 70% 70%)',bg:'hsl(145 60% 50% / .14)',border:'hsl(145 60% 50% / .35)'};let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))>>>0;const hue=hues[h%hues.length];return {fg:`hsl(${hue} 70% 72%)`,bg:`hsl(${hue} 60% 55% / .14)`,border:`hsl(${hue} 60% 55% / .35)`};}
export const chipStyle=(name:string,type?:string)=>{const c=categoryColor(name,type);return {color:c.fg,background:c.bg,borderColor:c.border} as const;};
