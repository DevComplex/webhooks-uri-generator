import { Context, Router, helpers } from "oak";
import { lowerCase } from "https://deno.land/x/case/mod.ts";
import { nanoid } from "https://deno.land/x/nanoid/mod.ts"
const { getQuery } = helpers;

export const router = new Router();
const kv = await Deno.openKv();

const EXPECTED_VERIFY_TOKEN = "TEST_VERIFY_TOKEN";
const SUBSCRIBE_MODE = "subscribe";

router.get('/', (ctx: Context) => {
    ctx.response.type = "text/plain";
    ctx.response.status = 200;
    ctx.response.body = "Nothing here";
});

router.get("/:id/events_history", async (ctx: Context) => {
    const { id } = getQuery(ctx, { mergeParams: true });
    if (!id)  {
        ctx.response.type = "text/plain";
        ctx.response.status = 404;
        ctx.response.body = "Not found";
        return;
    }
    const { value: data } = await kv.get([id]);
    if (!data)  {
        ctx.response.type = "text/plain";
        ctx.response.status = 404;
        ctx.response.body = "Not found";
        return;
    }
    const events = data as string[];

    function getClientHTML()  {
        const stuffToRender = events.map(v => {
            const prettyJson = JSON.stringify(JSON.parse(v), undefined, 2);
            return `<pre>${prettyJson}</pre>`;
        }).join('\n');

        console.log(stuffToRender);

        return `<html>
        <head>
            <style>
                body {
                    background-color: #1c1e21;
                }

                #events {
                    display: flex;
                    flex-wrap: wrap;
                }

                pre {
                    border: 1px solid #444950;
                    color: #e4e6eb;
                    padding: 22px;
                    margin-left: 2em;
                }
            </style>
        </head>
        <body>
          <div id="events">
        ${stuffToRender}
          </div>
        </body>
      </html>`;
    }

    const body = new TextEncoder().encode(getClientHTML());
    ctx.response.type = "text/html";
    ctx.response.body = body;
    ctx.response.status = 200;
});

router.get("/:id/events", async (ctx: Context) => {
    const mode = ctx.request.url.searchParams.get("hub.mode");
    const challenge = ctx.request.url.searchParams.get("hub.challenge");
    const verifyToken = ctx.request.url.searchParams.get("hub.verify_token");

    const { id } = getQuery(ctx, { mergeParams: true });

    if (!id) {
        ctx.response.type = "text/plain";
        ctx.response.status = 404;
        ctx.response.body = "Not found";
        return;
    }

    const { value: data } = await kv.get([id]);

    if (!data)  {
        ctx.response.type = "text/plain";
        ctx.response.status = 404;
        ctx.response.body = "Not found";
        return;
    }

    console.log(`Events Challenge... mode: ${mode}, ${challenge}, ${verifyToken} from ${ctx.request.ip}`)

    if (mode === SUBSCRIBE_MODE && challenge && EXPECTED_VERIFY_TOKEN === verifyToken) {
        console.log(`Events Challenge Success for ${ctx.request.ip}`)
        ctx.response.status = 200;
        ctx.response.type = "text/plain";
        ctx.response.body = challenge;
    } else {
        console.log(`Events Challenge Failure for ${ctx.request.ip}`)
        ctx.response.status = 400;
    }
});

router.post("/:id/events", async (ctx: Context) => {
    const { id } = getQuery(ctx, { mergeParams: true });

    if (!id) {
        ctx.response.type = "text/plain";
        ctx.response.status = 404;
        ctx.response.body = "Not found";
        return;
    }
    const { value: events } = await kv.get([id]);

    if (!events)  {
        ctx.response.type = "text/plain";
        ctx.response.status = 404;
        ctx.response.body = "Not found";
        return;
    }

    const { value } = ctx.request.body({ type: "json" });

    const data = JSON.stringify(await value);
    const currEvents = events as string[];
    const newEvents = [...currEvents, data];
    await kv.set([id], newEvents);
    ctx.response.status = 200;
});

router.get("/register", async (ctx: Context) => {
    const secret = ctx.request.url.searchParams.get('key');
    if (secret && lowerCase(secret) !== 'superdupersecret') {
        ctx.response.status = 401;
        ctx.response.type = "text/plain";
        ctx.response.body = "Unauthorized";
        return;
    }
    const requestUrl = ctx.request.url.hostname;
    const registeredId = nanoid();
    await kv.set([registeredId], []);
    ctx.response.type = "text/plain";
    const baseUrl = `https://${requestUrl}/${registeredId}`;
    const eventsHistoryUrl = `${baseUrl}/events_history`;
    const callbackUrl = `${baseUrl}/events`;
    const responseText = `Register Webhooks at Callback URL: ${callbackUrl}\nView Webhook Events at URL: ${eventsHistoryUrl}`;
    ctx.response.body = responseText;
    ctx.response.status = 200;
});
