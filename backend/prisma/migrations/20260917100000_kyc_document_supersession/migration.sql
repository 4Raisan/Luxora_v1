-- Legacy NIC front/back were uploaded separately with the same documentType.
-- Preserve all legacy rows until an explicit complete replacement is uploaded.
ALTER TABLE "kyc_documents" ADD COLUMN "supersededAt" TIMESTAMP(3);

-- A current type can contain multiple files; row-level uniqueness would discard ID sides.
CREATE INDEX "kyc_documents_providerId_documentType_supersededAt_idx"
ON "kyc_documents"("providerId", "documentType", "supersededAt");
