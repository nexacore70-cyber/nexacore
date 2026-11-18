# NexaCore payment implementation — Phase 1

This package adds a **schema foundation** and course-payment allocation records. It does **not** enable live payouts, project checkout, wallet withdrawals or upgrades yet. Never advertise the latter as functional.

## Before installation
1. Back up PostgreSQL database `nexacore`.
2. Merge the two supplied files into the backend; do not replace your existing `.env`.
3. Configure `NEXACORE_PLATFORM_ACCOUNT_EMAIL` in `backend/.env` to the email of a real `ADMIN` user. Do not send your secret key to anyone.
4. Ensure each course has a valid `CourseTutor` row mapping its numeric course ID to an active `TUTOR` user. **Do not invent Tutor IDs.**
5. Review the Prisma schema changes with your developer and apply a migration using `npx prisma migrate dev --name payment_foundation`, then `npx prisma generate`. For production use reviewed migrations with `prisma migrate deploy` instead.
6. Run `npm run dev` and `npm run build` on the frontend separately. Test payments using `sk_test_` Paystack credentials only.

## Course allocation
- On each verified installment, 40% of gross kobo is allocated to an ADMIN account and 60% to the assigned Tutor.
- Allocation is recorded in the database and does **not** transfer money.
- The original Paystack checkout still settles to the Paystack merchant account. To distribute automatically, configure and validate Paystack split/subaccount arrangements or a compliant transfer flow; determine fees, reversals and recipient verification first.
- Course ownership must be immutable for the lifetime of a pending payment; changing Tutor assignment between initialization and verification is not supported in this phase.

## Next phases (not implemented)
- Project checkout: trusted Client/Talent contract, Paystack transaction verification/webhook, unique reference and immutable 10/90 allocation.
- Approval-based release: require paid status, completion evidence, Client approval, dispute window, transactionally move 90% from pending to available wallet balance.
- Withdrawal: verified recipient, transfer API, idempotency, payout reconciliation, insufficient-funds checks, failed-transfer reversal, webhook authentication.
- Talent upgrades: admin-approved plan IDs, NGN prices, duration, benefits, verified payment and expiry logic.
- Frontend: Student payment CTA, Client project checkout, Talent wallet and upgrades; existing frontend is not included in this package.

## Decisions still needed
- Talent upgrade plan names, price in NGN, benefits and durations.
- Paystack business account eligibility and test/live keys (keep private); settlement bank account and verified Tutor/Talent bank recipients.
- Paystack fee allocation, refund/chargeback policy, dispute and approval timeouts.
- Whether the platform holds pending Talent funds via a compliant supported arrangement or delays collection/settlement; do not call an internal wallet balance escrow.
