import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.userConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  if ((await prisma.contact.count()) === 0) {
    await prisma.contact.createMany({
      data: [
        { name: "Mom", nicknames: "mother, mum, mama", phone: "+15550100001", isVip: true },
        { name: "Pepper Potts", nicknames: "pepper, boss, ceo", phone: "+15550100002", email: "pepper@starkindustries.com", isVip: true },
        { name: "Happy Hogan", nicknames: "happy, driver", phone: "+15550100003", email: "happy@starkindustries.com" },
      ],
    });
    console.log("Seeded 3 sample contacts (edit them in /admin → Contacts).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
