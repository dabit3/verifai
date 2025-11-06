import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  EIGENAI_MODEL,
  MAX_RUNS,
  MIN_RUNS,
  OPENAI_MODEL,
} from "@/lib/constants";

const OPENAI_DEFAULT_URL = "https://api.openai.com/v1/chat/completions";
const EIGEN_DEFAULT_URL =
  "https://eigenai.eigencloud.xyz/v1/chat/completions";

type CompareRequest = {
  prompt?: string;
  runs?: number;
  eigenSeed?: number;
  openaiMaxTokens?: number;
  eigenMaxTokens?: number;
};

type ChatChoice = {
  message?: {
    content?: string;
  };
  finish_reason?: string;
};

type ChatResponse = {
  id?: string;
  choices?: ChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const OPENAI_TIMEOUT_MS = 20_000;

export async function POST(request: NextRequest) {
  const body = (await safeJson<CompareRequest>(request)) ?? {};
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const eigenKey = process.env.EIGENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  if (!eigenKey) {
    return NextResponse.json(
      { error: "Missing EIGENAI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const openaiModel = OPENAI_MODEL;
  const eigenModel = EIGENAI_MODEL;

  const runs = clamp(Math.floor(body.runs ?? 4), MIN_RUNS, MAX_RUNS);
  const eigenSeed =
    Number.isFinite(body.eigenSeed) && body.eigenSeed !== undefined
      ? Math.floor(body.eigenSeed)
      : Number.parseInt(
          process.env.NEXT_PUBLIC_EIGENAI_DEFAULT_SEED ?? "42",
          10
        );
  const openaiMaxTokens =
    body.openaiMaxTokens ??
    parseInt(process.env.OPENAI_MAX_TOKENS ?? "256", 10);
  const eigenMaxTokens =
    body.eigenMaxTokens ??
    parseInt(process.env.EIGENAI_MAX_TOKENS ?? "256", 10);

  const randomSeedUuid = randomUUID();
  const randomSeed = uuidToSeed(randomSeedUuid);

  const openaiEndpoint =
    process.env.OPENAI_API_URL?.trim() || OPENAI_DEFAULT_URL;
  const eigenEndpoint =
    process.env.EIGENAI_API_URL?.trim() || EIGEN_DEFAULT_URL;

  try {
    const [openaiResults, eigenResult, eigenRandomResult] = await Promise.all([
      collectOpenAiRuns({
        endpoint: openaiEndpoint,
        apiKey: openaiKey,
        model: openaiModel,
        prompt,
        runs,
        maxTokens: openaiMaxTokens,
      }),
      collectEigenRuns({
        endpoint: eigenEndpoint,
        apiKey: eigenKey,
        model: eigenModel,
        prompt,
        seed: eigenSeed,
        runs,
        maxTokens: eigenMaxTokens,
      }),
      collectEigenRuns({
        endpoint: eigenEndpoint,
        apiKey: eigenKey,
        model: eigenModel,
        prompt,
        seed: randomSeed,
        runs,
        maxTokens: eigenMaxTokens,
        seedUuid: randomSeedUuid,
      }),
    ]);

    return NextResponse.json({
      prompt,
      openai: openaiResults,
      eigen: eigenResult,
      eigenRandom: eigenRandomResult,
    });
  } catch (error) {
    console.error("LLM comparison failed:", error);
    return NextResponse.json(
      { error: "Failed to compare models. Check server logs for details." },
      { status: 500 }
    );
  }
}

async function collectOpenAiRuns(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  runs: number;
  maxTokens: number;
}) {
  const { endpoint, apiKey, model, prompt, runs, maxTokens } = options;
  const responses = await Promise.all(
    Array.from({ length: runs }, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: maxTokens,
            temperature: 1,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(`OpenAI HTTP ${response.status}: ${message}`);
        }

        const data = (await response.json()) as ChatResponse;
        return {
          responseId: data.id,
          message: extractMessage(data) ?? "",
          finishReason: data.choices?.[0]?.finish_reason,
          usage: data.usage,
        };
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  return {
    model,
    runs,
    responses,
  };
}

async function collectEigenRuns(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  seed: number;
  runs: number;
  maxTokens: number;
  seedUuid?: string;
}) {
  const { endpoint, apiKey, model, prompt, seed, runs, maxTokens, seedUuid } =
    options;

  const responses = await Promise.all(
    Array.from({ length: runs }, () =>
      callEigenAiRun({
        endpoint,
        apiKey,
        model,
        prompt,
        seed,
        maxTokens,
      })
    )
  );

  return {
    model,
    seed,
    runs,
    responses,
    seedUuid,
  };
}

async function callEigenAiRun(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  seed: number;
  maxTokens: number;
}) {
  const { endpoint, apiKey, model, prompt, seed, maxTokens } = options;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      seed,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`EigenAI HTTP ${response.status}: ${message}`);
  }

  const data = (await response.json()) as ChatResponse;
  return {
    responseId: data.id,
    message: parseEigenMessage(extractMessage(data) ?? ""),
    finishReason: data.choices?.[0]?.finish_reason,
    usage: data.usage,
  };
}

async function safeJson<T>(request: NextRequest): Promise<T | undefined> {
  try {
    const text = await request.text();
    return text ? (JSON.parse(text) as T) : undefined;
  } catch (error) {
    console.warn("Failed to parse JSON body:", error);
    return undefined;
  }
}

function extractMessage(data: ChatResponse) {
  const choice = data.choices?.[0];
  return choice?.message?.content?.trim();
}

function parseEigenMessage(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const lastEndTag = trimmed.lastIndexOf("<|end|>");
  const withoutPreceding = lastEndTag !== -1 ? trimmed.slice(lastEndTag + 6) : trimmed;

  const cleanedTags = withoutPreceding.replace(/<\|[^>]+?\|>/g, "");

  return cleanedTags
    .split("\n")
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .join("\n")
    .trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uuidToSeed(uuid: string) {
  const hex = uuid.replace(/-/g, "").slice(0, 8);
  const value = Number.parseInt(hex, 16) || 0;
  return value & 0x7fffffff;
}
