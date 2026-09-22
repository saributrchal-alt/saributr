# Saributr — สายใยครอบครัว

React / Vite with Supabase email OTP authentication and private persisted family records.

## Use
1. Apply the family_people and family_relationships SQL provided in the setup conversation.
2. Configure email OTP templates and SMTP as described below. Set Auth Site URL to the deployed Vercel URL.
3. Deploy with Vercel preset Vite, root ./, output dist.
4. Request an email OTP, verify it, add people, then link relatives.
5. Reload to verify persistence.

The project uses the supplied Supabase project URL and publishable browser key by default.
Optional Vercel overrides: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
Never put a secret/service-role key in frontend configuration.

RLS grants access only to each record's owner. Person editing, deletion, relationships and relationship removal use the same ownership rules. Deleting a person cascades to their relationship records. No demonstration family records are seeded.

Current scope: personal family records, a selected person's parents/spouses/children, name search, editing, and persistence. Shared family access, profile claims/invitations, photos, and a full multi-generation graph remain future work. Parent-cycle checks currently run in the UI; database constraints enforce self-reference prevention and ownership, not arbitrary ancestry cycles.

## Development
npm ci
npm run dev
npm run build

## Email OTP (replaces password UI)
- In Supabase Authentication > Email Templates, replace the Magic Link body with supabase/templates/email-otp.html. Use the same body for Confirm signup to cover new-account confirmation emails.
- Subject: รหัสเข้าสู่ระบบสายใยครอบครัว
- Keep Email provider and new-user signup enabled.
- Configure custom SMTP before opening registration to the public; Supabase's default mail service restricts recipients and has low sending limits.
- No SQL changes are required. Existing members use the same email to retain their auth user ID and owned records.
- UI supports requesting a code, verification, a 60-second resend cooldown, changing the email, and error feedback.
- Actual email delivery and project template/SMTP settings must be tested in the Supabase project; they are not configured by this repository.

Future LINE OA integration: connect LINE to an already-authenticated account with server-verified identity and explicit linking. Keep the existing Supabase user ID as the family-data owner. Do not merge accounts based on client-supplied LINE IDs. LINE OA is not enabled in this release.
