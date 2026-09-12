const { Pool } = require('pg');
(async () => {
  const p = new Pool({ host: 'localhost', port: 5434, user: 'postgres', password: '11786822', database: 'V5' });
  try {
    // Change pagina from uuid to varchar in sec_acceso_user
    await p.query("ALTER TABLE sec_acceso_user ALTER COLUMN pagina TYPE VARCHAR(100) USING pagina::varchar");
    console.log('1. sec_acceso_user.pagina changed to VARCHAR(100)');
  } catch(e) {
    console.log('1. sec_acceso_user.pagina:', e.message);
  }
  try {
    // Add pagina column to sec_acceso_grupo
    await p.query("ALTER TABLE sec_acceso_grupo ADD COLUMN pagina VARCHAR(100)");
    console.log('2. sec_acceso_grupo.pagina added');
  } catch(e) {
    console.log('2. sec_acceso_grupo.pagina:', e.message);
  }
  try {
    // Add sistema column to sec_acceso_user (optional, for direct lookup)
    // Actually it already has id_sistema (uuid), we need the sistema code too for legacy compatibility
    await p.query("ALTER TABLE sec_acceso_user ADD COLUMN IF NOT EXISTS sistema_code VARCHAR(4)");
    console.log('3. sec_acceso_user.sistema_code added');
  } catch(e) {
    console.log('3. sec_acceso_user.sistema_code:', e.message);
  }
  try {
    await p.query("ALTER TABLE sec_acceso_grupo ADD COLUMN IF NOT EXISTS sistema_code VARCHAR(4)");
    console.log('4. sec_acceso_grupo.sistema_code added');
  } catch(e) {
    console.log('4. sec_acceso_grupo.sistema_code:', e.message);
  }
  // Verify
  const r = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('sec_acceso_user','sec_acceso_grupo') ORDER BY table_name, ordinal_position");
  console.log('\nFinal schema:');
  r.rows.forEach(c => console.log(`  ${c.table_name}.${c.column_name} (${c.data_type})`));
  await p.end();
})();
