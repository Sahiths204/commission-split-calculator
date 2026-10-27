import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { app } from './app.js';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

if (process.env.NODE_ENV !== 'test') {
  const staticDir = path.resolve(process.cwd(), 'web/dist');
  if (fs.existsSync(staticDir)) {
    console.log(`Serving static frontend build from ${staticDir}`);
    app.use(express.static(staticDir));
  } else {
    console.log(`Skipping static frontend serving: ${staticDir} does not exist`);
  }
}

app.listen(port, () => {
  console.log(`Commission split calculator API listening on port ${port}`);
});
