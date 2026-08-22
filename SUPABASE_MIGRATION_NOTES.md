# Supabase Migration Notes

The connected user-owned Supabase project is **`aymenlasfar4@icloud.com's Project`** with project reference **`anjnjbiixzbwcmqritxj`**, region **`eu-west-2`**, and status **`ACTIVE_HEALTHY`**. It is available through the enabled Supabase connector.

The current Quizio Fly deployment remains a MySQL plus Manus-style OAuth implementation. Its live `/admin` route renders a browser dashboard sign-in gate, but it cannot provide owner email/password authentication until the migration is completed.

Supabase’s current guidance confirms that email/password authentication can use the browser-visible project URL and publishable key when Row Level Security is enabled. Use a publishable key in the web bundle; never expose a Supabase secret or service-role key in browser code. Reference: https://supabase.com/docs/guides/getting-started/tutorials/with-vue-3

The migration target is a one-owner content studio with Supabase Auth email/password login and owner-only RLS policies for quiz content changes. The existing published-question read flow should remain available to the player through a separately secured, read-only policy or server API.
