/**
 * Set (rotate) a user's password without printing it anywhere.
 *
 * Usage (local):      npx ts-node scripts/set-user-password.ts <email>
 * Usage (container):  docker compose exec -it backend node dist/scripts/set-user-password.js <email>
 *
 * The new password is read from the EMS_NEW_PASSWORD environment variable if set,
 * otherwise prompted for interactively (input hidden). Minimum 10 characters.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    rlAny._writeToOutput = (s: string) => {
      if (!muted) rlAny.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: set-user-password <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user with email ${email}`);
      process.exit(1);
    }

    const password = process.env.EMS_NEW_PASSWORD ?? (await promptHidden(`New password for ${email}: `));
    if (password.length < 10) {
      console.error('Password must be at least 10 characters.');
      process.exit(1);
    }
    if (!process.env.EMS_NEW_PASSWORD) {
      const confirm = await promptHidden('Confirm password: ');
      if (confirm !== password) {
        console.error('Passwords do not match.');
        process.exit(1);
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Password updated for ${email} (${user.role}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
