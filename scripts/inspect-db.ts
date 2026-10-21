import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Neon Database Complete Inspection ===\n');

  // 1. Get raw table names from information_schema
  const tables: Array<{ table_name: string }> = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;

  console.log(`Found ${tables.length} tables in public schema.\n`);

  const summary: Record<string, number> = {};

  for (const t of tables) {
    const tableName = t.table_name;
    try {
      const countResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "${tableName}";`
      );
      const count = Number(countResult[0]?.count ?? 0);
      summary[tableName] = count;
    } catch (err: any) {
      summary[tableName] = -1;
    }
  }

  console.log('--- Table Row Counts ---');
  for (const [table, count] of Object.entries(summary)) {
    console.log(`- ${table.padEnd(35)} : ${count} rows`);
  }

  console.log('\n--- Detailed Data Dump for Active Tables ---');

  for (const [table, count] of Object.entries(summary)) {
    if (count > 0 && table !== '_prisma_migrations') {
      console.log(`\n==================================================`);
      console.log(`Table: "${table}" (${count} records)`);
      console.log(`==================================================`);
      const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" LIMIT 25;`);
      console.log(JSON.stringify(rows, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 
        2
      ));
      if (count > 25) {
        console.log(`... and ${count - 25} more rows`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error inspecting database:', e);
  await prisma.$disconnect();
  process.exit(1);
});
