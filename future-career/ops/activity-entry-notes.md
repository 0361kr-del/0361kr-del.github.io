# Independent activity entry — 2026-10-13

Student numbers are reference labels, never identity or uniqueness keys. QR entry presents a form; explicit submission creates a new independent session. Request IDs make retries idempotent. Existing documents and legacy member records remain intact. New sessions no longer create or consult number-based memberships. Legacy maxStudents fields remain readable but are not enforced or shown as capacity. studentCount increments for each new activity after this release; pre-release values represented participants.

An activity URL restores that activity after reload, subject to authenticated ownership. The common class QR offers a new start and an explicit resume of this browser identity's latest class activity. Session history is queried by owner and filtered to class. Recovery links transfer only the selected activity, preserve other activities, and revoke the previous owner's access to that selected activity. The existing privacy retention/deletion policy and AI budgets remain unchanged.

Teachers still require an active teachers/{uid} record; Google sign-in alone does not grant teacher permissions. Only the owning approved teacher can manage or read their class. No automatic teacher enrollment was enabled.

Validation: frontend/functions builds, 31 unit tests, 14 Firestore emulator tests, including duplicate reference numbers beyond legacy capacity, join retry idempotency, independent recovery, previous article preservation, ownership denial and deletion.
