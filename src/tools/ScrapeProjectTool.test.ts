import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { AppConfig } from "../utils/config";
import { ValidationError } from "./errors";
import { ScrapeProjectTool } from "./ScrapeProjectTool";

const scraperConfig = {
  maxPages: 100,
  maxDepth: 3,
  maxConcurrency: 1,
} as unknown as AppConfig["scraper"];

describe("ScrapeProjectTool", () => {
  let root: string;
  let enqueue: Mock;
  let tool: ScrapeProjectTool;

  beforeEach(async () => {
    root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "scrape-project-"));
    enqueue = vi.fn(async () => "job-1");
    const pipeline = { enqueueScrapeJob: enqueue } as unknown as IPipeline;
    tool = new ScrapeProjectTool(pipeline, scraperConfig);
  });

  afterEach(async () => {
    await fsPromises.rm(root, { recursive: true, force: true });
  });

  it("throws ValidationError for an empty path", async () => {
    await expect(tool.execute({ path: "" })).rejects.toThrow(ValidationError);
  });

  it("enqueues one scrape job per dependency with a doc URL", async () => {
    await fsPromises.writeFile(
      path.join(root, "build.gradle.kts"),
      `plugins {
    id("com.android.application") version "8.2.0"
}
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
`,
    );

    const { jobs } = await tool.execute({ path: root });
    const byCoord = Object.fromEntries(jobs.map((j) => [j.coordinate, j]));

    expect(byCoord["com.squareup.okhttp3:okhttp"]).toMatchObject({
      version: "4.12.0",
      url: "https://javadoc.io/static/com.squareup.okhttp3/okhttp/4.12.0/index.html",
      jobId: "job-1",
    });
    expect(byCoord["com.android.application"].url).toBe(
      "https://plugins.gradle.org/plugin/com.android.application/8.2.0",
    );
    // A job was enqueued for each mapped dependency.
    expect(enqueue).toHaveBeenCalledTimes(2);
    // Pinned version is passed to the pipeline (not a constraint).
    expect(enqueue).toHaveBeenCalledWith(
      "com.squareup.okhttp3:okhttp",
      "4.12.0",
      expect.objectContaining({ url: byCoord["com.squareup.okhttp3:okhttp"].url }),
    );
  });

  it("enqueues constraint-versioned pub deps unversioned (no ScrapeTool rejection)", async () => {
    await fsPromises.writeFile(
      path.join(root, "pubspec.yaml"),
      "dependencies:\n  http: ^1.1.0\n",
    );

    const { jobs, skipped } = await tool.execute({ path: root });
    const httpJob = jobs.find((j) => j.coordinate === "http");

    expect(httpJob).toMatchObject({
      version: null,
      url: "https://pub.dev/packages/http",
    });
    expect(enqueue).toHaveBeenCalledWith("http", null, expect.anything());
    expect(skipped).toEqual([]);
  });

  it("returns empty jobs for an empty project", async () => {
    const { jobs, skipped, warnings } = await tool.execute({ path: root });
    expect(jobs).toEqual([]);
    expect(skipped).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
