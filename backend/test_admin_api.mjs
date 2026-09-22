import http from 'node:http';

const post = (p, d) => new Promise((resolve, reject) => {
  const s = JSON.stringify(d);
  const req = http.request({ hostname: 'localhost', port: 3000, path: p, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) } },
    (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })) });
  req.on('error', reject); req.write(s); req.end();
});
const get = (p, tok) => new Promise((resolve, reject) => {
  const h = tok ? { Authorization: 'Bearer ' + tok } : {};
  const req = http.request({ hostname: 'localhost', port: 3000, path: p, headers: h },
    (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })) });
  req.on('error', reject); req.end();
});

(async () => {
  const login = await post('/api/auth/login', { email: 'admin@example.com', password: 'Admin123*' });
  console.log('LOGIN status:', login.status, '| raw body:', login.body.substring(0, 800));
  const l = JSON.parse(login.body);
  const token = l.token || l.accessToken || (l.data && (l.data.token || l.data.accessToken)) || '';
  console.log('TOKEN encontrado len=', token.length, '| usuario_login=', l.usuario?.usuario_login || l.usuario?.usuarioLogin || l.user?.username);

  const m = await get('/api/admin/tables', token);
  const meta = JSON.parse(m.body);
  console.log('[2] GET /api/admin/tables:', m.status, 'tablas=', meta.tables?.length, 'fks=', meta.foreignKeys?.length, 'cols=', meta.columns?.length, 'pks=', meta.primaryKeys?.length);
  if (m.status !== 200) console.log('  -> ', m.body);
  else {
    console.log('   Tablas (prim/últ):', meta.tables.slice(0, 3).map(t => t.tableName), '...', meta.tables.slice(-3).map(t => t.tableName));
    console.log('   AUDITORIA_LOG protected:', meta.tables.find(t => t.tableName === 'AUDITORIA_LOG')?.protected);
  }
  const p = await get('/api/admin/tables/PRODUCTOS?skip=0&take=3', token);
  const pr = JSON.parse(p.body);
  console.log('[3] GET /api/admin/tables/PRODUCTOS:', p.status, 'total=', pr.total, 'rows=', pr.data?.length);
  if (p.status === 200) pr.data.forEach(r => console.log('   ID=', r.ID_Producto, '|', r.Nombre_Producto?.substring(0, 28), '|Tipo=', r.Tipo_Producto, '|Costo=', r.Costo_Base));

  const body = { where: { ID_Producto: 3 }, data: { Costo_Base: 99999 } };
  const patchReq = (pp, dd) => new Promise((resolve, reject) => {
    const s = JSON.stringify(dd);
    const req = http.request({ hostname: 'localhost', port: 3000, path: pp, method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s), Authorization: 'Bearer ' + token } },
      (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })) });
    req.on('error', reject); req.write(s); req.end();
  });
  const upd = await patchReq('/api/admin/tables/PRODUCTOS', body);
  const u = JSON.parse(upd.body);
  console.log('[4] PATCH PRODUCTOS ID=3 Costo=99999:', upd.status, u.ok ? 'OK Costo=' + u.row?.Costo_Base : u.message);

  const restore = await patchReq('/api/admin/tables/PRODUCTOS', { where: { ID_Producto: 3 }, data: { Costo_Base: 0 } });
  const res2 = JSON.parse(restore.body);
  console.log('[5] RESTAURAR Costo=0:', restore.status, res2.ok ? 'OK Costo=' + res2.row?.Costo_Base : res2.message);
})();
