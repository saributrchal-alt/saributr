# Saributr — สายใยครอบครัว

React / Vite with Supabase email/password authentication and private persisted family records.

## Use
1. Apply the family_people and family_relationships SQL provided in the setup conversation.
2. Enable email/password login in Supabase Auth. For confirmation emails, set Auth URL Configuration > Site URL to the deployed Vercel URL and allow the appropriate redirect URL.
3. Deploy with Vercel preset Vite, root ./, output dist.
4. Sign up, confirm email, sign in, add people, then link relatives.
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
