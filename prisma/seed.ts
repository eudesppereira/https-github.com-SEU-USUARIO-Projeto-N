import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "eudes@nutre.ai";
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha) {
    throw new Error("Defina ADMIN_PASSWORD no .env antes de rodar o seed.");
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.admin.upsert({
    where: { email },
    update: { senhaHash },
    create: { email, senhaHash },
  });
  console.log(`Admin seed ok: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
