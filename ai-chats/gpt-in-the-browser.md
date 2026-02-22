# Running LLMs Fully in the Browser (No OpenAI / No External APIs)

## Overview

This document summarizes how to build a web application that:

- Runs an LLM fully in the browser
- Accepts document uploads (PDF / TXT)
- Answers questions about those documents
- Does NOT make API calls to OpenAI, Claude, or other hosted LLM providers
- Works with a Next.js + Convex + Clerk stack

---

# 1. Can LLMs Run Fully in the Browser?

Yes.

Modern approaches allow running LLMs directly in the browser using:

- WebAssembly (WASM)
- WebGPU
- Quantized model weights

This means:

- Model runs on the user's device
- No server inference required
- No API costs
- Full privacy

---

# 2. Tools That Enable Browser LLMs

## Option A: GPT4All Web

- Uses WebAssembly builds
- Runs quantized models (3B–7B)
- Fully client-side
- Free and open-source models

## Option B: llama.cpp (WebAssembly build)

- Compile LLaMA-style models to run in browser
- Often faster with WebGPU
- Common for custom integrations

## Option C: ONNX / TensorFlow.js

- Convert models to run via WebGPU
- Useful for embeddings and smaller models

---

# 3. Architecture for Next.js + Convex + Clerk

Important: The LLM CANNOT run inside Convex.

Correct architecture:

User Browser

- LLM (WebAssembly)
- Document chunking
- Retrieval logic
- Inference

Convex

- Stores document metadata (optional)
- Stores user info

Clerk

- Authentication only

The model runs inside a `"use client"` React component.

---

# 4. Option 1: Pure Client-Side LLM (Simplest)

Everything runs in the browser.

### Flow:

1. User uploads document
2. Extract text (PDF.js for PDFs)
3. Chunk text (500–800 words per chunk)
4. Store chunks in memory
5. User asks question
6. Retrieve relevant chunks
7. Construct prompt
8. Send prompt to local LLM
9. Display answer

### Pros:

- No API cost
- Full privacy
- No backend needed
- Works offline

### Cons:

- Large model download (100MB–500MB+)
- Depends on user device performance
- Smaller models = lower reasoning quality
- Struggles on mobile devices

---

# 5. Model Size Feasibility

| Model Size | Browser Performance      |
| ---------- | ------------------------ |
| 1–3B       | Smooth                   |
| 7B (4-bit) | Usable on strong desktop |
| 13B+       | Not practical            |

For best experience:

- Use 3B–7B quantized models
- Prefer WebGPU-enabled browsers

---

# 6. How Good Is It?

Performance Quality:

- Excellent for:
  - Manuals
  - Reports
  - Internal documentation
  - Medium-length PDFs

- Not great for:
  - Deep reasoning
  - Very long books
  - Complex logic

It is good for MVP-level document Q&A, but not GPT-4-level intelligence.

---

# 7. Does GPT4All Web Have Its Own Free Model?

Yes.

GPT4All distributes:

- GPT4All-J
- GPT4All-Manticore
- Alpaca variants
- Vicuna variants

All are:

- Open-source
- Free
- Downloaded locally
- No API calls required

---

# 8. Example MVP Prompt for Lovable.dev

Below is the prompt used to generate a browser-only MVP:

---

Build a simple Next.js 14 (App Router) MVP that demonstrates a fully client-side LLM document Q&A system using a browser-based GPT4All-style WebAssembly model.

Requirements:

1. Architecture

- Everything must run in the browser.
- No external API calls (no OpenAI, no Anthropic).
- No backend required.
- Use a client component only.
- Use WebAssembly/WebGPU-compatible LLM.
- The model should load dynamically in the browser.

2. Features

A. Document Upload

- Support .txt and .pdf
- Use pdfjs to extract text
- Show extracted text length

B. Chunking

- Split text into 500–800 word chunks
- Store chunks in React state

C. Simple Retrieval

- Naive keyword similarity
- Select top 3 chunks

D. Prompt Construction

"You are a helpful assistant. Answer the question using only the context below.

Context:
{selected_chunks}

Question:
{user_question}

Answer:"

E. Local Generation

- Send prompt to browser-loaded model
- Stream tokens if possible
- Display answer

3. UI

- File upload
- Model loading indicator
- Question textarea
- Ask button
- Output section
- Loading spinner

4. Performance

- Use small quantized model (3B–7B)
- Lazy-load model
- Show download progress

5. State

- React hooks only
- Single page component

Goal:
Demonstrate document Q&A running entirely in the browser without external APIs.

---

# 9. Realistic Recommendation

For production:

Best privacy-focused architecture:

- Run llama.cpp on your own server
- No OpenAI dependency
- Better performance
- Still no API vendor lock-in

Best zero-backend MVP:

- Fully browser-based LLM
- 3B–7B quantized model
- Simple retrieval
- Local-only processing

---

# 10. Final Summary

Yes, you can:

- Run an LLM fully in the browser
- Build document Q&A
- Use Next.js + Clerk
- Avoid OpenAI/Claude APIs
- Use free open-source models

Limitations:

- Device-dependent performance
- Smaller models only
- Not GPT-4-level intelligence

For MVP exploration: browser-only works.
For production scale: self-hosted llama.cpp backend is stronger.

---
