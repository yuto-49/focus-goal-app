.PHONY: start start-clear ios android web lint \
       db-start db-stop db-reset db-status db-logs \
       functions-serve migration \
       docker-logs docker-env-check

# --- App ---

start:                ## Start Metro bundler
	npx expo start

start-clear:          ## Start Metro bundler (cache cleared)
	npx expo start --clear

ios:                  ## Start on iOS simulator
	npx expo start --ios

android:              ## Start on Android emulator
	npx expo start --android

web:                  ## Start on web
	npx expo start --web

lint:                 ## Run ESLint
	npx expo lint

# --- Supabase ---

db-start:             ## Start local Supabase (Postgres, Auth, Realtime, Edge Functions)
	supabase start

db-stop:              ## Stop local Supabase
	supabase stop

db-reset:             ## Reset database and re-run all migrations + seed
	supabase db reset

db-status:            ## Show local Supabase service status
	supabase status

db-logs:              ## Tail edge runtime logs (useful for debugging edge functions)
	docker logs supabase_edge_runtime_app1 --tail 50 -f

functions-serve:      ## Serve edge functions locally (reads supabase/.env.local)
	supabase functions serve

migration:            ## Create a new migration (usage: make migration name=add_foo)
	@if [ -z "$(name)" ]; then echo "Usage: make migration name=<migration_name>"; exit 1; fi
	supabase migration new $(name)

# --- Docker helpers ---

docker-logs:          ## Tail all Supabase container logs
	docker logs supabase_edge_runtime_app1 --tail 30

docker-env-check:     ## Verify ANTHROPIC_API_KEY is available inside edge runtime container
	@docker exec supabase_edge_runtime_app1 printenv ANTHROPIC_API_KEY > /dev/null 2>&1 \
		&& echo "ANTHROPIC_API_KEY is set" \
		|| echo "ANTHROPIC_API_KEY is NOT set — check [edge_runtime.secrets] in supabase/config.toml"

# --- Help ---

help:                 ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
