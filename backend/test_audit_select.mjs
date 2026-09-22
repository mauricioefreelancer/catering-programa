import http from 'node:http';
const jsonPost = (port, path, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const req = http.request({ hostname: 'localhost', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    (res) => { let buf = ''; res.on('data', c => buf += c); res.on('end', () => tryParse(res, buf, resolve, reject)); });
  req.on('error', reject); req.write(data); req.end();
});
const jsonGet = (port, path, token) => new Promise((resolve, reject) => {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const req = http.request({ hostname: 'localhost', port, path, method: 'GET', headers },
    (res) => { let buf = ''; res.on('data', c => buf += c); res.on('end', () => tryParse(res, buf, resolve, reject)); });
  req.on('error', reject); req.end();
});
function tryParse(res, buf, resolve, reject) {
  try { resolve({ status: res.statusCode, data: buf.length ? JSON.parse(buf) : null, raw: buf.slice(0,400) }); }
  catch (e) { reject(new Error('HTTP ' + res.statusCode + ' PARSE: ' + buf.slice(0,300))); }
}

try {
  const login = await jsonPost(3000, '/api/auth/login', { email: 'admin@example.com', password: 'Admin123*' });
  console.log('[1] Login:', login.status, 'tokenLen=', login.data?.accessToken?.length);
  const tok = login.data.accessToken;

  const list = await jsonGet(3000, '/api/admin/tables', tok);
  console.log('[2] List Tables:', list.status, 'tables=', list.data?.tables?.length, 'fks=', list.data?.foreignKeys?.length);
  const auditMeta = list.data.tables.find(t => t.tableName === 'AUDITORIA_LOG');
  console.log('    AUD meta:', JSON.stringify(auditMeta));

  const prod = await jsonGet(3000, '/api/admin/tables/PRODUCTOS?skip=0&take=3&search=', tok);
  console.log('[3] PRODUCTOS select:', prod.status, 'rows=', prod.data?.data?.length, 'total=', prod.data?.total);

  const aud = await jsonGet(3000, '/api/admin/tables/AUDITORIA_LOG?skip=0&take=50&search=', tok);
  console.log('[4] AUDITORIA_LOG select:', aud.status, 'rows=', aud.data?.data?.length, 'total=', aud.data?.total);
  if (aud.status === 200 && aud.data?.data?.length) {
    for (let i = 0; i < 5; i++) {
      const r = aud.data.data[i];
      const det = typeof r.Detalle_Cambios === 'object' ? JSON.stringify(r.Detalle_Cambios).slice(0,80) : String(r.Detalle_Cambios).slice(0,80);
      console.log('    [' + r.ID_Log + '] ' + r.Accion + ' ' + r.Tabla_Afectada + '  Detalle=' + det);
    }
    console.log('\n✅ TEST PASSED');
    process.exit(0);
  } else {
    console.log('❌ RAW first 600 chars:', aud.raw);
    process.exit(1);
  }
} catch (e) {
  console.error('❌ TEST ERROR:', e.message);
  process.exit(1);
}
