const { Client } = require('pg');

const passwords = ['9381400vkV', '9381400vkV#', '9381400vkV%23'];
const hosts = [
  'aws-0-ap-south-1.pooler.supabase.com',
  'aws-1-ap-south-1.pooler.supabase.com',
  'db.dudujmrhqtyajwjzkspw.supabase.co',
];
const ref = 'dudujmrhqtyajwjzkspw';

async function tryConn(host, password, port) {
  const userPart = host.includes('pooler') ? `postgres.${ref}` : 'postgres';
  const encodedPw = encodeURIComponent(password);
  const url = `postgresql://${userPart}:${encodedPw}@${host}:${port}/postgres`;
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const res = await c.query('SELECT id, email, is_verified FROM "User"');
    console.log(`\n✅ SUCCESS! host=${host} port=${port} password=[${password}]`);
    console.log('Users:', JSON.stringify(res.rows, null, 2));
    await c.end();
    return true;
  } catch (e) {
    const msg = e.message;
    if (!msg.includes('tenant') && !msg.includes('not found') && !msg.includes('ENOTFOUND') && !msg.includes('timeout')) {
      console.log(`host=${host} port=${port} pw=[${password}]: ${msg}`);
    }
    try { await c.end() } catch {}
    return false;
  }
}

async function main() {
  for (const host of hosts) {
    const ports = host.includes('pooler') ? [6543, 5432] : [5432];
    for (const port of ports) {
      for (const pw of passwords) {
        const ok = await tryConn(host, pw, port);
        if (ok) return;
      }
    }
  }
  console.log('\nNot found with any combination.');
}

main();
