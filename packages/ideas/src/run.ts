import Anthropic from "@anthropic-ai/sdk";
import { createDb } from "@factory/core";
import { generateIdeas } from "./index.ts";

const url = process.env.DATABASE_URL || "file:../../local.db";
const db = await createDb({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const ideas = await generateIdeas(db, { client: new Anthropic(), model: process.env.IDEAS_MODEL || undefined });
console.log(`${ideas.length} ideas added to the inbox`);
for (const idea of ideas) console.log(`- ${idea.title}`);
