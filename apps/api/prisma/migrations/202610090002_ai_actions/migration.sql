-- Assistant proposals (validated actions the user can confirm) are stored with the reply.
ALTER TABLE "AiMessage" ADD COLUMN "actions" JSONB;
