import assert from "node:assert/strict";
import test from "node:test";
import { buildWelcomeMail } from "./welcome-mail.js";

test("builds a welcome email without allowing HTML injection", () => {
  const message = buildWelcomeMail({
    appName: "Bifrost",
    userName: "<Admin>",
    loginUrl: "https://tg.example.test/?a=1&b=2",
    roles: ["Chief", "Logistikk"],
  });
  assert.match(message.subject, /Bifrost/);
  assert.match(message.text, /Chief, Logistikk/);
  assert.doesNotMatch(message.html, /<Admin>/);
  assert.match(message.html, /&lt;Admin&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
});
