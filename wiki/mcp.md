---
type: how-to
title: MCP Access
description: Connecting an external AI agent such as Claude Desktop to JobSync over MCP — generating a token, adding the connector, the tools an agent gets, and the limits.
feature: mcp
tags: [mcp, claude desktop, agent, connector, personal access token, integration, add job from chat, read jobs from chat, mcp-remote, streamable-http, token, revoke]
aliases: [model context protocol, connect claude, claude desktop integration, api token, personal access token, agent access, external agent]
status: stable
stale_after: 2027-09-02
---

# MCP Access

## What can an AI agent do with JobSync over MCP?

It can add and correct jobs, read back any job you have saved, add Question Bank entries, and save a job-match or resume review that it produced itself. JobSync runs a built-in MCP (Model Context Protocol) server, so a chat client such as Claude Desktop can write to your tracker without you switching to the app — paste a posting into your agent and ask it to add the job, and the company, title, location, source and tags resolve against your existing lists.

Every connection needs a personal access token you generate yourself, and each token is named — jobs it creates carry that name as their source. An agent that holds a token can write to every job you own, not only the jobs it added, so revoking the token is how you stop an agent.

JobSync runs no AI model on the MCP path. When the agent produces a match score or a resume review, it is the agent's own model doing the thinking; JobSync only hands over the material and stores the result.

## How do I generate an MCP access token?

Open the avatar menu at the bottom of the sidebar, choose **Settings**, then **MCP Access**, and click **Generate**. Name the token after the client you are connecting — "Claude Desktop", "Hermes" — because that name is what appears as the source on every job the token creates. Pick an expiry of 30, 90 or 365 days; 90 is the default.

The dialog that follows shows the full token once and never again. Copy it before you close the dialog, along with the ready-made config snippet for your client. If you lose it, revoke the token and generate a new one.

The same page shows your **Endpoint URL** at the top — it is your JobSync address with `/api/mcp` on the end — and lists every token you have, with its prefix, creation and expiry dates, last use and scopes. You can hold up to 10 tokens at a time.

## How do I add the connector to Claude Desktop?

Open Claude Desktop, go to **Settings → Developer → Edit Config** to open `claude_desktop_config.json`, and paste in the "Claude Desktop (via mcp-remote)" snippet from JobSync's token dialog. It looks like this:

```json
{
  "mcpServers": {
    "jobsync": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://<your-jobsync-url>/api/mcp",
        "--header",
        "Authorization: Bearer <your-token>"
      ]
    }
  }
}
```

Save the file and restart Claude Desktop fully — quit the app, don't just close the window. The JobSync tools then appear in the client's tool list.

`mcp-remote` is needed because Claude Desktop connects only to local servers; it bridges to JobSync's remote endpoint. If your JobSync URL is a plain `http://` address on your home network rather than `localhost` or HTTPS, `mcp-remote` refuses it unless you add `--allow-http` to the `args` list — the snippet in the token dialog already includes that flag when it detects such a URL.

## How do I connect a client other than Claude Desktop?

Use the streamable-HTTP snippet instead — clients such as OpenClaw and Hermes speak that transport natively and need no bridge:

```json
{
  "mcpServers": {
    "jobsync": {
      "type": "streamable-http",
      "url": "http://<your-jobsync-url>/api/mcp",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

Both snippets are shown in the token dialog with your real URL and token already filled in, so copying from there is safer than typing this out.

## Which tools does a connected agent get?

Thirteen. Ten of them write to your own data and three read it back:

- **add_job** — adds a job, resolving or creating company, title, location, source and tags by name, and reporting back what it matched versus created. If the agent sends no due date, the job gets one three days from today, the same as the Add Job form.
- **add_jobs_batch** — the same thing for up to 10 jobs in one call, for a scheduled run.
- **find_job** — checks by URL whether a posting is already saved, before adding it again.
- **get_job** — reads one saved job in full by its id: every field, the company, location and source, tags, notes, the stage timeline with interviewers, linked contacts, and the match analysis. It changes nothing.
- **list_jobs** — lists your saved jobs one line each, newest first, filtered by status, company, location, tag, applied flag, match score, origin or date range, sorted by created, applied or due date, and paged with a cursor.
- **search_jobs** — the same list narrowed by words in a job's title, company, description or notes, for a role you remember by name or a repost saved under a different link.
- **update_job** — corrects or enriches any job you own. Only the fields supplied change.
- **add_question** — adds an entry to your Question Bank, with tags resolved the same way.
- **review_resume** / **save_resume_review** — hands the agent your default resume and reviewing instructions, then stores the review it writes.
- **save_match_result** / **save_match_results_batch** — stores a job-fit analysis the agent produced, for any job you own. The agent calls it after add_job, update_job or get_job hands over a match directive.
- **save_cover_letter** — stores a cover letter the agent wrote for a job you own, as Markdown. Each call saves a new version and points the job at it; earlier versions stay in your documents in **Profile**.

Tokens are issued with the scopes needed for all of these, so there is nothing to configure per tool. Reading uses the `jobs:read` scope, which every new token carries; a token generated before that scope existed still carries `jobs:write`, and that is accepted for reads too, so nothing has to be re-issued.

## How do I get a job match or resume review from my agent?

For a match, add a job through the agent with the full posting text. JobSync picks the resume to match against — the resume linked to the job, or your default resume if the job has none, or your only resume if you have just one. It hands that resume to the agent and asks it to analyze the fit; the score, recommendation and write-up land on the job and render exactly like an in-app match, labelled "mcp / \<token name\>". To re-score a job already saved, ask the agent to score it again. It reads the job with **get_job**, which can hand back a match directive, so you do not have to edit the job first.

How complete the description is decides what happens. A posting of roughly 150 words or more gets a full match. A shorter one still gets matched, but the score is flagged **Provisional** on the job. A title-only entry gets no match offer at all — the agent is told to fetch the full posting and update the job first.

For a resume review, ask your agent to review your resume. It reviews your **default** resume only, and needs one with enough content to work from; the result appears on that resume in the app.

Both are two-step flows, so a match or review is saved only if your agent completes the second call. If it stops after the first, the job or resume simply has no result attached — nothing is half-written.

## How do I ask my agent what I have in the tracker?

Ask in plain words — "what's open?", "which Acme jobs haven't I applied to?", "what's due this week?" — and the agent calls **list_jobs**. Each job comes back as one line: id, title and company, status, applied and due dates, location, source, match score, where the job came from (the web app, a token name, the in-app chat, or a board scan), and the date you added it. The agent can narrow by status, company, location, tag, applied flag, match score, origin and date ranges, and sort by created, applied or due date. A page is 25 jobs by default and at most 100; when more match, the agent gets a cursor for the next page. Once it has an id, **get_job** returns the whole record.

When you remember a job by name rather than by link — "the staff platform role at Northwind" — the agent uses **search_jobs**, which looks for the words in each job's title, company, description and notes and takes every filter list_jobs does. This is also how a repost is caught: a posting that comes back under a new URL is invisible to **find_job**, which checks the exact link, but search_jobs finds the earlier copy by title and company. Give the agent a URL and it uses find_job; give it words and it uses search_jobs.

Two things stay hidden here exactly as they are in the app. Dismissed board discoveries do not appear unless the agent asks for them by discovery status, and a match score the app shows as unanalyzed is not shown or filterable, so an agent never learns more from these tools than you can see yourself.

## Why is my agent not connecting or not seeing the tools?

Work through these in order. Check that the endpoint URL in your config matches the one shown on the **MCP Access** page, including `/api/mcp`. Check that the token has not expired or been revoked — the tokens list shows expiry, and a revoked token stops working immediately. Restart the client fully after editing its config; most clients read it only at startup.

If the connection works but calls start failing, you may have hit the rate limit: 60 MCP requests per hour across all tools and all your tokens. A batch call spends one request per item, and adding a job then saving its match spends two.

If you self-host with `NODE_ENV=production`, the MCP server is off unless the environment variable `MCP_ENABLED` is set to `true`. That and every other setting are covered in the [project README](https://github.com/Gsync/jobsync#readme).

## How do I revoke a token or see which agent added a job?

Click the trash icon next to a token on **Settings → MCP Access** and confirm. Any agent using it loses access straight away, and this cannot be undone — the client will need a new token pasted into its config.

Revoking does not delete anything the token created. Jobs it added stay in your tracker with that token's name recorded as their source, which is how you tell an agent-added job from one you entered yourself. Editing such a job in the app is normal in every way.

An agent's writes reach every job you own, not only the jobs it added, so a token is full write access to your tracker. Revoking the token is the way to stop an agent — once its token is gone, it can read and write nothing.
