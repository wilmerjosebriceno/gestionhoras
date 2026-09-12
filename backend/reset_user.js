const { Pool } = require('pg');
(async () => {
  const p = new Pool({ host: 'localhost', port: 5434, user: 'postgres', password: '11786822', database: 'V5' });
  await p.query("UPDATE sec_user SET intentos_fallidos=0, bloqueado_hasta=null, refresh_token='' WHERE logins='SOFTBRI'");
  const r = await p.query('SELECT logins,intentos_fallidos,bloqueado_hasta FROM sec_user');
  console.log(JSON.stringify(r.rows));
  await p.end();
})();
