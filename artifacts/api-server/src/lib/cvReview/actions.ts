/**
 * Human-in-the-loop writes. Every decision, appeal and appeal resolution is
 * stored in review_decisions / appeals and mirrored in audit_logs inside the
 * same transaction. Only these functions change a claim's status, and only a
 * signed-in reviewer can call the decision ones.
 */
import { and, eq, sql } from "drizzle-orm";
import { appealsTable, auditLogsTable, cvClaimsTable, cvDocumentsTable, db, reviewDecisionsTable } from "@workspace/db";
import {
  DECISION_TO_DB,
  DECISION_TO_STATUS,
  OPEN_APPEAL,
  STATUS_TO_DECISION,
  appealAllowed,
  isOpenAppeal,
  loadClaims,
  type ApiDecision,
} from "./views";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Marks the CV reviewed once no claim is pending, otherwise scanned. */
async function refreshCvStatus(tx: Tx, cvId: string) {
  await tx
    .update(cvDocumentsTable)
    .set({
      status: sql`case when exists (select 1 from ${cvClaimsTable} c where c.cv_document_id = ${cvId} and c.status = 'pending_review')
        then 'scanned'::cv_document_status else 'reviewed'::cv_document_status end`,
    })
    .where(eq(cvDocumentsTable.id, cvId));
}

async function lockClaim(tx: Tx, claimId: string) {
  const [claim] = await tx
    .select({ id: cvClaimsTable.id, cvId: cvClaimsTable.cvDocumentId, status: cvClaimsTable.status, externalId: cvClaimsTable.externalId })
    .from(cvClaimsTable)
    .innerJoin(cvDocumentsTable, eq(cvDocumentsTable.id, cvClaimsTable.cvDocumentId))
    .where(and(eq(cvClaimsTable.id, claimId), eq(cvDocumentsTable.isSynthetic, true)))
    .for("update", { of: cvClaimsTable });
  if (!claim) throw new NotFoundError("Claim not found");
  return claim;
}

export async function decideClaim(reviewerId: string, claimId: string, decision: ApiDecision, rationale: string) {
  await db.transaction(async (tx) => {
    const claim = await lockClaim(tx, claimId);
    const [open] = await tx
      .select({ id: appealsTable.id })
      .from(appealsTable)
      .where(and(eq(appealsTable.cvClaimId, claimId), OPEN_APPEAL))
      .limit(1);
    if (open) throw new ConflictError("This claim has an open appeal. Resolve the appeal instead.");
    await tx.insert(reviewDecisionsTable).values({
      reviewerUserId: reviewerId,
      cvClaimId: claimId,
      decision: DECISION_TO_DB[decision],
      rationale,
    });
    await tx.update(cvClaimsTable).set({ status: DECISION_TO_STATUS[decision] }).where(eq(cvClaimsTable.id, claimId));
    await refreshCvStatus(tx, claim.cvId);
    await tx.insert(auditLogsTable).values({
      actorUserId: reviewerId,
      actorType: "user",
      action: "cv.claim.decided",
      entityType: "cv_claim",
      entityId: claimId,
      metadata: { decision, previousStatus: claim.status, claim: claim.externalId ?? claimId, rationale },
    });
  });
}

export async function submitAppeal(applicantId: string, claimId: string, reason: string, language: "ms" | "zh-CN" | "en") {
  const [bundle] = await loadClaims(eq(cvClaimsTable.id, claimId));
  if (!bundle) throw new NotFoundError("Claim not found");
  if (!bundle.decisions[0]) throw new ConflictError("This claim has not been reviewed yet, so there is nothing to appeal.");
  if (!appealAllowed(bundle, applicantId)) {
    throw new ConflictError("You have already appealed this decision.");
  }
  try {
    return await db.transaction(async (tx) => {
      await lockClaim(tx, claimId);
      const [appeal] = await tx
        .insert(appealsTable)
        .values({ applicantUserId: applicantId, cvClaimId: claimId, reason, language })
        .returning();
      await tx.insert(auditLogsTable).values({
        actorUserId: applicantId,
        actorType: "user",
        action: "cv.appeal.submitted",
        entityType: "appeal",
        entityId: appeal!.id,
        metadata: { claimId, claim: bundle.claim.externalId ?? claimId, againstDecision: bundle.decisions[0]!.decision },
      });
      return appeal!;
    });
  } catch (err) {
    // The partial unique index allows one open appeal per applicant and claim.
    if ((err as { code?: string }).code === "23505") throw new ConflictError("You already have an open appeal on this claim.");
    throw err;
  }
}

export async function resolveAppeal(
  reviewerId: string,
  appealId: string,
  outcome: "upheld" | "rejected",
  rationale: string,
  newDecision: ApiDecision | undefined,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [appeal] = await tx.select().from(appealsTable).where(eq(appealsTable.id, appealId)).for("update");
    if (!appeal?.cvClaimId) throw new NotFoundError("Appeal not found");
    const claim = await lockClaim(tx, appeal.cvClaimId);
    if (!isOpenAppeal(appeal)) throw new ConflictError("This appeal has already been resolved.");
    const current = STATUS_TO_DECISION[claim.status];
    if (outcome === "upheld") {
      if (!newDecision) throw new ConflictError("Choose the new decision when upholding an appeal.");
      if (newDecision === current) throw new ConflictError("Upholding an appeal must change the decision.");
    }

    // now() is the transaction start time, so the appeal resolution and the
    // changed claim decision share one timestamp (used to flag viaAppeal).
    await tx
      .update(appealsTable)
      .set({ status: outcome, resolution: rationale, resolvedBy: reviewerId, resolvedAt: sql`now()` })
      .where(eq(appealsTable.id, appealId));
    await tx.insert(reviewDecisionsTable).values({
      reviewerUserId: reviewerId,
      appealId,
      decision: outcome === "upheld" ? "approved" : "rejected",
      rationale,
    });
    if (outcome === "upheld" && newDecision) {
      await tx.insert(reviewDecisionsTable).values({
        reviewerUserId: reviewerId,
        cvClaimId: claim.id,
        decision: DECISION_TO_DB[newDecision],
        rationale,
      });
      await tx.update(cvClaimsTable).set({ status: DECISION_TO_STATUS[newDecision] }).where(eq(cvClaimsTable.id, claim.id));
      await refreshCvStatus(tx, claim.cvId);
    }
    await tx.insert(auditLogsTable).values({
      actorUserId: reviewerId,
      actorType: "user",
      action: "cv.appeal.resolved",
      entityType: "appeal",
      entityId: appealId,
      metadata: {
        outcome,
        claimId: claim.id,
        claim: claim.externalId ?? claim.id,
        previousDecision: current ?? null,
        newDecision: outcome === "upheld" ? newDecision : null,
        rationale,
      },
    });
    return claim.id;
  });
}
