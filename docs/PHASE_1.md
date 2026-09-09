# Truth Be Told — Phase 1

Status: agreed scope

Relationship to other docs: `MVP.md` describes the full product. This document
describes only what phase 1 ships, and it wins where the two disagree.

## 1. What phase 1 is

One sentence: a creator can publish a feedback link, and anonymous feedback
arrives in their inbox already screened.

Everything else — themes, summaries, shareable reports, media uploads,
notifications — waits.

## 2. The creator

### Signing in

Sign in with Google. Nothing else. No email/password, no profile setup, no
onboarding.

### Creating a campaign

A campaign is a title and a plain-text description of what the feedback is
about. No images, no attachments, no formatting, no expiry date.

Creating one produces a public link the creator can copy and share anywhere.

### Living with a campaign

Campaigns stay open forever in phase 1. There is no close button, no delete, no
archive. If the creator wants it to stop, that is a phase 2 problem.

### Reading feedback

The creator has a list of their campaigns. Opening one shows the feedback that
was passed through, newest first.

Some items carry a small **edited for tone** marker. That means the original
was blunt enough to need rewording, and what the creator is reading is the
reworded version. The creator cannot open the original — there is no button, no
link, no way. The point of rewording is undone the moment the raw text is one
click away.

The creator sees no trace of what was withheld. No count, no placeholder, no
"3 messages were blocked". A withheld message simply never existed as far as
the dashboard is concerned.

## 3. The submitter

### Arriving

The link opens a page with the campaign title, the creator's description, and
one large text box. No account, no sign-in, no email, no name required.

Before typing, the page tells them plainly:

- Their message is anonymous.
- The wording may be adjusted before the creator sees it, without changing what
  they meant.
- Feedback that is only an attack, or that says nothing usable, will not be
  passed on.

This is stated up front, not buried, and not sprung on them afterwards.

### Sending

They write, they send, they wait a moment while the message is screened. Then
one of two things happens.

**Most of the time:** a thank-you, and they are done.

**Sometimes:** the page tells them their feedback wasn't clear enough to be
useful, and invites them to try once more. This happens at most once per
submission — never twice, never a back-and-forth conversation. Whatever they
write the second time is screened on its own merits and that is the end of it.

### What they are never told

Every ending looks the same. A submitter who wrote something excellent, a
submitter whose wording was softened, and a submitter whose message was
withheld all see the identical thank-you.

They are not told their message was blocked. They are not told it was reworded.
They are not shown a preview of the reworded version.

This is deliberate. Telling someone their message was rejected hands them a way
to test phrasings until something slips through.

## 4. How a message is handled

Every message is screened and lands in one of four outcomes.

| Outcome | What it means | What happens |
|---|---|---|
| **Show it** | Useful, whether or not it is kind | Passed through word for word |
| **Reword it** | A real point buried in contempt | Reworded, passed through, marked *edited for tone* |
| **Too vague** | No hostility, but nothing to act on | One chance to try again, then dropped |
| **Withhold** | Aimed at the person, or contempt with nothing left underneath | Dropped immediately, no second chance |

Two rules worth stating outright, because they are easy to get backwards:

**Harsh is not the same as unusable.** "The second coat is streaky and it ruins
the piece" is blunt, unwelcome, and gets passed through untouched. Bluntness is
information. The product is not in the business of making feedback pleasant.

**An attack gets no second chance.** A vague message gets one retry because the
person may simply not have known what to write. A message aimed at who someone
is, rather than at what they did or made, is not a communication problem and
does not get coached into acceptability.

### The retry, precisely

- Only a vague message triggers it. An attack never does.
- It happens once per submission. There is no second retry under any
  circumstance.
- The retry replaces the original message rather than adding to it — the second
  attempt is judged on its own.
- The original attempt is kept internally so decisions can be reviewed later. It
  is not creator-visible.
- If the retry is still vague, it is dropped. If the retry is an attack, it is
  dropped. Same thank-you either way.

## 5. Behaviour the product guarantees

- Nothing reaches the creator unscreened. If screening fails for any reason —
  timeout, error, anything — the message is held rather than shown. A failure
  never becomes a publication.
- A submitter never waits on a failure. If something goes wrong behind the
  scenes, they still get their thank-you and the message is sorted out
  afterwards.
- The original text of a reworded or withheld message is never reachable from
  anything the creator can open.
- Feedback is anonymous. If a submitter chooses to identify themselves in the
  text, that is theirs to do.

## 6. Keeping it from being abused

Phase 1 carries the minimum that stops one person with a script from draining
the screening budget:

- A cap on how many submissions can come from one network connection to one
  campaign in a given window.
- A cap on message length.
- A browser-level reminder that says "you've already responded here" — a
  courtesy, not a lock. Anyone determined can clear it, which is fine.

Two things this deliberately does not do. It does not identify devices — that
is not something a website can do, whatever a vendor claims. And it does not
lock out a whole network: a lecture hall, an office, or a phone carrier puts
hundreds of people behind one connection, and those are exactly the audiences a
campaign is shared with. The cap is set to stop a loop, not to enforce one
response per human.

CAPTCHA is not in phase 1. It goes in the moment real abuse shows up.

## 7. Not in phase 1

Named so nobody has to guess:

- Grouping feedback into themes
- Campaign summaries or suggested actions
- Shareable public report links
- Images, video, audio, or any file upload
- Closing, deleting, or expiring a campaign
- Email or push notifications
- Editing a campaign after creation
- Any second follow-up question, or a conversational back-and-forth
- Any indication to the creator that something was withheld
- Teams, organisations, or more than one creator per campaign

## 8. Phase 1 is done when

- Someone signs in with Google, creates a campaign, and copies its link.
- A stranger opens that link and sends feedback without an account.
- Blunt but useful feedback arrives intact.
- Contemptuous-but-pointed feedback arrives reworded and marked.
- A vague message gets exactly one nudge, and one only.
- An attack is dropped on the spot, and its author cannot tell.
- Every submitter, whatever happened, sees the same thank-you.
- The creator's inbox contains no attacks, and no route to any original text.
