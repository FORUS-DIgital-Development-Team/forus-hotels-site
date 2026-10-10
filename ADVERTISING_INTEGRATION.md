# Hotels advertising preparation

The South African pilot homepage contains one disabled contextual banner after the main content, before the footer. It is outside property, booking and hotel-desk controls. No ad SDK or advertising request is loaded in the committed configuration.

Activation requires `data-enabled="true"`, an actual verified placement ID, exact browser origin `https://hotels.coop` and path `/`. The `hotels.forus.digital` upstream and other routes are excluded. The existing Cloudflare proxy continues to serve upstream files without modification.

Delivery is fixed to the FORUS advertising staging endpoint, ZA/en community context, neutral sport and denied storage/personalisation consent. The SDK collapses empty/error states and suppresses measurement/clicks while a property or booking dialog is open. Navigation destroys the controller; back/forward restoration starts a fresh one. No guest details, dates, search choices, booking values or payment data enter an ad request.

Run `node --test tests/advertising.test.cjs` plus JavaScript syntax checks. The PR adds validation only; it neither changes Pages configuration nor deploys a release. Before enabling, confirm publisher ownership, DNS and placement acceptance, consent wording, browser layout/visibility, modal behaviour, expiry, offline/no-fill and back/forward handling. Existing pricing examples and calculators are unaffected.

The cloud integration profile intentionally refuses delivery/accounting pending real provider acceptance. These flags cannot bypass it. Use an approved isolated test environment for filled-banner acceptance; do not switch cloud storage to demo mode or import synthetic balances. MHX payments, financial allocations and commercial approvals remain separate gates.
