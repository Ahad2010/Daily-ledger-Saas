import type {RecordData} from '@ledger/shared';
export type GoalTypeId='money'|'weight'|'workouts'|'habit'|'lift'|'project'|'custom';
export const goalTone:Record<GoalTypeId,string>={money:'#4ade80',weight:'#60a5fa',workouts:'#b6f26b',lift:'#fb923c',habit:'#f472b6',project:'#a78bfa',custom:'#2dd4bf'};
export type GoalType={id:GoalTypeId;label:string;blurb:string;example:string;pro:boolean;source?:NonNullable<RecordData['goal']['autoSource']>['type']};
// Types marked pro follow the rest of the app automatically. money works for everyone as a manual goal; Pro adds the Finance link.
export const goalTypes:GoalType[]=[
 {id:'money',example:'Save $5,000 for an emergency fund',label:'Save money',blurb:'Set an amount. Pro follows a Finance category for you.',pro:false,source:'savings'},
 {id:'weight',example:'Get from 82 kg to 75 kg',label:'Reach a weight',blurb:'Progress comes from your body check-ins.',pro:true,source:'weight'},
 {id:'workouts',example:'Train 12 times this month',label:'Train regularly',blurb:'Counts the sessions you complete.',pro:true,source:'workouts'},
 {id:'lift',example:'Bench press 60 kg',label:'Hit a lift',blurb:'Follows your heaviest set of one exercise.',pro:true,source:'lift'},
 {id:'habit',example:'Meditate 20 days in a row',label:'Keep a habit going',blurb:'Counts the days you complete a habit.',pro:true,source:'habit'},
 {id:'project',example:'Launch my website: design, build, publish',label:'Finish a project',blurb:'Break it into steps; ticking steps moves the bar.',pro:false},
 {id:'custom',example:'Read 24 books this year',label:'Track any number',blurb:'Books read, pages written, anything. You update it.',pro:false},
];
export const sourceLabel:Record<NonNullable<RecordData['goal']['autoSource']>['type'],{label:string;href:string}>={
 savings:{label:'your Finance transfers',href:'/finance/transactions'},
 weight:{label:'your body check-ins',href:'/fitness'},
 workouts:{label:'your completed workouts',href:'/fitness'},
 habit:{label:'your habit check-ins',href:'/tasks'},
 lift:{label:'your logged lifts',href:'/fitness'},
};
