export type InteriorScheme={name:string;colors:{walls:string;ceiling:string;floor:string;cabinetry:string;countertop:string;doors:string};fabric:string;accent:string;metal:string;floor:string;drywall:string;description:string};
const interiors=[
 ['Modern','Walnut calm','Clay & linen','Graphite lounge','Olive daylight','Stone & oak'],
 ['Classic','Blue salon','Warm library','Pearl & brass','Rosewood room','Sage drawing room'],
 ['Natural','Forest retreat','Sandstone','Linen house','Terracotta','Coastal driftwood'],
 ['Urban','Copper loft','Blackened oak','Deep teal','Concrete atelier','Burgundy lounge'],
 ['Collected','Quiet eclectic','Plum velvet','Indigo ceramics','Cognac leather','Golden ochre'],
 ['Refined','Champagne suite','Smoky blue','Emerald accents','Taupe atelier','Chocolate & cream'],
] as const;
const palettes=[
 ['#b8b2a6','#d1cec3','#ad8a62','#515e52','#c5bfb2','#795739','#b3a48d','#8c7259','#b5a16a'],
 ['#b0bbbd','#d2d0c4','#9f8063','#465767','#c9c1b0','#725748','#beb6a4','#6c8290','#bca16a'],
 ['#b9b7a4','#d0cfba','#b79b75','#61705b','#c8bfaa','#886445','#aaa990','#697e58','#9d916c'],
 ['#aaa59b','#c6c5bb','#8a7762','#3e4949','#adaba1','#655340','#8b8a83','#8d6048','#be8a62'],
 ['#b4adb4','#cec6c9','#997b5a','#5b5967','#bdb2a6','#815840','#a18b99','#716383','#b29a6d'],
 ['#c0b3a5','#d3ccbd','#ab8b67','#6a5a4b','#c8bda6','#795940','#beb1a0','#7d8b88','#bda571'],
];
export const interiorSchemes:InteriorScheme[]=interiors.flatMap(([family,...names],f)=>names.map((name,v)=>{const p=palettes[f];return {name:`${family} · ${name}`,colors:{walls:p[v===0?0:v===1?1:v===2?7:v===3?0:4],ceiling:p[1],floor:p[2],cabinetry:p[v%2?7:3],countertop:p[4],doors:p[5]},fabric:p[6],accent:p[(7+v)%9],metal:p[8],floor:v===3?'Warm concrete':v===4?'Terrazzo':'Natural oak',drywall:v%3===0?'Fine orange peel':v%3===1?'Limewash':'Knockdown',description:family+' materials, coordinated upholstery, lighting and wood tones.'}}));
export type TrimPackage={name:string;baseHeight:number;casingWidth:number;crown:number;chairRail:number;panels:boolean;profile:number;basePrice:number;casingPrice:number;crownPrice:number};
export const trimPackages:TrimPackage[]=[
 ['Minimal shadow line',.17,.17,0,0,false,0,1.5,1.8,0],['Modern square',.42,.25,0,0,false,1,2.4,2.5,0],['Craftsman layered',.55,.38,.25,0,false,2,3.4,3.8,3.1],['Colonial ogee',.5,.3,.3,0,false,3,3,3.5,3.6],['Georgian grand',.67,.42,.45,.25,true,4,4.5,5,5.5],['Victorian ornate',.75,.48,.5,.3,true,5,5.2,6,6.2],['Art Deco stepped',.5,.35,.33,.25,false,6,3.6,4.5,4.2],['French panelled',.6,.4,.4,.3,true,7,4.1,4.8,5],['Coastal beadboard',.48,.3,.25,.2,true,8,3.1,3.3,3],['Rustic timber',.58,.4,.25,0,false,9,4,4.4,3.8],
].map(([name,baseHeight,casingWidth,crown,chairRail,panels,profile,basePrice,casingPrice,crownPrice])=>({name,baseHeight,casingWidth,crown,chairRail:0,panels:false,profile,basePrice,casingPrice,crownPrice})) as TrimPackage[];
export type HomeStyle={name:string;cladding:string;pitch:number;trim:string;roof:string;siding:string;exteriorTrim:string;feature:string;porch:boolean;shutters:boolean;windowGrid:number;price:number};
export const homeStyles:HomeStyle[]=[
 ['Contemporary','Standing seam metal',5,'Modern square','#343b3c','#53605b','#252f31','clean',false,false,0,0],
 ['Georgian','Brick veneer',7,'Georgian grand','#373d3f','#8c6652','#c4bcab','pediment',true,true,6,2700],
 ['Victorian','Painted lap siding',8,'Victorian ornate','#47555a','#748580','#c3b49d','gingerbread',true,false,4,3300],
 ['Modern farmhouse','Board & batten siding',6,'Modern square','#353a3a','#a7a498','#414a45','farmhouse',true,true,4,1900],
 ['Craftsman','Wood lap siding',5,'Craftsman layered','#4b5146','#67725e','#806b4f','brackets',true,false,3,2600],
 ['Tudor','Stucco & timber',8,'Rustic timber','#41433e','#b4aa91','#594836','timber',false,false,4,2900],
 ['Cape Cod','Cedar shingles',7,'Colonial ogee','#47514b','#8d9485','#c7c1ad','cape',false,true,6,1700],
 ['Colonial','Painted lap siding',7,'Colonial ogee','#454a48','#939e9b','#c7bfa9','pediment',true,true,6,2200],
 ['French country','Stone veneer',8,'French panelled','#53574b','#a2957c','#6c725e','french',true,true,4,3100],
 ['Scandinavian','Vertical timber siding',6,'Minimal shadow line','#373d40','#8b7257','#343d3e','scandi',false,false,0,900],
 ['Mid-century','Wood lap siding',4,'Modern square','#474c48','#89755b','#39493f','midcentury',false,false,0,1500],
 ['Ranch','Horizontal metal',4,'Modern square','#414847','#817970','#b5aa94','ranch',true,true,2,1200],
 ['English cottage','Stone veneer',8,'Rustic timber','#5d594f','#978d77','#6c7158','cottage',true,false,4,2400],
 ['Coastal','Painted lap siding',6,'Coastal beadboard','#626e72','#91a7aa','#c7c8b6','coastal',true,true,4,2000],
 ['Industrial','Corrugated metal',4,'Minimal shadow line','#363f43','#636b6a','#343e40','industrial',false,false,0,1300],
].map(([name,cladding,pitch,trim,roof,siding,exteriorTrim,feature,porch,shutters,windowGrid,price])=>({name,cladding,pitch,trim,roof,siding,exteriorTrim,feature,porch,shutters,windowGrid,price})) as HomeStyle[];
export const wallpapers=[{name:'Midnight damask',file:'01-midnight-damask.png',price:3.9},{name:'Botanical silk',file:'02-botanical-silk.png',price:3.2},{name:'Copper Deco',file:'03-copper-deco.png',price:4.2},{name:'Peacock chinoiserie',file:'04-peacock-chinoiserie.png',price:5.4},{name:'Heritage floral',file:'05-heritage-floral.png',price:4.1},{name:'Linen toile',file:'06-linen-toile.png',price:4.3},{name:'Teal lattice',file:'07-teal-lattice.png',price:3.4},{name:'Marble filigree',file:'08-marble-filigree.png',price:4.8},{name:'Plum baroque',file:'09-plum-baroque.png',price:5.1},{name:'Blue medallion',file:'10-blue-medallion.png',price:3.8}];
export const getInterior=(name:string)=>interiorSchemes.find(x=>x.name===name)||interiorSchemes[0];
export const getTrim=(name:string)=>trimPackages.find(x=>x.name===name)||trimPackages[1];
export const getHomeStyle=(name:string)=>homeStyles.find(x=>x.name===name)||homeStyles[0];
export const claddingPrices:Record<string,number>={'Standing seam metal':4.5,'Corrugated metal':2.8,'Horizontal metal':3.8,'Brick veneer':9,'Painted lap siding':4.8,'Board & batten siding':5.1,'Wood lap siding':5.4,'Stucco & timber':7.8,'Cedar shingles':6.4,'Stone veneer':12,'Vertical timber siding':5.3};
