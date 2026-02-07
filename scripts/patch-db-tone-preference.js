async function main() {
  console.log("Deprecated: Neon/Postgres uses Prisma migrations. No patch needed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {});
