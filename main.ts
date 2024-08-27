import { Application } from "oak";

import { router } from "./router.ts";

const app = new Application({ logErrors: false });

app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 80 });
