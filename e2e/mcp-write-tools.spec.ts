import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  test,
  expect,
  uniqueName,
  createNewJob,
  type CleanupRegistry,
} from "./fixtures";
import { type Page } from "@playwright/test";

// A posting of at least 150 words so classifyDescriptionCompleteness returns
// "full": that clears buildMatchOffer's title-only word-count gate
// (DESCRIPTION_FULL_MIN_WORDS = 150), not merely the 200-char preprocessJob
// floor, so the re-score read returns a directive rather than a note.
const FULL_POSTING =
  "We are seeking a dedicated and experienced full stack software engineer " +
  "to join our growing product engineering team and help us build the next " +
  "generation of our customer facing platform. In this role you will design, " +
  "develop, test, and ship features end to end across the entire stack, " +
  "working closely with product managers, designers, and fellow engineers to " +
  "turn ideas into reliable, well tested software. You will own services " +
  "written in TypeScript and Node, build responsive interfaces with React, " +
  "model data in relational databases, and improve the performance, " +
  "observability, and security of everything you touch. We expect strong " +
  "communication skills, a pragmatic approach to trade offs, and a genuine " +
  "care for the people who use what we build. You should be comfortable " +
  "mentoring junior engineers, reviewing pull requests thoughtfully, and " +
  "contributing to technical planning. Experience with cloud infrastructure, " +
  "continuous integration, and automated testing is highly valued. We offer " +
  "competitive compensation, flexible remote work, and real opportunities to " +
  "grow your career with us over time.";

// A resume whose serialized text clears preprocessResume's 200-char floor
// (src/lib/ai/tools/preprocessing.ts:45) — createResumeForMatching alone
// serializes to about 130 characters, so the Summary here is deliberately
// long — and with two sections so hasMinResumeSections lets it become the
// default. Marked default (D5) so resolveResumeForAgent resolves it for the
// job, whose createdVia is null and which carries no linked resume.
async function seedDefaultMatchableResume(
  page: Page,
  title: string,
  cleanup: CleanupRegistry,
) {
  await page.goto("/dashboard/profile");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add New Resume" }).click();
  await page.getByPlaceholder("Ex: Full Stack Developer").fill(title);
  await page.getByRole("button", { name: "Save" }).click();
  cleanup.resume(title);

  const row = page.getByRole("row", { name: new RegExp(title, "i") }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.getByTestId("document-actions-menu-btn").click();
  await page.getByRole("link", { name: "View/Edit Resume" }).click();
  await expect(page.getByRole("heading", { name: "Resume" })).toBeVisible();

  // Section 1: Summary (long enough on its own to clear the 200-char floor).
  await page.getByRole("button", { name: "Add Section" }).click();
  await page.getByRole("menuitem", { name: "Add Summary" }).click();
  await page.getByLabel("Section Title").fill("Summary");
  await page.locator(".tiptap").click();
  await page
    .locator(".tiptap")
    .fill(
      "Full stack software engineer with over ten years of experience " +
        "designing, building and shipping reliable web applications end to " +
        "end. Deep expertise in TypeScript, React, Node and relational " +
        "databases, with a strong track record of mentoring engineers, " +
        "reviewing code carefully and improving performance, observability " +
        "and security across large production systems.\n",
    );
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible({
    timeout: 20000,
  });

  // Section 2: Certification — lightest second section, adds no Library rows.
  await page.getByRole("button", { name: "Add Section" }).click();
  await page
    .getByRole("menuitem", { name: "Add Certification / License" })
    .click();
  await page
    .getByPlaceholder("Ex: AWS Certified Solutions Architect")
    .fill("AWS Solutions Architect");
  await page
    .getByPlaceholder("Ex: Amazon Web Services")
    .fill("Amazon Web Services");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("AWS Solutions Architect")).toBeVisible({
    timeout: 20000,
  });

  // Mark it default. A confirm dialog appears only when a different resume
  // already holds the default on the shared user; handle both outcomes.
  await page.goto("/dashboard/profile");
  const defaultRow = page
    .getByRole("row", { name: new RegExp(title, "i") })
    .first();
  await expect(defaultRow).toBeVisible({ timeout: 20000 });
  await defaultRow.getByTestId("document-actions-menu-btn").click();
  await page.getByRole("menuitem", { name: "Set as default" }).click();

  const confirmButton = page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Set as default" });
  const defaultBadge = page
    .getByRole("row", { name: new RegExp(title, "i") })
    .first()
    .getByText("Default", { exact: true });
  await expect(confirmButton.or(defaultBadge).first()).toBeVisible({
    timeout: 20000,
  });
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
  await expect(defaultBadge).toBeVisible({ timeout: 20000 });
}

function toolText(result: { content: unknown }): string {
  return (result.content as Array<{ type: string; text?: string }>)
    .map((c) => c.text ?? "")
    .join("\n");
}

// Drives the shipped write tools over the real MCP protocol against an
// app-created job (createdVia null), proving update_job, list_jobs,
// save_cover_letter and get_job end to end — auth, routing and handlers — not
// just the unit-tested functions in isolation.
test.describe("MCP write tools", () => {
  test("update_job, list_jobs, save_cover_letter and get_job on an app job", async ({
    page,
    baseURL,
    cleanup,
  }) => {
    const tokenName = uniqueName("e2e mcp write token");
    const resumeTitle = uniqueName("e2e match resume");
    const jobTitle = uniqueName("mcp write job");

    // Issue a token through the Settings UI, exactly as mcp-add-job does.
    await page.goto("/dashboard/settings");
    await page.getByText("MCP Access").click();
    await page.getByRole("button", { name: "Generate" }).click();
    await page.getByPlaceholder("e.g. Claude Desktop").fill(tokenName);
    await page.getByRole("button", { name: "Generate" }).click();
    cleanup.mcpToken(tokenName);

    const revealDialog = page.getByRole("dialog", { name: "Token Created" });
    await expect(revealDialog).toBeVisible();
    const token = await revealDialog.getByRole("textbox").inputValue();
    expect(token).toMatch(/^jsync_/);
    await page.getByRole("button", { name: "I saved my token" }).click();

    // Seed and default a resume the match directive can resolve, then add a
    // job through the app form (createdVia null) that update_job must reach.
    await seedDefaultMatchableResume(page, resumeTitle, cleanup);
    await page.goto("/dashboard/myjobs");
    const jobId = await createNewJob(page, jobTitle, cleanup);

    const transport = new StreamableHTTPClientTransport(
      new URL("/api/mcp", baseURL),
      { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const client = new Client({ name: "e2e-test-client", version: "1.0.0" });
    await client.connect(transport);

    // update_job on the app-created job: a full-length posting re-classifies
    // the description, and the job is updated despite its null createdVia.
    const updateResult = await client.callTool({
      name: "update_job",
      arguments: { jobId, jobDescription: FULL_POSTING },
    });
    expect(toolText(updateResult)).toContain(`Job ${jobId} updated.`);

    // list_jobs: the row for this job ends with the date it was added (today,
    // UTC), the tenth field appended by task 5.
    const today = new Date().toISOString().slice(0, 10);
    const listResult = await client.callTool({
      name: "list_jobs",
      arguments: {},
    });
    const rowLine = toolText(listResult)
      .split("\n")
      .find((line) => line.startsWith(jobId));
    expect(rowLine).toBeTruthy();
    expect(rowLine!.endsWith(`added ${today}`)).toBe(true);

    // save_cover_letter: store an agent-written letter and register the new
    // row for teardown, then confirm it shows in the job's Cover Letter tab.
    const letterMarker = uniqueName("Cover letter body");
    const saveResult = await client.callTool({
      name: "save_cover_letter",
      arguments: {
        jobId,
        text: `${letterMarker}\n\nThank you for considering my application for this role.`,
      },
    });
    const saveText = toolText(saveResult);
    expect(saveText).toContain(`Cover letter saved for job ${jobId}:`);
    const letterId = saveText.match(/\(id: ([^)]+)\)/)?.[1];
    expect(letterId).toBeTruthy();
    cleanup.coverLetter(letterId!);

    await page.goto(`/dashboard/myjobs/${jobId}?tab=letter`);
    await expect(page.getByText(letterMarker)).toBeVisible();

    // get_job with matchDirective: with a matchable default resume and the
    // full description, the reply carries the save_match_result call-back.
    const getResult = await client.callTool({
      name: "get_job",
      arguments: { jobId, matchDirective: true },
    });
    expect(toolText(getResult)).toContain("Then call save_match_result with:");

    await client.close();
  });
});
