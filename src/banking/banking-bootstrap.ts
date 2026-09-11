import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type Database from "better-sqlite3";

type CatalogFile = { version: string; products: Array<{ id: string; language: "es" | "en"; name: string; description: string; audience: string; requirements: string }> };
type GuidesFile = { version: string; guides: Array<{ id: string; language: "es" | "en"; title: string; content: string; keywords: string }> };
type TransactionsFile = { transactions: Array<{ id: string; customerRef: string; occurredAt: string; amount: number; currency: string; beneficiary: string; channel: string; country: string }> };

export async function ensureBankingData(db: Database.Database, root = resolve("data/synthetic")): Promise<void> {
  const catalog = JSON.parse(await readFile(resolve(root, "banking-catalog.json"), "utf8")) as CatalogFile;
  const guides = JSON.parse(await readFile(resolve(root, "education-guides.json"), "utf8")) as GuidesFile;
  const transactions = JSON.parse(await readFile(resolve(root, "transactions.json"), "utf8")) as TransactionsFile;
  const now = new Date().toISOString();
  const insert = db.transaction(() => {
    const product = db.prepare("INSERT OR IGNORE INTO product_catalog (id, language, name, description, audience, requirements, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const item of catalog.products) product.run(item.id, item.language, item.name, item.description, item.audience, item.requirements, catalog.version, now);
    const guide = db.prepare("INSERT OR IGNORE INTO education_guides (id, language, title, content, keywords, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const item of guides.guides) guide.run(item.id, item.language, item.title, item.content, item.keywords, guides.version, now);
    const transaction = db.prepare("INSERT OR IGNORE INTO transactions (id, customer_ref, occurred_at, amount, currency, beneficiary, channel, country, synthetic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)");
    for (const item of transactions.transactions) transaction.run(item.id, item.customerRef, item.occurredAt, item.amount, item.currency, item.beneficiary, item.channel, item.country);
  });
  insert();
}
