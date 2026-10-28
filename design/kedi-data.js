(function(){
const NOW=Date.UTC(2026,9,28,15,0),DAY=864e5,HR=36e5,MIN=6e4;
const ago=(d,h=0,m=0)=>NOW-d*DAY-h*HR-m*MIN;
const ts=s=>s==null||s===''?null:typeof s==='number'?s:Date.parse(s.length<=10?s+'T12:00:00Z':s);
const fd=s=>s==null||s===''?'—':new Date(ts(s)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const fdt=s=>s==null?'—':new Date(ts(s)).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC'});
const iso=t=>new Date(t).toISOString().slice(0,10);
const RTF=new Intl.RelativeTimeFormat('en',{numeric:'always'});
const rel=s=>{const d=(ts(s)-NOW)/1000,a=Math.abs(d);if(a<45)return 'just now';for(const [l,u,v] of [[3600,'minute',60],[86400,'hour',3600],[604800,'day',86400],[2629800,'week',604800],[31557600,'month',2629800],[1e12,'year',31557600]])if(a<l)return RTF.format(Math.round(d/v)||(d<0?-1:1),u);};
const money=c=>(c<0?'-':'')+'$'+(Math.abs(c)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const CMP=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const compact=c=>CMP.format(c/100);
const size=b=>b<1024?b+' B':b<1048576?(+(b/1024).toFixed(1))+' KB':(+(b/1048576).toFixed(1))+' MB';
const lab=s=>s?s.split('_').map(w=>w[0]+w.slice(1).toLowerCase()).join(' '):'';
const TONE={LEAD:'amber',MEDIUM:'amber',ACTIVE:'emerald',DONE:'emerald',PAID:'emerald',INACTIVE:'slate',ARCHIVED:'slate',TODO:'slate',DRAFT:'slate',VOID:'slate',LOW:'slate',ADMIN:'slate',PLANNING:'sky',IN_PROGRESS:'sky',SENT:'sky',MEMBER:'sky',ON_HOLD:'orange',COMPLETED:'indigo',CANCELLED:'rose',OVERDUE:'rose',HIGH:'rose',SUPER_ADMIN:'violet'};
const badge=s=>{const t=TONE[s]||'slate';return {label:lab(s),f:`var(--${t}-f)`,d:`var(--${t}-d)`,b:`var(--${t}-b)`};};
const ini=n=>{const w=(n||'?').trim().split(/\s+/);return (w.length>1?w[0][0]+w[w.length-1][0]:w[0].slice(0,2)).toUpperCase();};
const plural=(n,s,p)=>n+' '+(n===1?s:(p||s+'s'));
const RANK={SUPER_ADMIN:3,ADMIN:2,MEMBER:1,CLIENT:0};
const PWC='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const genPw=()=>Array.from({length:16},()=>PWC[Math.floor(Math.random()*PWC.length)]).join('');
const eff=i=>['PAID','VOID','DRAFT'].includes(i.status)?i.status:ts(i.due)<NOW?'OVERDUE':i.status;
const tot=i=>{const sub=i.lines.reduce((s,l)=>s+Math.round(l.q*l.p),0),tax=Math.round(sub*i.tax/100);return {sub,tax,total:sub+tax};};
const buckets=invs=>{const b={billed:0,paid:0,out:0,over:0,overN:0};for(const i of invs){const e=eff(i),t=tot(i).total;if(e!=='DRAFT'&&e!=='VOID')b.billed+=t;if(e==='PAID')b.paid+=t;if(e==='SENT'||e==='OVERDUE')b.out+=t;if(e==='OVERDUE'){b.over+=t;b.overN++;}}return b;};
const CAT={PORTAL_ACCESS_GRANTED:'access',PORTAL_ACCESS_REVOKED:'access',PORTAL_PASSWORD_RESET:'access',TEAM_MEMBER_ADDED:'access',TEAM_MEMBER_REMOVED:'access',TEAM_ROLE_CHANGED:'access',TEAM_PASSWORD_RESET:'access',CLIENT_DELETED:'del',PROJECT_DELETED:'del',INVOICE_DELETED:'del',FILE_SHARED:'files',FILE_RECEIVED:'files'};
const CATL={work:'Client work',access:'Accounts & access',del:'Deletions',files:'Files'};
const CATT={work:'slate',access:'violet',del:'rose',files:'sky'};
const cat=t=>CAT[t]||'work';

function seed(){
const users=[
{id:'u1',name:'Maya Okafor',email:'maya@kedi.studio',role:'SUPER_ADMIN',last:ago(0,1),created:ago(720)},
{id:'u2',name:'Priya Shah',email:'priya@kedi.studio',role:'ADMIN',last:ago(0,3),created:ago(540)},
{id:'u5',name:'Sam Adeyemi',email:'sam@kedi.studio',role:'ADMIN',last:ago(4),created:ago(380)},
{id:'u3',name:'Tom Reyes',email:'tom@kedi.studio',role:'MEMBER',last:ago(1,2),created:ago(260)},
{id:'u4',name:'Lena Fischer',email:'lena@kedi.studio',role:'MEMBER',last:null,created:ago(5)}];
const C=(id,name,company,industry,status,city,state,owner,days,x={})=>({id,name,company,industry,status,city,state,country:'United States',owner,created:ago(days),email:x.email||null,phone:x.phone||null,website:x.web||null,addressLine:x.addr||null,postalCode:x.zip||null,notes:x.notes||null});
const clients=[
C('c1','Northwind Logistics','Northwind Logistics Inc.','Logistics','ACTIVE','Chicago','IL','u2',420,{email:'hello@northwind.co',phone:'(312) 555-0148',web:'https://northwind.co',addr:'400 W Lake St, Suite 900',zip:'60606',notes:'Prefers Friday status calls. Marcus handles PO numbers.'}),
C('c2','Halden & Rowe','Halden & Rowe LLP','Legal','ACTIVE','Boston','MA','u1',300,{email:'office@haldenrowe.com',phone:'(617) 555-0190',web:'https://haldenrowe.com',addr:'88 Federal St',zip:'02110'}),
C('c3','Larkspur Dental','','Healthcare','ACTIVE','Austin','TX','u3',200,{email:'front@larkspurdental.com',phone:'(512) 555-0122'}),
C('c4','Pinecrest Outfitters','Pinecrest Outdoor Co.','Retail','ACTIVE','Denver','CO','u3',150,{email:'ops@pinecrest.co',web:'https://pinecrest.co'}),
C('c5','Oduya Studio','','Design','LEAD','Brooklyn','NY','u2',6,{email:'ife@oduya.studio'}),
C('c6','Marlow Bakehouse','','Food & Beverage','ACTIVE','Portland','OR','u1',3,{email:'clara@marlowbakehouse.com',phone:'(503) 555-0177'}),
C('c7','Teller & Finch','Teller & Finch Advisors','Finance','LEAD','Charlotte','NC',null,9,{email:'grant@tellerfinch.com'}),
C('c8','Brightwater Clinics','','Healthcare','INACTIVE','Phoenix','AZ','u5',600),
C('c9','Quarry Lane Books','','Retail','ACTIVE','Madison','WI','u2',240,{email:'nora@quarrylane.com'}),
C('c10','Solano Vineyards','Solano Family Wines','Food & Beverage','ACTIVE','Napa','CA','u5',330,{web:'https://solanovineyards.com'}),
C('c11','Kestrel Aero','','Aerospace','LEAD','Wichita','KS','u3',12),
C('c12','Ferro Fabrication','','Manufacturing','ARCHIVED','Cleveland','OH','u5',900),
C('c13','Juniper Health Co-op','','Healthcare','ACTIVE','Minneapolis','MN','u1',110,{email:'ravi@juniperhealth.org'}),
C('c14','Atlas Rowing Club','','','INACTIVE','Seattle','WA','u3',700)];
const K=(id,client,first,last,title,email,phone,primary)=>({id,client,first,last,title,email,phone,primary:!!primary});
const contacts=[
K('k1','c1','Dana','Whitfield','Head of Operations','dana@northwind.co','(312) 555-0161',1),K('k2','c1','Marcus','Lee','IT Director','marcus@northwind.co',null),K('k3','c1','Ana','Ruiz','Dispatch Lead','ana@northwind.co',null),
K('k4','c2','Eleanor','Rowe','Managing Partner','eleanor@haldenrowe.com','(617) 555-0191',1),K('k5','c2','James','Halden','Partner','james@haldenrowe.com',null),
K('k6','c3','Kim','Nguyen','Practice Owner','kim@larkspurdental.com',null,1),K('k7','c3','Becca','Moss','Office Manager','becca@larkspurdental.com',null),
K('k8','c4','Owen','Park','COO','owen@pinecrest.co','(720) 555-0102',1),K('k9','c4','Jess','Tan','Ecommerce Manager','jess@pinecrest.co',null),K('k10','c4','Luis','Ortega','Merchandising',null,null),
K('k11','c5','Ife','Oduya','Founder','ife@oduya.studio',null,1),
K('k12','c6','Clara','Marlow','Owner','clara@marlowbakehouse.com','(503) 555-0177',1),K('k13','c6','Ben','Ito','Operations',null,null),
K('k14','c7','Grant','Teller','Principal','grant@tellerfinch.com',null,1),K('k15','c8','Ruth','Abara','Clinic Director',null,null,1),
K('k16','c9','Nora','Lind','Owner','nora@quarrylane.com',null,1),K('k17','c10','Marco','Solano','Winemaker','marco@solanovineyards.com',null,1),
K('k18','c11','Dee','Kaplan','VP Marketing','dee@kestrelaero.com',null,1),K('k19','c13','Ravi','Menon','Member Services','ravi@juniperhealth.org',null,1)];
const P=(id,client,name,description,status,budget,start,end,live,days)=>({id,client,name,description,status,budget:budget*100,start,end,live,created:ago(days)});
const projects=[
P('p1','c1','Fleet tracking portal','Web portal for dispatchers to see every vehicle live.','ACTIVE',48000,'2026-07-01','2026-12-15','https://fleet.northwind.co',120),
P('p2','c1','Driver onboarding app','Mobile onboarding with document upload and checks.','ACTIVE',36000,'2026-09-14','2027-02-26',null,46),
P('p3','c1','Route map refresh','Updated depot and route maps for print and web.','PLANNING',8000,null,'2027-01-15',null,10),
P('p4','c2','Brand & website relaunch','New identity and a 12-page site.','ACTIVE',22000,'2026-08-03','2026-11-20','https://staging.haldenrowe.com',90),
P('p5','c3','Patient booking flow','Online booking with insurance pre-check.','ACTIVE',15000,'2026-09-01','2026-11-30',null,60),
P('p6','c4','Ecommerce replatform','Move the store to a new platform.','ON_HOLD',40000,'2026-05-10','2026-12-31',null,170),
P('p7','c4','Spring lookbook','Seasonal lookbook, print and web.','COMPLETED',6000,'2026-02-01','2026-03-20',null,270),
P('p8','c6','Menu & ordering site','','PLANNING',9500,'2026-11-09',null,null,3),
P('p9','c9','Events newsletter','Monthly events email and templates.','ACTIVE',4800,'2026-07-20',null,null,100),
P('p10','c10','Wine club portal','Member portal for club shipments.','ACTIVE',26000,'2026-06-01','2026-12-01',null,150),
P('p11','c13','Member intranet','','PLANNING',18000,null,null,null,40),
P('p12','c8','Clinic locator','','CANCELLED',7000,'2026-08-15','2026-10-30',null,80)];
const T=(id,title,status,priority,due,client,project,assignee,days,description,done)=>({id,title,status,priority,due,client,project,assignee,created:ago(days),description:description||null,completedAt:status==='DONE'?ago(done||10):null});
const tasks=[
T('t1','Send revised route map','TODO','HIGH','2026-10-24','c1','p3','u1',8,'Include the two new depots.'),
T('t2','Draft Q4 content calendar','IN_PROGRESS','MEDIUM','2026-10-27','c2','p4','u2',12),
T('t3','Review homepage copy','TODO','MEDIUM','2026-10-29','c3','p5','u1',6),
T('t4','Set up staging environment','IN_PROGRESS','HIGH','2026-10-30','c4','p6','u3',9),
T('t5','Collect brand assets','TODO','LOW','2026-11-03','c5',null,null,5),
T('t6','Invoice follow-up call','TODO','MEDIUM','2026-11-04','c6',null,'u2',2),
T('t7','Vehicle list view','DONE','MEDIUM','2026-08-15','c1','p1','u3',100,null,70),
T('t8','Live map integration','DONE','HIGH','2026-09-05','c1','p1','u3',90,null,55),
T('t9','Driver status alerts','IN_PROGRESS','HIGH','2026-11-06','c1','p1','u3',40),
T('t10','Dispatcher permissions','TODO','MEDIUM','2026-11-13','c1','p1','u3',40),
T('t11','Usage reports','TODO','LOW','2026-11-27','c1','p1','u1',40),
T('t12','Kickoff workshop','DONE','MEDIUM','2026-07-03','c1','p1','u2',118,null,115),
T('t13','Data import from TMS','DONE','HIGH','2026-08-01','c1','p1','u3',110,null,88),
T('t14','Login & SSO','DONE','HIGH','2026-10-20','c1','p1','u3',60,null,1),
T('t15','Mobile layout','DONE','MEDIUM','2026-10-10','c1','p1','u1',50,null,20),
T('t16','Accessibility pass','TODO','MEDIUM','2026-12-04','c1','p1',null,40),
T('t17','Launch checklist','TODO','MEDIUM','2026-12-11','c1','p1','u2',40),
T('t18','UAT with dispatchers','DONE','HIGH','2026-10-26','c1','p1','u2',40,null,3),
T('t19','User research interviews','DONE','MEDIUM','2026-09-25','c1','p2','u1',44,null,33),
T('t20','Onboarding flow wireframes','DONE','MEDIUM','2026-10-09','c1','p2','u3',44,null,19),
T('t21','Document upload prototype','DONE','HIGH','2026-10-21','c1','p2','u3',44,null,8),
T('t22','Visual design','IN_PROGRESS','MEDIUM','2026-11-12','c1','p2','u1',30),
T('t23','Background check integration','TODO','HIGH','2026-12-04','c1','p2','u3',30),
T('t24','Prepare proposal for Kestrel','TODO','MEDIUM','2026-11-06','c11',null,'u3',4),
T('t25','Tidy shared drive folder names','TODO','LOW',null,null,null,'u4',3),
T('t26','Insurance pre-check API','TODO','HIGH','2026-11-16','c3','p5','u3',20),
T('t27','Homepage design','DONE','MEDIUM','2026-10-02','c2','p4','u2',70,null,26)];
const L=(d,q,p)=>({d,q,p:Math.round(p*100)});
const I=(id,no,client,project,status,issue,due,paid,tax,lines,notes)=>({id,no,client,project,status,issue,due,paidAt:paid,tax,lines,notes:notes||null});
const invoices=[
I('i1','INV-1031','c1','p1','PAID','2026-05-02','2026-06-01','2026-05-28',0,[L('Discovery sprint',1,14000)]),
I('i2','INV-1032','c2','p4','PAID','2026-05-10','2026-06-09','2026-05-30',0,[L('Brand strategy',1,9500)]),
I('i3','INV-1033','c4','p7','PAID','2026-03-22','2026-04-21','2026-06-04',0,[L('Lookbook design & production',1,6000)]),
I('i4','INV-1034','c10','p10','PAID','2026-06-01','2026-07-01','2026-06-26',0,[L('Wine club portal deposit',1,13000)]),
I('i5','INV-1035','c1','p1','PAID','2026-07-01','2026-07-31','2026-07-24',0,[L('Build phase 1',1,16000)]),
I('i6','INV-1036','c3','p5','PAID','2026-07-15','2026-08-14','2026-08-12',0,[L('UX audit',1,4500)]),
I('i7','INV-1037','c9','p9','PAID','2026-08-01','2026-08-31','2026-08-20',8.5,[L('Newsletter templates',3,1200)]),
I('i8','INV-1038','c13',null,'PAID','2026-08-10','2026-09-09','2026-08-29',0,[L('Intranet discovery workshop',2,3250)]),
I('i9','INV-1039','c1','p2','PAID','2026-09-01','2026-10-01','2026-09-18',0,[L('Driver app research',1,12000),L('Clickable prototype',1,8400)]),
I('i10','INV-1040','c2','p4','PAID','2026-09-05','2026-10-05','2026-09-30',0,[L('Website design',1,11000)]),
I('i11','INV-1041','c10','p10','PAID','2026-09-20','2026-10-20','2026-10-10',0,[L('Wine club portal, milestone 2',1,13000)]),
I('i12','INV-1052','c13',null,'PAID','2026-10-01','2026-10-31','2026-10-28T14:48:00Z',0,[L('Intranet information architecture',1,5400)]),
I('i13','INV-1042','c1','p1','SENT','2026-09-14','2026-10-14',null,0,[L('Build phase 2',1,12800)],'PO 7781-B'),
I('i14','INV-1047','c2','p4','SENT','2026-09-22','2026-10-22',null,0,[L('Content production (hours)',25,170)]),
I('i15','INV-1051','c3','p5','SENT','2026-10-03','2026-11-02',null,8.5,[L('Booking flow build',1,5640)]),
I('i16','INV-1053','c4','p6','SENT','2026-10-13','2026-11-12',null,0,[L('Platform migration (hours)',40,235)]),
I('i17','INV-1055','c5',null,'SENT','2026-10-21','2026-11-20',null,0,[L('Brand workshop',1,2175)]),
I('i18','INV-1056','c1','p2','SENT','2026-10-26','2026-11-25',null,0,[L('Driver app visual design',1,5600)]),
I('i19','INV-1057','c6','p8','DRAFT','2026-10-28','2026-11-27',null,0,[L('Menu site discovery',1,3800)]),
I('i20','INV-1044','c8','p12','VOID','2026-09-01','2026-10-01',null,0,[L('Clinic locator deposit',1,3500)])];
const portalUsers=[{id:'pu1',client:'c1',name:'Dana Whitfield',email:'dana@northwind.co',last:ago(0,2),created:ago(300)},{id:'pu2',client:'c4',name:'Owen Park',email:'ops@pinecrest.co',last:null,created:ago(1)}];
const N=(id,client,body,author,d)=>({id,client,body,author,at:ago(d)});
const notes=[N('n1','c1','Dana confirmed the dispatcher UAT group: six people, starting Nov 10. They want SSO through Okta before launch.','u2',2),N('n2','c1','Marcus will send PO numbers for the driver app by end of month.','u1',9),N('n3','c2','Eleanor wants two homepage options at the next review.','u2',4)];
const F=(id,client,project,filename,mime,bytes,by,uploader,note,d)=>({id,client,project,filename,mime,bytes,by,uploader,note,at:ago(d)});
const files=[
F('f1','c1','p1','fleet-portal-wireframes.pdf','application/pdf',6396314,'STAFF','u3','Wireframes for review before Thursday.',9),
F('f2','c1','p3','route-map-v2.pdf','application/pdf',2516582,'STAFF','u1','Revised after the depot call.',2),
F('f3','c1','p2','driver-roster.xlsx','application/vnd.ms-excel',90112,'CLIENT','pu1','Current roster for onboarding tests.',0.04),
F('f4','c1',null,'brand-guidelines.pdf','application/pdf',12897484,'CLIENT','pu1',null,15),
F('f5','c1','p1','kickoff-notes.md','text/markdown',4301,'STAFF','u2',null,24),
F('f6','c2','p4','homepage-v3.png','image/png',1887437,'STAFF','u2','Latest homepage direction.',3),
F('f7','c3','p5','booking-flow-copy.docx','application/msword',47104,'STAFF','u1',null,5),
F('f8','c4','p6','product-export.csv','text/csv',3565158,'STAFF','u3','Full catalogue export.',20),
F('f9','c4',null,'q3-sales.xlsx','application/vnd.ms-excel',215040,'CLIENT','pu2',null,12),
F('f10','c10','p10','member-tiers.pdf','application/pdf',655360,'STAFF','u5',null,8)];
const A=(type,msg,client,actor,d,h=0,m=0)=>({type,msg,client,actor,at:ago(d,h,m)});
const activity=[
A('INVOICE_STATUS_CHANGED','Invoice INV-1052 was marked paid','c13','u2',0,0,12),
A('FILE_RECEIVED','Dana Whitfield sent driver-roster.xlsx','c1','pu1',0,1),
A('CLIENT_STATUS_CHANGED','Marlow Bakehouse moved from LEAD to ACTIVE','c6','u1',0,3),
A('PORTAL_ACCESS_GRANTED','Portal access granted to ops@pinecrest.co','c4','u3',1),
A('TASK_COMPLETED','Task "Login & SSO" was completed','c1','u3',1,2),
A('PROJECT_DELETED','Project "Spring catalogue" was deleted','c4','u2',2),
A('NOTE_ADDED','Note added on Northwind Logistics','c1','u2',2,1),
A('FILE_SHARED','Maya Okafor shared route-map-v2.pdf','c1','u1',2,3),
A('INVOICE_CREATED','Invoice INV-1056 was created','c1','u2',2,5),
A('TASK_COMPLETED','Task "UAT with dispatchers" was completed','c1','u2',3),
A('PROJECT_CREATED','Project "Menu & ordering site" was created','c6','u1',3,2),
A('CONTACT_ADDED','Ben Ito was added to Marlow Bakehouse','c6','u1',3,3),
A('CLIENT_CREATED','Marlow Bakehouse was added','c6','u1',3,4),
A('TEAM_MEMBER_ADDED','Lena Fischer joined as Member',null,'u2',5),
A('CLIENT_CREATED','Oduya Studio was added','c5','u2',6),
A('INVOICE_CREATED','Invoice INV-1055 was created','c5','u2',7),
A('TEAM_ROLE_CHANGED','Sam Adeyemi is now Admin',null,'u1',12),
A('CLIENT_DELETED','Client "Garnet Labs" was deleted',null,'u5',18),
A('PORTAL_PASSWORD_CHANGED','Dana Whitfield changed their portal password','c1','pu1',20),
A('INVOICE_STATUS_CHANGED','Invoice INV-1041 was marked paid','c10','u5',18,2),
A('PROJECT_STATUS_CHANGED','Ecommerce replatform moved from ACTIVE to ON_HOLD','c4','u3',25),
A('TEAM_PASSWORD_RESET','Password reset for Tom Reyes',null,'u2',40)].map((a,i)=>({...a,id:'a'+i}));
return {users,clients,contacts,projects,tasks,invoices,portalUsers,notes,files,activity};
}
function emptySeed(){const s=seed();return {users:s.users.slice(0,1),clients:[],contacts:[],projects:[],tasks:[],invoices:[],portalUsers:[],notes:[],files:[],activity:[]};}
window.KEDI={NOW,DAY,ago,ts,fd,fdt,iso,rel,money,compact,size,lab,badge,ini,plural,RANK,genPw,eff,tot,buckets,cat,CATL,CATT,seed,emptySeed};
})();
