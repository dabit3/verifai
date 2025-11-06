"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EIGENAI_MODEL,
  MAX_RUNS,
  MIN_RUNS,
  OPENAI_MODEL,
} from "@/lib/constants";

type CompareRun = {
  responseId?: string;
  message: string;
  finishReason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type CompareResult = {
  prompt: string;
  openai: {
    model: string;
    runs: number;
    responses: CompareRun[];
  };
  eigen: {
    model: string;
    seed: number;
    runs: number;
    responses: CompareRun[];
  };
  eigenRandom: {
    model: string;
    seed: number;
    seedUuid?: string;
    runs: number;
    responses: CompareRun[];
  };
};

const defaultPrompt = "What are the top 5 restaurants in Tokyo? Names only in a comma separated list.";
const envSeed = Number.parseInt(
  process.env.NEXT_PUBLIC_EIGENAI_DEFAULT_SEED ?? "",
  10
);
const defaultSeed = Number.isNaN(envSeed) ? 42 : envSeed;

export default function Home() {
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const defaultRuns = Math.min(4, MAX_RUNS);
  const [runs, setRuns] = useState(defaultRuns);
  const [runsInput, setRunsInput] = useState(String(defaultRuns));
  const [eigenSeed, setEigenSeed] = useState(defaultSeed);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const handleReset = () => {
    setPrompt(defaultPrompt);
    setRuns(defaultRuns);
    setRunsInput(String(defaultRuns));
    setEigenSeed(defaultSeed);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          runs,
          eigenSeed,
        }),
      });

      const payload = (await response.json()) as
        | CompareResult
        | { error?: string };

      if (!response.ok) {
        throw new Error(payload?.error || "Request failed.");
      }

      setResult(payload as CompareResult);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unexpected error.";
      setError(message);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background py-12 font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
        <header className="flex items-center justify-between rounded-2xl bg-card/80 px-5 py-4 ">
          <div className="flex items-center gap-3">
            <Image
              src={theme === "dark" ? "/eigencloud_logo.png" : "/eigencloud_logo_black.png"}
              alt="Eigencloud"
              width={144}
              height={107}
              priority
              className="h-10 w-auto sm:h-12"
            />
            {/* <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-blue-700 dark:text-primary">
                VerifAI
              </span>
              <span className="text-xs text-muted-foreground">
                Deterministic inference runs with EigenAI.
              </span>
            </div> */}
          </div>
          <ThemeToggle />
        </header>

        <Separator className="border-border/50" />

        <section className="grid gap-4 text-center sm:text-left">
          <Badge className="w-fit gap-1.5 bg-blue-700/10 text-blue-700 dark:bg-blue-700/20 dark:text-blue-200">
            <ShieldCheck className="h-4 w-4 text-current" />
            Deterministic vs non-deterministic inference
          </Badge>
          <h1 className="text-pretty text-4xl font-semibold tracking-tight sm:text-8xl">
            VERIFIABLE AI
          </h1>
          <p className="max-w-3xl text-balance text-muted-foreground sm:text-lg">
            Run the same prompt. OpenAI produces varied responses, while EigenAI returns a seed-controlled response you can reproduce and verify any time.
          </p>
        </section>

        <Card className="border bg-card/80 shadow-lg">
          <CardHeader>
            <CardTitle>Run a comparison</CardTitle>
            <CardDescription>
              Compare OpenAI non-deterministic inference with EigenAI deterministic inference.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-6 sm:grid-cols-[2fr,1fr]">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask the models anything..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="runs">Inference runs</Label>
                    <Input
                      id="runs"
                      type="number"
                      min={MIN_RUNS}
                      max={MAX_RUNS}
                      value={runsInput}
                      onChange={(event) => {
                        const { value } = event.target;
                        if (value === "") {
                          setRunsInput("");
                          return;
                        }

                        const parsed = Number.parseInt(value, 10);
                        if (Number.isNaN(parsed)) {
                          return;
                        }

                        const clamped = Math.min(Math.max(parsed, MIN_RUNS), MAX_RUNS);
                        setRunsInput(String(clamped));
                        setRuns(clamped);
                      }}
                      onBlur={() => {
                        if (runsInput === "") {
                          setRuns(MIN_RUNS);
                          setRunsInput(String(MIN_RUNS));
                          return;
                        }

                        const parsed = Number.parseInt(runsInput, 10);
                        if (Number.isNaN(parsed)) {
                          setRuns(MIN_RUNS);
                          setRunsInput(String(MIN_RUNS));
                          return;
                        }

                        const clamped = Math.min(Math.max(parsed, MIN_RUNS), MAX_RUNS);
                        setRuns(clamped);
                        setRunsInput(String(clamped));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Demonstrates variation across repeated calls. Range: {MIN_RUNS}
                      &ndash;{MAX_RUNS}.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="seed">EigenAI seed</Label>
                    <Input
                      id="seed"
                      type="number"
                      value={eigenSeed}
                      onChange={(event) =>
                        setEigenSeed(Number.parseInt(event.target.value, 10) || 0)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Same seed ensures identical output for matching prompts (default {defaultSeed}).
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    EigenAI is deterministic by default. Change the seed to
                    produce alternate, yet reproducible, responses.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-700 text-white hover:bg-blue-700/90 focus-visible:ring-blue-700/40"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running comparison…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                  Run comparison
                  </span>
                )}
              </Button>
              {result || error ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={handleReset}
                  className="border-blue-700/40 text-blue-700 hover:bg-blue-700/10 hover:text-blue-800 focus-visible:ring-blue-700/40 dark:border-blue-700/50 dark:text-blue-200 dark:hover:bg-blue-700/20 dark:hover:text-blue-100"
                >
                  Reset
                </Button>
              ) : null}
            </CardFooter>
          </form>
        </Card>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:col-span-3 lg:grid lg:grid-cols-3">
            <span>OpenAI</span>
            <span className="text-center">EigenAI (seeded)</span>
            <span className="text-right">EigenAI (random seed)</span>
          </div>

          <Card>
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  OpenAI sampling
                </div>
                <Badge
                  variant="secondary"
                  className="px-2 py-0 bg-blue-700/10 text-blue-700 dark:bg-blue-700/20 dark:text-blue-200"
                >
                  {OPENAI_MODEL}
                </Badge>
              </div>
              <CardTitle className="text-xl">
                {result
                  ? `${result.openai.runs} run${
                      result.openai.runs === 1 ? "" : "s"
                    } — ${result.openai.model}`
                  : `Awaiting run`}
              </CardTitle>
              <CardDescription>
                Repeated calls vary because sampling, hardware, and load can
                influence outputs.
              </CardDescription>
            </CardHeader>
            {result ? (
              <CardContent className="grid gap-4">
                {result.openai.responses.map((response, index) => (
                  <div
                    key={`${response.responseId ?? "run"}-${index}`}
                    className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm shadow-sm"
                  >
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <span>Run {index + 1}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {response.message || "No content returned."}
                    </p>
                    <UsageDetails usage={response.usage} />
                  </div>
                ))}
                {result.openai.responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No responses were returned. Check your credentials and model
                    availability.
                  </p>
                ) : null}
              </CardContent>
            ) : (
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  OpenAI responses illustrate typical model variance across
                  repeated calls with the same prompt.
                </p>
                <p>
                  Call the API multiple times and you&apos;ll see subtle
                  differences in tone, ordering, and wording even with
                  temperature 1.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  EigenAI
                </div>
                <Badge
                  variant="secondary"
                  className="px-2 py-0 bg-blue-700/10 text-blue-700 dark:bg-blue-700/20 dark:text-blue-200"
                >
                  {EIGENAI_MODEL}
                </Badge>
              </div>
              <CardTitle className="text-xl">
                {result
                  ? `${result.eigen.runs} run${
                      result.eigen.runs === 1 ? "" : "s"
                    } - seed ${result.eigen.seed}`
                  : `Awaiting run`}
              </CardTitle>
              <CardDescription>
                Identical inputs yield identical outputs. Change the seed to
                explore controlled variation.
              </CardDescription>
              {/* {result ? (
                <p className="font-semibold text-xs font-medium text-muted-foreground">
                  Seed {result.eigen.seed} in use for EigenAI.
                </p>
              ) : null} */}
            </CardHeader>
            {result ? (
              <CardContent className="grid gap-4">
                {result.eigen.responses.map((response, index) => (
                  <div
                    key={`${response.responseId ?? "deterministic"}-${index}`}
                    className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm shadow-sm"
                  >
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <span>Run {index + 1}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {response.message || "No content returned."}
                    </p>
                    <UsageDetails usage={response.usage} />
                  </div>
                ))}
                {result.eigen.responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No responses were returned. Check your credentials and model
                    availability.
                  </p>
                ) : null}
              </CardContent>
            ) : (
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  EigenAI produces bit-for-bit identical outputs for matching
                  prompts, parameters, and seed.
                </p>
                <p>
                  Inference is reproducible across hardware and time, and anyone
                  can verify both prompt and response integrity with EigenAI&apos;s
                  audit trail.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  EigenAI random
                </div>
                <Badge
                  variant="secondary"
                  className="px-2 py-0 bg-blue-700/10 text-blue-700 dark:bg-blue-700/20 dark:text-blue-200"
                >
                  {EIGENAI_MODEL}
                </Badge>
              </div>
              <CardTitle className="text-xl">
                {result
                  ? `${result.eigenRandom.runs} run${
                      result.eigenRandom.runs === 1 ? "" : "s"
                    } — seed ${result.eigenRandom.seed}`
                  : `Awaiting run`}
              </CardTitle>
              <CardDescription>
                Demonstrates how UUID-derived seeds produce distinct but
                reproducible outputs.
              </CardDescription>
            </CardHeader>
            {result ? (
              <CardContent className="grid gap-4">
                {result.eigenRandom.responses.map((response, index) => (
                  <div
                    key={`${response.responseId ?? "random"}-${index}`}
                    className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm shadow-sm"
                  >
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <span>Run {index + 1}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {response.message || "No content returned."}
                    </p>
                    <UsageDetails usage={response.usage} />
                  </div>
                ))}
                {result.eigenRandom.responses.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Seed UUID: {result.eigenRandom.seedUuid ?? "n/a"}
                  </p>
                )}
                {result.eigenRandom.responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No responses were returned. Check your credentials and model
                    availability.
                  </p>
                ) : null}
              </CardContent>
            ) : (
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  On run, we derive a numeric seed from a UUID to prompt EigenAI,
                  highlighting how seed changes shape the response.
                </p>
                <p>
                  Capture the seed to reproduce the random output or trigger the
                  run again for a fresh variant.
                </p>
              </CardContent>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}

function UsageDetails({
  usage,
}: {
  usage: CompareRun["usage"] | undefined;
}) {
  if (!usage) {
    return null;
  }

  return (
    <dl className="mt-3 grid grid-cols-3 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
      <div>
        <dt>Prompt tokens</dt>
        <dd className="font-semibold text-foreground">
          {usage.prompt_tokens ?? "—"}
        </dd>
      </div>
      <div>
        <dt>Completion</dt>
        <dd className="font-semibold text-foreground">
          {usage.completion_tokens ?? "—"}
        </dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd className="font-semibold text-foreground">
          {usage.total_tokens ?? "—"}
        </dd>
      </div>
    </dl>
  );
}
