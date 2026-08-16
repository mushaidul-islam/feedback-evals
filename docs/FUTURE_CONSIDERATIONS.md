# Truth Be Told — Future Considerations

Status: deferred ideas and decision triggers

Relationship to MVP: nothing in this document is required to ship `MVP.md`

## 1. When to introduce an agent framework

The practical rule is:

```ts
while (!agentDecidesTheTaskIsFinished(state)) {
  const nextAction = await agentChooseNextAction(state);
  state = await perform(nextAction, state);
}
```

An agent framework becomes useful when the model repeatedly controls:

- The next action.
- Which tool or branch to use.
- Whether more information is needed.
- Whether to retry or change strategy.
- When the task is complete.

An agent framework is not required merely because a system has multiple steps.

### Decision guide

| Product shape | Appropriate implementation |
|---|---|
| Fixed sequence of known steps | Plain TypeScript functions |
| Known branches based on structured output | Plain TypeScript state machine |
| Background retries, schedules, queues, or idempotency | Trigger.dev |
| Long-lived business workflows spanning many services | Consider Temporal |
| Model repeatedly chooses actions until it reaches a goal | Consider LangGraph.js or Mastra |
| Multi-turn adaptive interview with persistent model-controlled branching | Consider LangGraph.js |

### Current MVP

The MVP has:

```text
classify
→ optionally ask one fixed-purpose follow-up
→ make one final decision
→ stop
```

This is bounded application logic, not an agent loop.

### Trigger for reconsideration

Reconsider LangGraph.js or Mastra only if at least one of these becomes real:

- Follow-ups can continue for an unknown number of turns.
- The model selects among several tools.
- The model must revise its own plan.
- Conversations pause and resume across long periods.
- Human reviewers can interrupt and redirect an AI-controlled process.
- The model, rather than application code, determines completion.

If adopted later:

- Keep Trigger.dev responsible for durable background execution.
- Give the agent framework a narrow responsibility for model-controlled conversational state.
- Avoid two frameworks independently retrying or persisting the same work.

References:

- LangGraph.js: <https://docs.langchain.com/oss/javascript/langgraph/overview>
- Mastra workflows: <https://mastra.ai/ai-workflows>
- Temporal: <https://docs.temporal.io/temporal>

## 2. Conversational feedback expansion

Potential additions:

- More than one adaptive follow-up.
- Fully conversational campaign mode.
- Creator-configurable follow-up depth.
- Quick mode versus guided mode.
- Streaming assistant responses.
- Campaign-specific interview goals.
- A final “Is there anything else?” step.
- Resuming an unfinished anonymous session.

Before expanding beyond one follow-up, measure:

- Useful feedback per 100 form opens.
- Follow-up abandonment.
- Average completion time.
- Percentage of submissions rescued by each additional turn.
- Creator-rated usefulness.
- Whether later turns add new signal or merely repeat existing content.

Do not expand the conversation merely because the model can continue talking.

## 3. Voice input

Possible flow:

```text
record audio
→ transcribe
→ delete audio
→ process transcript through the same feedback state machine
```

Questions to decide:

- Maximum recording duration.
- Whether a transcript is shown before sending.
- Which transcription model/provider is used.
- Whether audio is ever retained for failure recovery.
- Language coverage.
- How background noise and multiple speakers are handled.

Voice should reuse the same contracts, moderation decisions, and evaluation framework as text.

## 4. Prompt optimization

### DSPy and GEPA

DSPy and GEPA are optimization tools, not replacements for Braintrust.

- Braintrust stores traces/datasets and measures experiments.
- An optimizer proposes new prompt/program variants against defined metrics.
- The optimized artifact must be re-evaluated in Braintrust before promotion.

Possible approaches:

1. Keep production TypeScript and run DSPy/GEPA in a separate offline Python tool.
2. Evaluate Ax as a TypeScript-native DSPy-style system with prompt optimization.
3. Build a small custom TypeScript prompt-search loop using the Braintrust dataset and scorers.

Do not introduce automatic optimization until:

- The golden dataset is large and diverse enough to split into train, validation, and untouched test sets.
- Scorers correlate with human judgment.
- Safety-critical categories have reliable labels.
- Prompt changes can be rolled back.

Avoid optimizing against the test set or promoting generated prompts without human review.

References:

- DSPy: <https://dspy.ai/>
- GEPA: <https://github.com/gepa-ai/gepa>
- Ax for TypeScript: <https://axllm.dev/typescript/concepts/dspy/>

## 5. Model specialization

The MVP begins with general-purpose models.

Possible future model roles:

- Small classifier for accept/transform/reject/quarantine.
- Dedicated moderation model.
- Dedicated PII/doxxing detector.
- Transformation model optimized for meaning preservation.
- Embedding model for theme similarity.
- Larger model only for campaign-level summaries.
- Fine-tuned classifier after enough labeled data exists.
- Self-hosted/open-weight model if cost, privacy, or latency justifies it.

Change models only when evaluation demonstrates an acceptable tradeoff across:

- Accuracy.
- Safety-critical recall.
- False rejection.
- Meaning preservation.
- Latency.
- Cost.
- Language coverage.

Do not use a more specialized model merely because its description sounds appropriate.

## 6. Multi-provider routing

Possible future capabilities:

- Provider fallback during outages.
- Different models for different pipeline stages.
- Regional or customer-specific providers.
- Cost-based routing.
- Shadow evaluation of a candidate model.
- Automatic promotion after evaluation gates.

Before building a router, confirm that:

- Provider outages materially affect the product.
- One provider cannot meet the measured cost/quality target.
- The team can maintain provider-specific prompts and output behavior.
- Braintrust experiments cover every supported route.

The internal model adapter in the MVP exists to make this possible without making it necessary.

## 7. Theme analysis evolution

The MVP can regenerate themes from creator-visible feedback using a general model.

Possible future improvements:

- Store embeddings in Supabase Postgres with `pgvector`.
- Incremental theme assignment.
- Merge and split themes over time.
- Hierarchical themes and subthemes.
- Trend detection across campaign periods.
- Creator-managed theme labels.
- Semantic search over feedback.
- Deterministic clustering in an offline Python worker.
- Theme stability evaluation across model versions.

A separate vector database is unnecessary until Postgres/pgvector is shown to be inadequate.

## 8. Peer-environment insights

Potential product:

- Compare a creator’s themes with a relevant peer cohort.
- Show common strengths and weaknesses in a category.
- Surface whether feedback is unusual or broadly shared.

Open questions:

- What defines a valid peer cohort?
- Who consents to inclusion?
- How are cohorts protected from identifying individual campaigns or submitters?
- How much data is necessary before comparison is meaningful?
- How are industries, languages, audience size, and campaign prompts normalized?

This was the reason for the previously discussed minimum-group concern: very small groups can make supposedly aggregate observations easy to attribute. It is deferred until peer insights or public cohort comparisons become a real feature.

## 9. Sharing evolution

Possible additions:

- Image exports for social media.
- Multiple card templates.
- Creator-selected quotes.
- Public campaign report pages.
- Password-protected reports.
- Expiring links.
- Domain-restricted links.
- View analytics.
- Watermarked exports.
- Scheduled report publication.

Before automatically sharing direct quotes, decide whether transformed text, rare details, or campaign context could reveal the submitter.

## 10. Product analytics

Braintrust measures model behavior, not product funnels.

If product questions become important, add a product analytics tool such as PostHog for:

- Campaign creation completion.
- Share-link copying.
- Form open-to-submit conversion.
- Follow-up abandonment.
- Creator return rate.
- Report and share usage.
- Retention by campaign type.

Do not send raw feedback text to product analytics.

## 11. Advanced abuse protection

Potential additions:

- Duplicate and near-duplicate submission detection.
- Campaign-level brigading detection.
- Invite-only campaign links.
- One-time invitation tokens.
- Campaign-specific block lists.
- Browser/device signals with an explicit privacy policy.
- Creator-configurable submission cooldown.
- Global actor reputation that does not reveal identity to creators.
- Human moderation console.
- Creator reporting and appeal flow.
- Emergency campaign shutdown controls.

Add these in response to observed abuse patterns rather than hypothetical ones.

## 12. PII and doxxing policy

Current decision:

- Voluntary self-identifying information is allowed.
- Third-party doxxing and threatening disclosure are quarantined.

Future policy questions:

- Whether to distinguish self-provided from third-party information.
- Whether high-risk fields such as home addresses require automatic redaction.
- Data retention for original text.
- Export and deletion requests.
- Whether quarantined content needs a staff review tool.
- Whether creators can report sanitized content that still exposes someone.

These questions are not blockers for the core MVP but should be resolved before broad public scale.

## 13. Privacy and data lifecycle

Potential future work:

- Configurable raw-intake retention.
- Per-campaign deletion policy.
- Encrypted raw-content storage with separate key access.
- Region-specific data residency.
- Provider-specific zero-retention configuration.
- Audit log for creator and staff actions.
- Creator data export.
- Submitter deletion token.
- Formal incident response and legal hold process.

## 14. Creator organizations

Potential additions:

- Workspaces.
- Multiple creator members.
- Owner/admin/viewer roles.
- Shared campaigns.
- Team moderation queues.
- Organization-level themes.
- SSO and enterprise controls.
- Billing seats.

Supabase RLS policies should be revisited before adding organizations; avoid forcing organization complexity into the single-creator MVP schema.

## 15. Campaign controls

Possible future campaign modes:

- Public link.
- Invite-only.
- Single-use tokens.
- Scheduled recurring campaign.
- Campaign with multiple questions.
- Feedback about a specific piece of content.
- Structured rating plus open text.
- Required context or relationship field.
- Creator-configurable moderation strictness.
- Creator-defined categories.

Each additional field increases submitter friction and should be justified by measured improvement in useful feedback.

## 16. Notifications

Potential additions:

- Email digest.
- Instant creator notification for accepted feedback.
- Weekly theme summary.
- Notification only after a minimum number of new items.
- Slack or Teams delivery.
- Alert when a campaign receives unusual volume.

Notifications should never contain raw rejected or quarantined content.

## 17. Monetization

Questions to evaluate after product usage exists:

- Free campaign or response limits.
- Paid historical analysis.
- Paid recurring campaigns.
- Paid custom branding.
- Paid exports and sharing.
- Team/organization plan.
- Advanced moderation controls.
- Peer benchmarks.

Do not design the initial database around speculative billing entitlements.

## 18. Infrastructure evolution

### Trigger.dev to Temporal

Consider Temporal only if workflows become long-lived business processes involving:

- Multiple external systems.
- Human approvals.
- Compensating transactions.
- Complex versioning across long-running executions.
- Strict recovery guarantees beyond background-job retries.

### Supabase Edge Functions to a Node API

Consider a dedicated Node service if:

- Deno compatibility becomes a recurring problem.
- API logic becomes large and highly interconnected.
- Long-lived connections are required.
- The team needs Node-only libraries in request handlers.
- Edge Function constraints become operationally material.

### Frontend framework

The MVP intentionally uses a Vite single-page application. Reconsider SSR or a full-stack framework only if public SEO, server rendering, or frontend/backend colocation becomes a demonstrated requirement.

## 19. Open product questions

These should be answered with user research or product data:

- Are the primary creators social-media creators, managers, educators, or communities?
- Is the core value more feedback volume or feedback quality?
- Do creators value individual feedback more than themes?
- Does one adaptive follow-up improve useful feedback per form open?
- What percentage of harsh submissions contain recoverable signal?
- Do submitters understand what the product does without an item-level transformation label?
- What creator action follows a report?
- Which sharing behavior creates the acquisition loop?

## 20. Decision discipline

When considering any future feature:

1. State the observed user or operational problem.
2. Define the metric the feature should improve.
3. Confirm the MVP architecture cannot solve it simply.
4. Choose the smallest additional component.
5. Add evaluation and rollback before production.
6. Remove the component if it does not produce a measured improvement.
