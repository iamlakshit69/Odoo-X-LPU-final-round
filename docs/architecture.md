# Architecture notes

Cross-cutting patterns (from docs/brief/champions-club-repo-research.md):

1. Ledger over counters (stock, payments, tab entries, audit).
2. Business rules are data (settings tables).
3. One pricing engine: member tier x channel x time band.
4. Database enforces hard invariants.
5. Separate state machines per concept (booking, order, payment, tab, lead, membership).
6. One notification service and one realtime channel behind interfaces.
7. Charged vs paid vs outstanding modelled once.

Stack decision: TBD (record it here once agreed).
