-- Apply only to the separate AUTH_DB. No Sites or public-registry tables are changed.
-- Retain consumed flows and revoked/expired sessions; application code never deletes them.
CREATE TABLE og_auth_flows (
 flow_digest TEXT PRIMARY KEY NOT NULL CHECK(length(flow_digest)=64),
 config_digest TEXT NOT NULL CHECK(length(config_digest)=64),
 state TEXT NOT NULL CHECK(length(state)=43),
 nonce TEXT NOT NULL CHECK(length(nonce)=43),
 verifier TEXT NOT NULL CHECK(length(verifier)=43),
 return_to TEXT NOT NULL CHECK(length(return_to) BETWEEN 1 AND 1024),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at=created_at+600000),
 consumed_at INTEGER,
 completed_at INTEGER,
 CHECK(consumed_at IS NULL OR consumed_at>=created_at),
 CHECK(completed_at IS NULL OR consumed_at IS NOT NULL AND completed_at>=consumed_at)
);
--> statement-breakpoint
CREATE INDEX og_auth_flows_created ON og_auth_flows(created_at);
--> statement-breakpoint
CREATE INDEX og_auth_flows_pending ON og_auth_flows(expires_at) WHERE consumed_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER og_auth_flow_immutable BEFORE UPDATE ON og_auth_flows
 WHEN NEW.flow_digest IS NOT OLD.flow_digest OR NEW.config_digest IS NOT OLD.config_digest OR
 NEW.state IS NOT OLD.state OR NEW.nonce IS NOT OLD.nonce OR NEW.verifier IS NOT OLD.verifier OR
 NEW.return_to IS NOT OLD.return_to OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR
 OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS NOT OLD.consumed_at OR
 OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at
 BEGIN SELECT RAISE(ABORT,'AUTH_FLOW_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TABLE og_auth_sessions (
 session_digest TEXT PRIMARY KEY NOT NULL CHECK(length(session_digest)=64),
 flow_digest TEXT NOT NULL UNIQUE REFERENCES og_auth_flows(flow_digest),
 config_digest TEXT NOT NULL CHECK(length(config_digest)=64),
 user_id TEXT NOT NULL CHECK(length(user_id)=69),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 1 AND 254),
 full_name TEXT CHECK(full_name IS NULL OR length(full_name) BETWEEN 1 AND 512),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at=created_at+3600000),
 revoked_at INTEGER,
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
--> statement-breakpoint
CREATE INDEX og_auth_sessions_user_active ON og_auth_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER og_auth_session_immutable BEFORE UPDATE ON og_auth_sessions
 WHEN NEW.session_digest IS NOT OLD.session_digest OR NEW.flow_digest IS NOT OLD.flow_digest OR
 NEW.config_digest IS NOT OLD.config_digest OR NEW.user_id IS NOT OLD.user_id OR NEW.email IS NOT OLD.email OR
 NEW.full_name IS NOT OLD.full_name OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR
 OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at
 BEGIN SELECT RAISE(ABORT,'AUTH_SESSION_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER og_auth_session_completes_flow AFTER INSERT ON og_auth_sessions
 BEGIN UPDATE og_auth_flows SET completed_at=NEW.created_at WHERE flow_digest=NEW.flow_digest; END;
