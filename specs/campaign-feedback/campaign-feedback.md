# Campaign feedback

Status: approved; implementation under review

## Purpose

Let a creator create a campaign, share a collection link, and review the feedback saved for that campaign. Anonymous visitors can submit feedback. This first version is meant for public testing with a simple temporary API key and no user accounts.

## Behavior

A campaign has a generated ID and a required name. The name is also the description used when classifying feedback; names do not need to be unique. Campaigns are not linked to users.

`/c` shows campaigns as cards with each campaign's name and summary data, and offers campaign creation. A card opens `/c/<campaign-id>`, which shows that campaign's accepted feedback and details. `/f/c/<campaign-id>` is the public collection page. It shows the campaign name and accepts anonymous text feedback. The existing collection page at `/c/[slug]` moves to this public route.

Submitting feedback sends the text and campaign ID to the API. The backend looks up the campaign and supplies its name to the existing classifier. Category 1 saves the submitted text. Category 2 saves only the rewritten text. Categories 3 and 4 save nothing. The browser validates the minimum text length, shows “sent” immediately after Send, and dispatches the request without waiting for an API result. It does not retry or change the message based on the response, so a network or server failure can still show “sent.” Creator pages list only saved feedback, associated with its campaign.

The versioned API supports campaign creation, campaign listing, campaign detail, public campaign information needed by the collection page, feedback creation, and feedback listing for a campaign. `Authorization: Bearer test-key` is required for campaign creation, campaign listing, campaign detail with feedback, and feedback listing. Public campaign information and feedback creation do not require the key. The check belongs in middleware applied only to protected routes. The Next.js server holds the key and makes protected requests for the dashboard; the dashboard pages themselves do not require sign-in and can be viewed by anyone who opens them.

Use the frontend's existing NeoBrutalism Base UI components and conventions. Keep the current collection page heading and campaign context, but use the earlier feedback form design: one large textarea in an orange bordered box with an arrow submit button in its lower corner. The collection page should show a clear submission state without revealing the classifier category or rewrite. Dashboard and collection page data loads in the browser; server rendering is only needed for simple static text.

This version does not include user ownership, sign-in, editing or deleting campaigns, follow-up questions, or stronger access control. Campaign names and saved feedback displayed on dashboard pages are publicly viewable during this test.

## Technical design

Reuse the existing Go campaign model and service, removing the current user link and user filter. Add a persisted feedback record tied to a campaign ID. The saved record contains the creator-visible text and creation time; it does not contain the original text for category 2 or any category 3 or 4 submission. Keep campaign lookup and classification on the backend so the browser cannot provide its own campaign description. Preserve the existing feedback input validation and classifier decision validation.

Keep API routes under `/api/v1`. Use campaign IDs for page links and feedback association. Provide a public campaign read that exposes the campaign information required to render the collection page without granting access to saved feedback. Return only creator-visible feedback through protected list and detail responses. The temporary key is an exact header check; it is not a user identity or an authorization system for individual campaigns. Browser requests to the protected API go through same-origin Next.js route handlers so the key stays on the server. Public feedback submission also uses a same-origin route to avoid deployment-specific browser CORS settings.

Existing handler tests cover input and classifier errors using a stub Baseten server. Extend those seams and the database tests as needed rather than calling the live model in automated tests. The frontend is a Next.js app with an existing collection form at `/c/[slug]` and NeoBrutalism components already installed.

## Verification

Tests should cover protected routes with missing, incorrect, and exact keys; anonymous public campaign reads and submissions; creating and listing campaigns; campaign lookup failures; campaign-specific feedback listing; and all four classifier categories, including the fact that categories 3 and 4 return a sent result without a saved row. Verify that category 2 stores only the rewrite. Check the frontend routes, form submission states, and dashboard rendering with the repository's available frontend checks. Confirm that the key is absent from browser-delivered code and responses.

## Constraints

The fixed key and publicly viewable dashboard are temporary choices for public testing. Stronger access control is required before the dashboard should hold private feedback. The older MVP document describes a broader product and an older `/c/:slug` collection route; this spec governs this smaller campaign-feedback increment.
