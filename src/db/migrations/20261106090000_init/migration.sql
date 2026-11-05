-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('starter', 'business', 'enterprise');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('allow', 'mask', 'block');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "external_agent_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_external_id" TEXT,
    "policy_name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "allowed_domains" JSONB NOT NULL,
    "blocked_patterns" JSONB NOT NULL,
    "masking_rules" JSONB NOT NULL,
    "max_request_bytes" INTEGER NOT NULL,
    "rate_limit" INTEGER NOT NULL,
    "rate_window_seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "policy_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_ip_hash" TEXT NOT NULL,
    "destination_domain" TEXT NOT NULL,
    "http_method" TEXT NOT NULL,
    "request_size_bytes" INTEGER NOT NULL,
    "detection_results" JSONB NOT NULL,
    "action" "AuditAction" NOT NULL,
    "reason_code" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "policy_version" INTEGER,
    "gateway_version" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_external_id" TEXT NOT NULL DEFAULT '',
    "subject_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_tenant_id_external_agent_id_key" ON "agents"("tenant_id", "external_agent_id");

-- CreateIndex
CREATE INDEX "policies_tenant_id_agent_external_id_idx" ON "policies"("tenant_id", "agent_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_request_id_key" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_timestamp_idx" ON "audit_logs"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_action_idx" ON "audit_logs"("tenant_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "identity_keys_subject_id_key" ON "identity_keys"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_keys_tenant_id_agent_external_id_key" ON "identity_keys"("tenant_id", "agent_external_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_keys" ADD CONSTRAINT "identity_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
