# Independent activity entry — 2026-10-13

Student numbers are reference labels, never identity or uniqueness keys. QR entry presents a form; explicit submission creates a new independent session. Request IDs make retries idempotent. Existing documents and legacy member records remain intact. New sessions no longer create or consult number-based memberships. Legacy maxStudents fields remain readable but are not enforced or shown as capacity. studentCount increments for each new activity after this release; pre-release values represented participants.

An activity URL restores that activity after reload, subject to authenticated ownership. The common class QR offers a new start and an explicit resume of this browser identity's latest class activity. Session history is queried by owner and filtered to class. Recovery links transfer only the selected activity, preserve other activities, and revoke the previous owner's access to that selected activity. The existing privacy retention/deletion policy and AI budgets remain unchanged.

Update: Google test enrollment is now open. A verified Google sign-in automatically creates an active teachers/{uid} record on teacher login or AI preview access. Existing inactive records remain blocked. Anonymous and other-provider accounts cannot self-enroll. Each teacher can manage only their own classes; project API budgets and request limits remain enforced. No email/name is copied into enrollment records.

Validation: frontend/functions builds, 31 unit tests, 14 Firestore emulator tests, including duplicate reference numbers beyond legacy capacity, join retry idempotency, independent recovery, previous article preservation, ownership denial and deletion.

## Owner AI policy — 2026-10-13
Only pinned owner UID hUNsenuelrOlOqvHmYITwpoX2jx2 can save siteConfig/ai through the callable. Teachers may edit tone and interview/article supplemental guidance. Server class create/update and both live generation and AI preview replace client/snapshot model and system prompts with current global policy. Legacy session content remains unchanged; the next AI generation uses current owner policy. Absent global configuration uses bundled defaults. Changing global configuration does not regenerate existing articles. Direct client Firestore writes remain denied.

## General AI interviews — 2026-10-13
Branding and new class creation now use general AI interviews and topic/role input. Year controls and fixed year text were removed from live and preview UIs and article print layout. Legacy career field names remain for record compatibility; OpenAI receives topicOrRole and no futureYear even for legacy inputs. New class/session settings do not inject a default year. Old documents and completed articles are not rewritten. Bundled-default system prompts generalize to reading, experiences, inquiry and roleplay; exact legacy defaults are upgraded at read time while owner-customized prompts remain unchanged.
