export const GAME_VERSION="0.5.8";
export const W=480,H=720;
export const palette={
 css:{bg:"#06110d",bgSoft:"#0c2017",panel:"#09170f",cyan:"#9a68ff",gold:"#f2c94c",green:"#65dc79",text:"#fff7df",muted:"#b9c9b6",danger:"#ff6b62"},
 hex:{bg:0x06110d,bgSoft:0x0c2017,panel:0x09170f,cyan:0x9a68ff,gold:0xf2c94c,green:0x65dc79,text:0xfff7df,muted:0xb9c9b6,danger:0xff6b62},
} as const;
export const stages=[
 {name:"SEEDLING",speed:260,mult:1,need:10,scale:1.75,hit:18},
 {name:"SAPLING",speed:252,mult:1.1,need:20,scale:1.7,hit:22},
 {name:"YOUNG TREE",speed:242,mult:1.25,need:35,scale:1.55,hit:27},
 {name:"MATURE",speed:224,mult:1.5,need:50,scale:1.45,hit:32},
 {name:"ANCIENT",speed:203,mult:2,need:50,scale:1.35,hit:38},
] as const;
export const weaponLevels=[
 {name:"SAP POD",shots:1,fireMs:285,speed:440,damage:1,pierce:0,activeCap:2},
 {name:"ACCELERATED SAP",shots:1,fireMs:235,speed:520,damage:1,pierce:0,activeCap:2},
 {name:"TWIN PODS",shots:2,fireMs:270,speed:500,damage:1,pierce:0,activeCap:4},
 {name:"THORN CORE",shots:2,fireMs:290,speed:525,damage:1,pierce:1,activeCap:4},
 {name:"CANOPY CANNON",shots:2,fireMs:335,speed:560,damage:2,pierce:0,activeCap:4},
] as const;
export const tuning={chainMs:2500,pruneInvuln:600,damageInvuln:1250,pruneChargeMax:100,weaponCorePity:12,turboPity:16,turboMs:7000,turboMoveMultiplier:1.22,turboFireMultiplier:.8,holdFireMs:420,autoFireMs:460,enemyProjectiles:{dartSpeed:168,drillSpeed:182,sporeSpeed:108,sporeWobble:28}};
export const enemyConfig={bat:{hp:1,score:100,growth:2,pruneCharge:10},borer:{hp:2,score:250,growth:5,pruneCharge:18},spore:{hp:1,score:200,growth:4,pruneCharge:15},small:{hp:1,score:50,growth:1,pruneCharge:5}} as const;
export const waves=[
 // The opener teaches movement and firing: two spaced four-bat flights, then room to reset.
 {name:"FORMATION TRAINING",spawns:[...Array(8)].map((_,i)=>({type:"bat",delay:2200+Math.floor(i/4)*3100+(i%4)*520,pattern:i%4<2?"leftArc":"rightArc"}))},
 {name:"COORDINATED ASSAULT",spawns:[...Array(28)].map((_,i)=>({type:"bat",delay:450+Math.floor(i/4)*820+(i%4)*115,pattern:["leftArc","rightArc","cross","sweep"][i%4]}))},
 {name:"ROOT SNARE",spawns:[...Array(32)].map((_,i)=>({type:i%9===0?"borer":i%7===0?"spore":"bat",delay:380+Math.floor(i/4)*720+(i%4)*100,pattern:["sweep","rightArc","leftArc","cross"][i%4]}))},
 {name:"CANOPY RUSH",spawns:[...Array(40)].map((_,i)=>({type:"bat",delay:260+Math.floor(i/5)*590+(i%5)*80,pattern:["leftArc","cross","rightArc","sweep","cross"][i%5]}))},
] as const;
