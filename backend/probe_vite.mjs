import http from 'node:http';
const req = http.get('http://localhost:5173/src/pages/Admin/DataPanel/index.tsx', (res) => {
  console.log('STATUS', res.statusCode);
  console.log('CONTENT-TYPE', res.headers['content-type']);
  let b = '';
  res.setEncoding('utf8');
  res.on('data', c => b += c);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      const idx = b.indexOf('<pre');
      const idx2 = b.indexOf('</pre>');
      if (idx >= 0 && idx2 > idx) console.log('\n--- VITE ERROR ---\n' + b.substring(idx, idx2 + 6).replace(/<[^>]+>/g, ''));
      else console.log(b.substring(0, 5000));
    } else {
      console.log('OK bytes=', b.length);
    }
  });
});
req.on('error', e => console.log('CONN_ERR', e.code, e.message));
