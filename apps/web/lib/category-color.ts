// A steady colour per category name, so the same category looks the same everywhere.
const hues=[152,200,265,28,330,48,180,12];
export function categoryColor(name:string){let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))>>>0;const hue=hues[h%hues.length];return {fg:`hsl(${hue} 70% 72%)`,bg:`hsl(${hue} 60% 55% / .14)`,border:`hsl(${hue} 60% 55% / .35)`};}
export const chipStyle=(name:string)=>{const c=categoryColor(name);return {color:c.fg,background:c.bg,borderColor:c.border} as const;};
