import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  process.stderr.write(`sample-service listening on port ${port}\n`);
});
