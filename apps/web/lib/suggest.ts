import {recordsOf,type LedgerRecord} from '@ledger/shared';

// Instant, free suggestions while someone types. They learn from the member's own history first, then fall back to common words.
export type TransactionHint={categories:string[];amount?:{cents:number;title:string};type?:'income'|'expense'};
const words:Record<string,string[]>={
 Food:['grocer','supermarket','walmart','costco','tesco','carrefour','restaurant','cafe','coffee','starbucks','pizza','burger','lunch','dinner','breakfast','food','bakery','uber eats','doordash','kfc','mcdonald'],
 Transport:['uber','lyft','careem','taxi','fuel','petrol','gas station','diesel','metro','bus','train','parking','toll','flight','airline'],
 Essentials:['rent','electric','water bill','utility','utilities','internet','wifi','mobile','phone bill','insurance','mortgage','maintenance'],
 Health:['pharmacy','doctor','clinic','hospital','dentist','gym','medicine','medical'],
 Entertainment:['netflix','spotify','cinema','movie','steam','game','youtube','concert','subscription'],
 Shopping:['amazon','ikea','zara','apple store','clothes','shoes','mall','shopping','daraz'],
 Software:['claude','openai','chatgpt','github','vercel','railway','domain','hosting','figma','notion','software','saas','tools']
};
const incomeWords=['salary','payroll','freelance','invoice','refund','bonus','dividend','client payment','commission','paid by','income'];
const norm=(s:string)=>s.trim().toLowerCase();

export function transactionHint(title:string,records:LedgerRecord[],currency:string):TransactionHint|null{
 const text=norm(title);if(text.length<3)return null;
 const tx=recordsOf(records,'transaction').filter(r=>r.data.currency===currency&&r.data.type!=='transfer');
 const known=new Map<string,number>();for(const r of tx)known.set(r.data.category,(known.get(r.data.category)||0)+1);
 const categories:string[]=[];
 // 1. What this member filed the same or a similar description under before.
 const similar=tx.filter(r=>{const t=norm(r.data.title);return t===text||t.startsWith(text)||(text.length>=4&&t.includes(text))||(t.length>=4&&text.includes(t));});
 const counts=new Map<string,number>();for(const r of similar)counts.set(r.data.category,(counts.get(r.data.category)||0)+1);
 for(const [name] of [...counts].sort((a,b)=>b[1]-a[1]))categories.push(name);
 // 2. Common words, mapped to the member's own category names when they use a close one.
 for(const [name,list] of Object.entries(words))if(list.some(w=>text.includes(w))){const own=[...known.keys()].find(k=>norm(k)===norm(name))||name;if(!categories.includes(own))categories.push(own);}
 const exact=tx.filter(r=>norm(r.data.title)===text).sort((a,b)=>b.data.date.localeCompare(a.data.date))[0];
 const type=incomeWords.some(w=>text.includes(w))?'income':undefined;
 if(!categories.length&&!exact&&!type)return null;
 return {categories:categories.slice(0,3),amount:exact?{cents:exact.data.amount,title:exact.data.title}:undefined,type};
}

export function taskHint(title:string):{priority:'high'|'low';why:string}|null{
 const text=norm(title);
 if(/\b(urgent|asap|deadline|overdue|today|immediately|tonight|invoice|pay|tax|bill|exam|interview)\b/.test(text))return {priority:'high',why:'Sounds time-sensitive'};
 if(/\b(someday|maybe|idea|read|browse|organi[sz]e)\b/.test(text))return {priority:'low',why:'Sounds flexible'};
 return null;
}
