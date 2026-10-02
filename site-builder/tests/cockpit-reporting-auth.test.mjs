import test from "node:test";
import assert from "node:assert/strict";
import { authorizedReportingRequest } from "../lib/cockpit-reporting-auth.ts";

const cases = [
  [
    "accepts configured credential",
    "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    true
  ],
  [
    "rejects missing credential",
    null,
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "rejects missing configuration",
    "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    null,
    false
  ],
  [
    "rejects 31-character configuration",
    "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "rejects wrong credential of same length",
    "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "rejects unequal byte lengths",
    "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "rejects wrong scheme",
    "Basic aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "rejects extra bearer whitespace",
    "Bearer  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "rejects trailing whitespace",
    "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "supports unicode without length exception",
    "Bearer éééééééééééééééééééééééééééééééé",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  ],
  [
    "normalizes configuration whitespace",
    "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    " aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ",
    true
  ]
];
for (const [name, authorization, expected, accepted] of cases) {
  test(name, () => assert.equal(authorizedReportingRequest(authorization, expected), accepted));
}

