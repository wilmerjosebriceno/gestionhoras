const { Pool } = require('pg');
(async () => {
  const p = new Pool({ host: 'localhost', port: 5434, user: 'postgres', password: '11786822', database: 'V5' });
  try {
    await p.query("ALTER TABLE sec_sistema ADD COLUMN IF NOT EXISTS descripcion VARCHAR(255)");
    console.log('1. sec_sistema.descripcion ok');
  } catch(e) { console.log('1. sec_sistema.descripcion:', e.message); }
  try {
    await p.query("ALTER TABLE sec_sistema ADD COLUMN IF NOT EXISTS ruta VARCHAR(40)");
    console.log('2. sec_sistema.ruta ok');
  } catch(e) { console.log('2. sec_sistema.ruta:', e.message); }
  try {
    await p.query("ALTER TABLE sec_sistema ADD COLUMN IF NOT EXISTS estatus INT DEFAULT 1");
    console.log('3. sec_sistema.estatus ok');
  } catch(e) { console.log('3. sec_sistema.estatus:', e.message); }

  // Seed de modulos por defecto
  const modulos = [
    ['SFV', 'Comercial', 'Facturación, ventas y cuentas por cobrar', '/sfv', 1],
    ['SIV', 'Inventario', 'Control de inventario y almacenes', '/siv', 1],
    ['LAB', 'Laboratorio', 'Gestión de análisis de laboratorio', '/lab', 1],
    ['SEC', 'Seguridad', 'Control de perfiles, accesos de usuarios y log de transacciones', '/sec', 1],
  ];
  for (const [codigo, denominacion, descripcion, ruta, estatus] of modulos) {
    const ex = await p.query('SELECT 1 FROM sec_sistema WHERE sistema = $1', [codigo]);
    if (ex.rowCount === 0) {
      await p.query(
        'INSERT INTO sec_sistema (id_sistema, sistema, denominacion, descripcion, ruta, estatus) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [codigo, denominacion, descripcion, ruta, estatus]
      );
      console.log(`Modulo ${codigo} creado`);
    } else {
      await p.query(
        'UPDATE sec_sistema SET denominacion=$2, descripcion=$3, ruta=$4, estatus=$5 WHERE sistema=$1',
        [codigo, denominacion, descripcion, ruta, estatus]
      );
      console.log(`Modulo ${codigo} actualizado`);
    }
  }

  const r = await p.query("SELECT sistema, denominacion, ruta, estatus FROM sec_sistema ORDER BY denominacion");
  r.rows.forEach(c => console.log(`  ${c.sistema} | ${c.denominacion} | ${c.ruta} | estatus=${c.estatus}`));
  await p.end();
})();