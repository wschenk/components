pnpx shadcn build

pnpx live-server public

pnpm dlx shadcn@latest add http://127.0.0.1:8080/r/supabase_login.json
pnpm dlx shadcn@latest add http://127.0.0.1:8080/r/supabase_auth.json

supabase status | \
 awk -F ": " '/API URL/ {print "NEXT_PUBLIC_SUPABASE_URL=" $2}' \
 >> .env.development

supabase status | \
 awk -F ": " '/anon key/ {print "NEXT_PUBLIC_SUPABASE_ANON_KEY=" $2}' \
 >> .env.development
