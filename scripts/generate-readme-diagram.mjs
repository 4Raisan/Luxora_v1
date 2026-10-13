import fs from 'node:fs';

// Reuse the original diagram's brand artwork without regenerating logo text.
const original = fs.readFileSync(new URL('../docs/assets/Luxora-HAD.jpg', import.meta.url)).toString('base64');
const brand = (x, y, w, h, sx, sy, sw, sh) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}"><use href="#brand-source"/></svg>`;

const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x, y, value, size = 20, weight = 400, fill = '#14254a') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escape(value)}</text>`;
const panel = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="#d5ddeb"/>`;
const lines = (x, y, list, gap = 32) => list.map((s, i) => text(x, y + i * gap, s, 18)).join('');
const arrow = (path) => `<path d="${path}" fill="none" stroke="#14254a" stroke-width="2.5" marker-end="url(#arrow)"/>`;
const person = (x, y) => `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="#17202b" stroke-width="3"/><path d="M${x-20} ${y+38}q0-25 20-25t20 25z" fill="none" stroke="#17202b" stroke-width="3"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1740 940" role="img" aria-labelledby="title desc">
<title id="title">Luxora high level architecture</title><desc id="desc">React and Vite on Vercel, Express on Northflank, Supabase PostgreSQL through Prisma, PayHere, NOWPayments, Resend and Cloudflare R2. Customer, Admin and Provider portals.</desc>
<defs><image id="brand-source" width="1740" height="904" href="data:image/jpeg;base64,${original}"/><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L8 5L0 10" fill="none" stroke="#14254a" stroke-width="1.5"/></marker></defs>
<rect width="1740" height="940" fill="white"/><g font-family="Arial, sans-serif">
${text(28,62,'LUXORA',56,700)}${text(28,102,'High Level Architecture',30)}
${panel(1410,15,300,88,'#eaf4ff')}${text(1435,52,'Production Environment',23,700)}${text(1500,83,'luxora.bond',20)}
${panel(30,150,220,510,'#f5f6fc')}${text(55,193,'Users',25,700)}
${person(140,240)}${text(82,310,'Customers',21,700)}${text(51,341,'Packages and bookings',16)}
${person(140,395)}${text(106,465,'Admin',21,700)}${text(66,496,'Manage platform',17)}
${person(140,550)}${text(87,620,'Providers',21,700)}${text(81,647,'Fulfil services',17)}
${panel(340,145,340,515,'#ddfbef')}${text(362,187,'Frontend (Vercel)',25,700)}
<path d="M380 263l24-42 24 42z" fill="#111"/>${text(446,258,'Vercel',34,700)}
${panel(360,283,300,355,'#ffffff')}
<g transform="translate(399 327)" stroke="#00a9d0" fill="none" stroke-width="2.5"><ellipse rx="29" ry="11"/><ellipse rx="29" ry="11" transform="rotate(60)"/><ellipse rx="29" ry="11" transform="rotate(120)"/><circle r="4" fill="#00a9d0"/></g>${text(439,335,'React + Vite',26,700)}
${lines(382,378,['• Service packages','• Bookings and checkout','• Customer dashboard','• Provider dashboard','• Admin dashboard'])}
${panel(795,145,390,515,'#e7f3ff')}${text(815,187,'Backend (Northflank)',25,700)}${brand(838,204,280,61,840,203,280,61)}
${panel(812,280,355,360,'#ffffff')}${brand(834,293,59,66,840,286,68,75)}${text(903,333,'Node.js (Express)',24,700)}
${lines(835,371,['• Authentication (JWT)','• Bookings and subscriptions','• PayHere / NOWPayments / Demo','• Email (Resend)','• File storage (Cloudflare R2)','• Role and KYC checks','• Admin APIs','• Rate limits (local / optional Redis)','• Realtime (SSE)'],29)}
${panel(1340,135,370,155,'#f5f6fc')}${text(1360,171,'Payment Providers',25,700)}${panel(1360,185,330,87,'#ffffff')}${brand(1375,202,170,54,1370,205,180,57)}${brand(1571,193,113,72,1580,194,122,77)}
${panel(1340,310,370,130,'#f5f6fc')}${text(1360,349,'Email Service',25,700)}${panel(1360,365,330,58,'#ffffff')}${brand(1420,370,47,44,1432,363,55,51)}${text(1480,407,'Resend',34,700,'#111111')}
${panel(1340,460,370,135,'#f5f6fc')}${text(1360,498,'File Storage (S3 Compatible)',22,700)}${panel(1360,513,330,62,'#ffffff')}${brand(1400,514,265,58,1394,495,296,65)}
${arrow('M250 435H338')}${text(260,418,'HTTPS',17)}${arrow('M680 390H792')}${text(690,350,'API Requests',16)}${text(705,375,'(HTTPS)',16)}${arrow('M795 475H683')}${text(690,506,'JSON / SSE',16)}
${arrow('M1185 251H1335')}${text(1200,220,'Payment APIs',17)}${text(1230,241,'(HTTPS)',16)}${arrow('M1185 386H1335')}${text(1220,358,'Email API',17)}${arrow('M1185 535H1335')}${text(1200,508,'Object Storage',17)}
${arrow('M930 660V735')}${text(744,698,'Prisma · Runtime queries',18)}${text(771,722,'DATABASE_URL',17)}${arrow('M1010 735V662')}${text(1030,698,'Schema migrations',18)}${text(1030,722,'DIRECT_URL',17)}
${panel(500,740,870,150,'#f3ebff')}${text(525,779,'Database (Supabase PostgreSQL)',25,700)}
<g fill="#7642b3"><ellipse cx="557" cy="815" rx="22" ry="9"/><path d="M535 816v17q22 17 44 0v-17q-22 17-44 0m0 20v17q22 17 44 0v-17q-22 17-44 0"/></g><path d="M614 851l30-49h-28l-20 35h23l-5 14z" fill="#3ecf8e"/>${text(654,843,'supabase',32,700,'#15352b')}
${lines(910,806,['• Users and providers','• Bookings and subscriptions','• Payments and refunds'],28)}${lines(1170,806,['• KYC and payouts','• Notifications','• Other application data'],28)}
${text(550,925,'Knowledge Graph and Architecture Explorer: GitHub Pages (generated from code)',19)}
</g></svg>`;
fs.writeFileSync(new URL('../docs/assets/luxora-readme-architecture.svg', import.meta.url), svg);
