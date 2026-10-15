import type {RecordData} from '@ledger/shared';
export type GoalTypeId='money'|'weight'|'workouts'|'habit'|'lift'|'project'|'custom';
export type GoalType={id:GoalTypeId;label:string;blurb:string;pro:boolean;source?:NonNullable<RecordData['goal']['autoSource']>['type']};
// Types marked pro follow the rest of the app automatically. money works for everyone as a manual goal; Pro adds the Finance link.
export const goalTypes:GoalType[]=[
 {id:'money',label:'Save money',blurb:'Set an amount. Pro follows a Finance category for you.',pro:false,source:'savings'},
 {id:'weight',label:'Reach a weight',blurb:'Progress comes from your body check-ins.',pro:true,source:'weight'},
 {id:'workouts',label:'Train regularly',blurb:'Counts the sessions you complete.',pro:true,source:'workouts'},
 {id:'lift',label:'Hit a lift',blurb:'Follows your heaviest set of one exercise.',pro:true,source:'lift'},
 {id:'habit',label:'Keep a habit going',blurb:'Counts the days you complete a habit.',pro:true,source:'habit'},
 {id:'project',label:'Finish a project',blurb:'Break it into steps; ticking steps moves the bar.',pro:false},
 {id:'custom',label:'Track any number',blurb:'Books read, pages written, anything. You update it.',pro:false},
];
export const sourceLabel:Record<NonNullable<RecordData['goal']['autoSource']>['type'],{label:string;href:string}>={
 savings:{label:'your Finance transfers',href:'/finance/transactions'},
 weight:{label:'your body check-ins',href:'/fitness'},
 workouts:{label:'your completed workouts',href:'/fitness'},
 habit:{label:'your habit check-ins',href:'/tasks'},
 lift:{label:'your logged lifts',href:'/fitness'},
};
