import { ExternalLink, Globe, Lock, RefreshCw, Scale, Users } from "lucide-react";
import { useGetOverview, useListSources } from "@workspace/api-client-react";
import { ErrorState, PageHead, Skel, VerifyBadge } from "@/components/kit";
import { MotionSection } from "@/components/motion";
import { formatDateDDMMYYYY } from "@/lib/utils";

export default function AboutPage() {
  const src = useListSources();
  const ov = useGetOverview();
  return (
    <div className="space-y-12">
      <PageHead kicker="Evidence and disclosure" title="Where every number comes from" />

      <MotionSection className="grid gap-6 rounded-lg bg-primary p-6 text-primary-foreground md:grid-cols-[auto_1fr] md:p-8">
        <Scale className="h-10 w-10 text-accent" />
        <div>
          <h2 className="font-display text-2xl font-bold">You make the decision. Always.</h2>
          <p className="mt-2 max-w-3xl opacity-90">CTRL CV Future Skills supports human career decisions with transparent estimates. It does not make hiring, firing or admission decisions, and should not be used to screen candidates.</p>
        </div>
      </MotionSection>

      <MotionSection delay={0.02} className="space-y-4" data-testid="section-feasibility-governance">
        <div>
          <h2 className="font-display text-2xl font-bold">Impact, feasibility &amp; governance</h2>
          <p className="mt-1 text-sm text-muted-foreground">How CTRL CV scales sustainably across Malaysia while protecting user privacy, keeping labour data fresh, and ensuring fair, inclusive career guidance.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-5" data-testid="card-governance-reach">
            <div className="flex items-center gap-2.5 text-primary">
              <Users className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">Who we reach &amp; realistic free learning</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Built for Malaysian university undergraduates, TVET / polytechnic students, and mid-career workers navigating AI disruption. Every skill gap links directly to free or levy-supported courses on <strong className="font-semibold text-foreground">HRD Corp e-LATiH</strong>, <strong className="font-semibold text-foreground">Malaysia Digital (MDEC)</strong>, and open micro-credentials so cost is never a barrier to upskilling.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5" data-testid="card-governance-freshness">
            <div className="flex items-center gap-2.5 text-primary">
              <RefreshCw className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">How trend data stays fresh &amp; low-cost</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Our <strong className="font-semibold text-foreground">Bronze → Silver → Gold</strong> data pipeline ingests annual/quarterly updates from <strong className="font-semibold text-foreground">TalentCorp MyCOL</strong>, <strong className="font-semibold text-foreground">MASCO 2020</strong>, <strong className="font-semibold text-foreground">DOSM</strong>, and <strong className="font-semibold text-foreground">ILO</strong>. Because role matching, Ridge autoregression forecasts, and PostgreSQL lexical search run deterministically on local tables, per-user matching costs <strong className="font-semibold text-foreground">RM 0.00 in external API fees</strong>.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5" data-testid="card-governance-privacy">
            <div className="flex items-center gap-2.5 text-primary">
              <Lock className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">Personal data protection (PDPA aligned)</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your skill profile and career preferences live strictly in your browser’s local storage (<code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code>) and can be cleared in one click. Uploaded PDF CVs are parsed in volatile memory solely to extract skill tags and are <strong className="font-semibold text-foreground">never saved to disk or stored in any server database</strong>.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5" data-testid="card-governance-fairness">
            <div className="flex items-center gap-2.5 text-primary">
              <Globe className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">Fairness checks &amp; trilingual accessibility</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Role scores use a transparent 4-factor mathematical formula (Skill Match, Career Fit, Malaysian Demand, and AI Resilience) with <strong className="font-semibold text-foreground">zero demographic, gender, age, or university-tier inputs</strong>. The embedded CTRL CV Guide natively supports <strong className="font-semibold text-foreground">Bahasa Melayu (including casual Malay), English, and Simplified Chinese (中文)</strong>.
            </p>
          </div>
        </div>
      </MotionSection>

      <MotionSection delay={0.04}>
        <h2 className="font-display mb-4 text-2xl font-bold">Data sources</h2>
        {src.isError && <ErrorState onRetry={() => src.refetch()} />}
        {src.isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-20" />)}</div>}
        <ul className="divide-y rounded-lg border bg-card">
          {src.data?.filter((s) => s.id !== "SRC_SYNTH_GEN").map((s) => (
            <li key={s.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(7rem,0.85fr)_minmax(0,2fr)_minmax(9rem,1fr)]" data-testid={`row-source-${s.id}`}>
              <span className="font-data block min-w-0 break-all text-xs text-muted-foreground" data-testid="text-source-identifier">{s.id}<br />{s.sourceType}</span>
              <div className="min-w-0 [overflow-wrap:anywhere]" data-testid="column-source-details">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-primary" data-testid={`link-source-${s.id}`}>{s.name} <ExternalLink className="inline h-3 w-3" /></a>
                <div className="mt-1 flex flex-wrap gap-1">{s.usedFor.map((u) => <span key={u} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{u}</span>)}</div>
                <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{s.licenceNotes}</p>
              </div>
              <div className="font-data flex min-w-0 flex-col items-start gap-1 text-[11px] text-muted-foreground [overflow-wrap:anywhere] md:items-end" data-testid="column-source-metadata">
                <VerifyBadge status={s.verificationStatus} />
                <span>published {formatDateDDMMYYYY(s.publicationDate)}</span>
                <span>retrieved {formatDateDDMMYYYY(s.retrievalDate)}</span>
              </div>
            </li>
          ))}
        </ul>
      </MotionSection>

      <MotionSection delay={0.08} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <h2 className="font-display mb-4 text-2xl font-bold">Model metrics</h2>
          {ov.isError && <ErrorState onRetry={() => ov.refetch()} />}
          {ov.isLoading && <Skel className="h-48" />}
          {ov.data && (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="p-3">Task</th><th className="p-3">Model</th><th className="p-3">Metric</th><th className="p-3 text-right">Value</th></tr>
                </thead>
                <tbody className="divide-y">
                  {ov.data.metrics.map((m, i) => (
                    <tr key={i} title={m.note}>
                      <td className="p-3 font-medium">{m.task}<div className="text-xs font-normal text-muted-foreground">{m.note}</div></td>
                      <td className="font-data p-3 text-xs">{m.model}</td>
                      <td className="p-3 text-xs">{m.metric}</td>
                      <td className="font-data p-3 text-right font-semibold text-primary">{m.value.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {ov.data && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold">AI disclosure</h3>
              <p className="mt-2 text-sm text-muted-foreground" data-testid="text-ai-disclosure">{ov.data.aiDisclosure}</p>
            </div>
            <div className="rounded-lg border-l-4 border-accent bg-card p-5">
              <h3 className="font-semibold">Disclaimer</h3>
              <p className="mt-2 text-sm text-muted-foreground">{ov.data.disclaimer}</p>
            </div>
            <div className="font-data rounded-lg border bg-card p-5 text-xs text-muted-foreground">
              Latest observation {formatDateDDMMYYYY(ov.data.latestObservationDate)} · forecast to {formatDateDDMMYYYY(ov.data.forecastTargetDate)} · {ov.data.syntheticProfileCount} synthetic profiles · no real personal data
            </div>
          </div>
        )}
      </MotionSection>
    </div>
  );
}
