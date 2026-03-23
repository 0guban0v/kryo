#!/usr/bin/env python3
"""
Kryo demo agent — runs against a local vllm-mlx inference server.

Usage:
    python scripts/demo-agent.py

Requires:
    pip install anthropic requests
    vllm-mlx running on localhost:8000
    Kryo MCP running on localhost:3100
"""

import json
import os
import re
import sys
import uuid

import anthropic
import requests

THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)

VLLM_BASE_URL = "http://localhost:8000"
KRYO_MCP_URL = "http://localhost:3100/mcp"
MODEL = "default"
def _resolve_llm_api_key() -> str:
    key = os.environ.get("LLM_API_KEY", "")
    if key:
        return key
    env_file = os.environ.get("ENV_FILE", "")
    if env_file and os.path.isfile(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith("LLM_API_KEY="):
                    return line[len("LLM_API_KEY="):].strip()
    return ""


LLM_API_KEY = _resolve_llm_api_key()


def _llm_headers() -> dict:
    if LLM_API_KEY:
        return {"Authorization": f"Bearer {LLM_API_KEY}"}
    return {}
MAX_TURNS = 20

SUMMARY_PROMPT = """Card: {card_title}
PR: #{pr_number} (merged and closed)

Write exactly two sentences as a standup update. First sentence: what was done (card title and PR number). Second sentence: current status (merged and done). No preamble, no markdown."""


# ---------------------------------------------------------------------------
# MCP HTTP client (stateful session)
# ---------------------------------------------------------------------------

class KryoMCPClient:
    def __init__(self, url: str):
        self.url = url
        self.session_id: str | None = None

    def _post(self, body: dict) -> dict:
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        resp = requests.post(self.url, json=body, headers=headers, timeout=30)
        if "mcp-session-id" in resp.headers and not self.session_id:
            self.session_id = resp.headers["mcp-session-id"]
        text = resp.text.strip()
        if not text:
            return {}
        # SSE stream: extract the last data: line
        if text.startswith("data:") or "\ndata:" in text:
            for line in reversed(text.splitlines()):
                if line.startswith("data:"):
                    payload = line[5:].strip()
                    if payload:
                        return json.loads(payload)
            return {}
        return json.loads(text)

    def initialize(self) -> None:
        resp = self._post({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "demo-agent", "version": "0.1.0"},
            },
        })
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})
        server_name = resp.get("result", {}).get("serverInfo", {}).get("name", "unknown")
        print(f"[mcp] connected to {server_name} (session {self.session_id})")

    def list_tools(self) -> list[dict]:
        resp = self._post({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        return resp.get("result", {}).get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        call_id = str(uuid.uuid4())[:8]
        resp = self._post({
            "jsonrpc": "2.0",
            "id": call_id,         
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        })
        result = resp.get("result", {})
        content = result.get("content", [])
        parts = [c.get("text", "") for c in content if c.get("type") == "text"]
        return "\n".join(parts) if parts else json.dumps(result)


# ---------------------------------------------------------------------------
# Anthropic tool schema helpers
# ---------------------------------------------------------------------------

def mcp_tool_to_anthropic(tool: dict) -> dict:
    return {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "input_schema": tool.get("inputSchema", {"type": "object", "properties": {}}),
    }


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

def run_agent():
    print(f"[llm] connecting to {VLLM_BASE_URL}")
    health = requests.get(f"{VLLM_BASE_URL}/health", headers=_llm_headers()).json()
    print(f"[llm] model: {health['model_name']}")

    mcp = KryoMCPClient(KRYO_MCP_URL)
    mcp.initialize()

    raw_tools = mcp.list_tools()
    print(f"[mcp] {len(raw_tools)} tools: {', '.join(t['name'] for t in raw_tools)}")
    tools = [mcp_tool_to_anthropic(t) for t in raw_tools]

    client = anthropic.Anthropic(base_url=VLLM_BASE_URL, api_key="not-needed")

    def run_step(label: str, tool: str, args: dict) -> str:
        print(f"\n{'─' * 60}")
        print(f"[{label}]")
        print(f"[tool] → {tool}({json.dumps(args, separators=(',', ':'))})")
        result = mcp.call_tool(tool, args)
        print(f"[tool] ← {result[:300]}{'…' if len(result) > 300 else ''}")
        return result

    # Step 1: pick up work
    step1 = run_step("step 1 — pick up work", "pick_up_work", {})
    card_match = re.search(r"#(\d+)", step1)
    if not card_match:
        print("[error] could not parse card number from pick_up_work result")
        return
    card_id = int(card_match.group(1))
    title_match = re.search(r"###\s+#\d+\s+(.+)", step1)
    card_title = title_match.group(1).strip() if title_match else f"card #{card_id}"

    # Step 2: submit for review
    step2 = run_step(
        "step 2 — submit for review",
        "submit_for_review",
        {"card_id": card_id, "branch": "feature/add-healthz", "title": "Add /healthz endpoint"},
    )
    pr_match = re.search(r"PR #(\d+)", step2)
    if not pr_match:
        print("[error] could not parse PR number from submit_for_review result")
        return
    pr_number = int(pr_match.group(1))

    # Step 3: complete work
    step3 = run_step(
        "step 3 — complete work",
        "complete_work",
        {"card_id": card_id, "pr_number": pr_number},
    )

    # Summary from the model (OpenAI-compatible API, /no_think disables Qwen3 chain-of-thought)
    print(f"\n{'─' * 60}")
    print("[summary]")
    resp = requests.post(
        f"{VLLM_BASE_URL}/v1/chat/completions",
        json={
            "model": MODEL,
            "max_tokens": 128,
            "messages": [
                {"role": "system", "content": "/no_think"},
                {"role": "user", "content": SUMMARY_PROMPT.format(card_title=card_title, pr_number=pr_number)},
            ],
        },
        headers=_llm_headers(),
        timeout=60,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"]
    text = THINK_RE.sub("", text).strip()
    if text:
        print(text)


if __name__ == "__main__":
    run_agent()
