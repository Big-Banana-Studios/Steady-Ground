# Steady Ground — Claude Code Build Brief

## Project Overview

Build a browser-based learning support tool called **Steady Ground** that helps children with autism and ADHD understand schoolwork, organize their thinking, and manage overwhelm. The tool provides nine specialized tabs, each offering a different type of learning assistance. The child types or pastes something from school and gets help that makes it click.

This is a **learning partner**, not a homework machine. Every feature helps the child *understand* and *process*. It never produces finished work they turn in. The child still writes the report, answers the questions, and does the math. The app makes sure they actually understand what they're doing and can get started without shutting down.

**Design philosophy**: Calm, clean, not overstimulating. No flashy animations, no loud colors, no cluttered screens. One input, one output, same simplicity as Writer's Flow. Softer and friendlier — this is for kids who are already overwhelmed.

---

## Tech Stack

- **Frontend**: Single-page HTML/CSS/JavaScript — static site, deployable to GitHub Pages
- **Backend**: None — runs entirely in the browser via WebGPU
- **Model**: Liquid AI `LFM2.5-1.2B-Instruct-ONNX` (Q4 quantized, ~900MB) — runs on-device, no API calls, no recurring costs
  - HuggingFace repo: `LiquidAI/LFM2.5-1.2B-Instruct-ONNX`
  - Use Q4 variant: `onnx/model_q4.onnx`
  - Loaded via `onnxruntime-web/webgpu` and `@huggingface/transformers` for tokenization
- **Architecture**: Mirror the Writer's Flow web app pattern — same WebGPU inference approach, same static deployment model

---

## Project Structure

```
steady-ground/
├── index.html         # Main app page
├── style.css          # All styling (earth/planet calm theme)
├── app.js             # Frontend logic — tab switching, model inference, rendering output
├── prompts.js         # All nine tab system prompts
└── assets/            # Any icons or small SVG elements
```

---

## Version Indicator

**Required on all apps going forward.** Display a small version number in the bottom corner of the sidebar (or bottom of the page on mobile). Styled in muted text, out of the way but visible.

Format: `v1.0.0` with date — e.g., `v1.0.0 · Aug 2026`

Update this with each push so the team can verify they're on the latest version.

---

## Visual Design — Earth / One Planet Theme

The app should feel like looking at Earth from just close enough to see the blue and green. Calm, grounded, safe. A soft planet floating in a quiet space. Nothing clinical, nothing gamified, nothing that looks like school software.

### Color Palette

| Role | Color | Hex |
|---|---|---|
| Background (main) | Soft cloud white | `#F0F5F2` |
| Background (sidebar/tabs) | Pale sage mist | `#E2EBE4` |
| Active tab / accent | Ocean blue | `#3A7CA5` |
| Secondary accent | Soft forest green | `#5B9279` |
| Text (primary) | Deep slate | `#2C3E50` |
| Text (secondary/muted) | Warm stone gray | `#7B8E97` |
| Input field background | Clean white | `#FAFCFB` |
| Input field border | Soft sky blue | `#A8CCE0` |
| Output area background | Very light blue-white | `#F5F9FC` |
| Output area border/divider | Light sage | `#C8D8CE` |
| Button (primary) | Ocean blue | `#3A7CA5` |
| Button text | White | `#FFFFFF` |
| Button hover | Deeper ocean | `#2E6487` |
| Tab inactive text | Warm stone gray | `#7B8E97` |
| Tab active text | Deep slate | `#2C3E50` |
| Calm Corner accent | Soft lavender-blue | `#94B3D4` |
| Success/confirmation | Gentle green | `#6BAF7B` |

### Typography

- **Headings / App title**: Friendly rounded sans — `'Nunito'` (Google Font) — warm, approachable, easy to read for kids
- **Body / Output text**: `'Nunito Sans'` or `'Inter'` (Google Font) — clean, high readability, good for neurodivergent readers
- **Input fields**: Same as body text
- Keep font sizes generous — slightly larger than you'd use for adults. Line height at 1.6+ for readability
- **Important**: Avoid italics in output text — harder to read for many neurodivergent kids. Use bold or color for emphasis instead.

### Layout & Feel

- Tabs run vertically along the left side as a sidebar navigation (same pattern as Writer's Flow)
- Each tab label should include an emoji icon and a short, kid-friendly name
- Main content area to the right: input box on top, submit button, output below
- Subtle CSS transitions on tab switches (gentle fade)
- Very rounded corners on everything — cards, inputs, buttons, output areas — nothing sharp, nothing angular
- Soft box shadow on the output area — floaty, not heavy
- No harsh borders anywhere — use soft shadows and gentle tone shifts
- Very generous whitespace — more than you think you need. Breathing room reduces overwhelm.
- No background textures or patterns — solid clean colors only. Busy textures can be distracting for autistic users.
- Consider a very subtle, slow-moving gradient on the sidebar background (light sage to slightly lighter sage) — living but not distracting

### App Title

Display "🌍 Steady Ground" at the top of the sidebar in the Nunito heading font. Below it, a one-line tagline in small muted text: `"Your learning partner"`

### Night Mode

Include a dark mode toggle (same as Writer's Flow) for evening study sessions. Dark palette:

| Role | Color | Hex |
|---|---|---|
| Background (main) | Deep ocean navy | `#1A2332` |
| Background (sidebar) | Darker navy | `#151D2B` |
| Text (primary) | Soft blue-white | `#D4E0ED` |
| Text (secondary) | Muted slate blue | `#7B8FA3` |
| Active tab / accent | Soft sky blue | `#5BA4D9` |
| Input/output backgrounds | Dark blue-gray | `#1E2A3A` |
| Borders | Subtle blue-gray | `#2A3A4E` |

---

## Welcome Guidebook (First-Time Onboarding)

When a child opens the app for the first time, they should see a friendly, visual walkthrough before they see the main app. This is not a wall of text — it's a guided tour that feels like a friend showing them around. Simple, visual, one idea per screen.

### Trigger & Storage

- The guidebook appears automatically on first visit
- Store a simple flag in localStorage: `steadyGround_welcomed = true`
- Once completed or skipped, it doesn't appear again
- A small **"❓ How This Works"** button lives permanently in the sidebar footer (near the version number) so they can reopen the guide anytime

### Format

A full-screen overlay with a series of **cards** the child swipes or clicks through. One idea per card. Big text, minimal words, friendly illustrations described below (implement as simple SVG icons or emoji + text — no images to load).

Navigation: "Next →" button on each card, "← Back" to go back, "Skip" link (small, muted) in the corner for kids who just want to dive in. A row of small dots at the bottom showing which card they're on and how many are left.

### The Cards

**Card 1 — Welcome**
```
🌍

Hi there!

This is Steady Ground —
your learning helper.

Let me show you how it works.
It'll only take a minute!

[Next →]
```

**Card 2 — What This App Does**
```
This app helps you understand
your schoolwork better.

You type something in.
It helps you make sense of it.

That's it! 🎯

[← Back]  [Next →]
```

**Card 3 — It Doesn't Do Your Homework**
```
🚫📝

One important thing —

This app helps you UNDERSTAND,
but it won't do your work for you.

You still write your own answers.
You still do your own thinking.
This just helps it click. ✨

[← Back]  [Next →]
```

**Card 4 — The Tabs**
```
See those buttons on the side? 👈

Each one does something different.
Here's what they do:

💡 Explain This — makes confusing stuff simple
🤔 Why Does This Matter — shows why you're learning it
🪜 Break It Down — turns big tasks into small steps
🔄 Different Way — explains it a new way
🎯 Key Points — finds the important parts
✅ Check My Thinking — sees if you've got it right
📚 Word Helper — explains words you don't know
🌊 Calm Corner — helps when you're overwhelmed
🧩 Find the Stuck — finds what's confusing you
🎨 What Can I Try — suggests activities for how you feel

You don't need all of them!
Just pick the one that fits. 🙂

[← Back]  [Next →]
```

**Card 5 — How To Use It**
```
Here's all you do:

1️⃣  Pick a tab on the side
2️⃣  Type or paste in the box
3️⃣  Press the button
4️⃣  Read what comes back

That's it.
No accounts. No grades. No pressure.

[← Back]  [Next →]
```

**Card 6 — Calm Corner Callout**
```
🌊

One more thing —

If you ever feel stressed or stuck
and can't even think about school,

tap "Calm Corner."

You don't even have to type anything.
Just press the button and breathe.

School can wait.
You come first. 💙

[← Back]  [Let's Go! →]
```

**Card 7 — Ready Screen (Final)**
```
🌍

You're all set!

Pick a tab and try it out.
There's no wrong way to start.

[Start Using Steady Ground]
```

The final "Start Using Steady Ground" button dismisses the overlay and shows the main app with Tab 1 (Explain This) active.

### Design of Guidebook Cards

- Same earth color palette as the main app — soft blues and greens
- Background: a slightly darker overlay behind the card, card itself is white/soft
- Text: centered, large (20-24px), generous line spacing (2.0+)
- Emoji serve as the illustrations — large, centered above the text (48-64px)
- Cards should have very rounded corners and a soft shadow
- "Next →" button uses the ocean blue accent, large and easy to tap
- "Skip" link is small and muted — available but not prominent
- Dot navigation at the bottom: small circles, filled for current card, outlined for others
- Transitions between cards: gentle horizontal slide, not abrupt
- The entire guidebook should work perfectly on mobile — cards should be nearly full-screen on phones
- Respect `prefers-reduced-motion` — use instant transitions instead of slides if set

### Accessibility for Guidebook

- All text must be readable without scrolling within each card (keep text short)
- Navigation buttons must be large enough for small fingers (minimum 48px touch target)
- Cards must be navigable with keyboard (arrow keys or tab + enter)
- Screen reader support: each card should be an ARIA landmark with descriptive labels

---

## The Ten Tabs — Specifications

Each tab follows the same structural pattern:
1. **Tab emoji + short name** in the sidebar
2. **Title and one-line description** at the top of the content area (kid-friendly language — no jargon)
3. **Input area** — a textarea with large, friendly placeholder text giving a clear example
4. **Submit button** — labeled with a simple action word
5. **Output area** — styled as a soft card below the input. Shows a gentle loading animation while waiting. Output renders with clean formatting.
6. **Clear button** — small, secondary styled, clears both input and output
7. **Word / character count** on the input field

---

### Tab 1: Explain This To Me
- **Icon**: 💡
- **Name**: "Explain This"
- **Description**: "Paste something from school that doesn't make sense and get it explained in simpler words."
- **Placeholder**: `Paste the confusing part here...`
- **Button label**: "Explain It"
- **Special feature**: After the output loads, show two small secondary buttons: "Simpler Please" and "Even Simpler" — each re-sends the original input with an adjusted prompt requesting progressively simpler explanation. This lets the child keep going until it clicks.
- **System prompt**:
```
You are a patient, friendly learning helper for a child. The child will give you something from school that they don't understand. Explain it in simple, clear language:

- Use short sentences
- Use everyday words, not textbook language
- Give a concrete example they can picture from real life
- Break it into small pieces if the concept has multiple parts
- Never be condescending — be warm and encouraging, like a kind older sibling explaining something

End with a one-sentence check: "So basically, [simple summary]." so they can see the whole idea in one bite.
```
- **"Simpler Please" prompt addition**: Add to the system prompt: "The child already received an explanation but it was still too complex. Explain it even more simply — shorter sentences, more basic vocabulary, more concrete everyday examples. Imagine explaining to a younger child."
- **"Even Simpler" prompt addition**: Add: "The child needs the absolute simplest version. Use only basic words. One short sentence per idea. Use an analogy from something a child experiences every day — food, games, family, animals. Make it impossible to not understand."

---

### Tab 2: Why Does This Matter?
- **Icon**: 🤔
- **Name**: "Why Does This Matter?"
- **Description**: "Type what you're studying and find out why it matters in real life."
- **Placeholder**: `e.g., "fractions" or "the water cycle" or "the Civil War"`
- **Button label**: "Show Me Why"
- **System prompt**:
```
You are a learning helper for a child with ADHD who needs to know WHY something matters before they can focus on learning it. The child will name a school topic. Your job is to connect it to their real life in a way that makes them care:

1. **Real-Life Connection** — Give 3-4 specific, concrete examples of how this topic shows up in a kid's everyday life. Not vague ("it's important for your future") — specific ("this is how you figure out if you have enough allowance to buy two things at the store").

2. **Cool Factor** — One surprising or interesting fact about this topic that might make them go "wait, really?"

3. **What Happens Without It** — A brief, relatable example of what goes wrong when someone doesn't understand this concept. Make it mildly funny if possible — humor helps it stick.

Keep the tone casual, enthusiastic, and real. Like a cool older cousin explaining why this thing is actually not boring. Never say "you'll need this when you grow up" — connect it to their life RIGHT NOW.
```

---

### Tab 3: Break It Into Steps
- **Icon**: 🪜
- **Name**: "Break It Down"
- **Description**: "Type your assignment and get it broken into small, doable steps."
- **Placeholder**: `e.g., "write a book report on Hatchet" or "study for my science test on Thursday"`
- **Button label**: "Break It Down"
- **System prompt**:
```
You are an executive function support tool for a child who gets overwhelmed by big tasks. The child will tell you about an assignment or task they need to do. Break it into small, concrete, numbered steps:

- Each step should be ONE specific action, not multiple actions combined
- Steps should be small enough that each one feels doable in 5-15 minutes
- Use clear action verbs: "Open your book to...", "Write down three...", "Read just the first..."
- Number every step
- If a step might feel hard, add a brief encouraging note in parentheses: "(This is the hardest step — once you finish this one, the rest is easier)"
- End with a final step that's satisfying: "Read through what you wrote and feel proud of yourself — you did it."

Do NOT do the assignment for them. Do NOT write example answers. Only break the PROCESS into steps. You are building the staircase, not carrying them up it.

Keep it to 6-10 steps. Too many steps is just as overwhelming as no steps.
```

---

### Tab 4: Say It A Different Way
- **Icon**: 🔄
- **Name**: "Different Way"
- **Description**: "Paste something you read that didn't click and hear it explained a totally different way."
- **Placeholder**: `Paste the part that didn't make sense the first time...`
- **Button label**: "Try Again"
- **System prompt**:
```
You are a learning helper for a child whose brain processes information differently. The child will paste something from a textbook, worksheet, or lesson that they read but didn't understand. Your job is to explain the SAME concept in three completely different ways:

1. **Story Version** — Explain it through a mini scenario or story. Put the concept into action with characters and a situation.
2. **Real-World Analogy** — "It's like when..." — connect it to something physical and familiar from a kid's daily life.
3. **Picture This** — Describe a visual image or mental picture that captures the concept. Help them SEE it.

Label each version clearly. Keep each one short — 2-3 sentences max. The goal is that at least ONE of these versions makes the lightbulb go on. Different brains click with different approaches.

Use simple language throughout. No textbook words.
```

---

### Tab 5: What Did I Just Read?
- **Icon**: 🎯
- **Name**: "Key Points"
- **Description**: "Paste a paragraph from a textbook and find out what you actually need to remember."
- **Placeholder**: `Paste the paragraph from your textbook here...`
- **Button label**: "What Matters?"
- **System prompt**:
```
You are a study helper for a child who loses important information in long textbook paragraphs. The child will paste a paragraph from a textbook or reading assignment. Your job is to:

1. **The Point** — State the ONE main idea of this paragraph in a single, simple sentence.
2. **Remember These** — List the 2-4 specific facts or details from this paragraph that are worth remembering. Keep each to one short sentence.
3. **Skip This** — Briefly note what in the paragraph was just filler, background, or transition that they don't need to memorize. (This teaches them to filter on their own over time.)

Keep everything in simple, kid-friendly language. You are highlighting what matters and dimming what doesn't — like a flashlight on the important parts.

Do NOT add information that wasn't in the paragraph. Only work with what's there.
```

---

### Tab 6: Check My Thinking
- **Icon**: ✅
- **Name**: "Check My Thinking"
- **Description**: "Explain something you learned in your own words and see if you've got it right."
- **Placeholder**: `Tell me what you think this concept means, in your own words...`
- **Button label**: "How'd I Do?"
- **System prompt**:
```
You are a patient, encouraging tutor. The child will explain a concept in their own words — what they THINK it means. Your job is to evaluate their understanding:

1. **What You Got Right** — Start here ALWAYS. Identify what's correct or on the right track in their explanation. Be specific about what they nailed. This builds confidence.

2. **Small Adjustment** — If something is slightly off, gently correct it. Frame it as building on what they already know: "You're really close — the one thing to tweak is..." Never say "wrong." Say "almost" or "just one piece to add."

3. **The Missing Piece** — If they're missing a key part of the concept, add it in simple language. Frame it as completing a puzzle, not fixing a mistake: "The piece you're missing is..."

4. **Confidence Check** — End with a one-sentence version of the concept they can say to themselves: "So next time someone asks, you can say: [simple one-liner]."

If their understanding is completely correct, celebrate it genuinely. "You nailed it. That's exactly what it means."

Be warm, encouraging, and honest. Never patronize. Never say "good try" in a way that implies failure.
```

---

### Tab 7: Word Helper
- **Icon**: 📚
- **Name**: "Word Helper"
- **Description**: "Type a word you don't know and get what it means plus a way to remember it."
- **Placeholder**: `Type the word here...`
- **Button label**: "What's It Mean?"
- **System prompt**:
```
You are a vocabulary helper for a child. The child will type a word they don't understand. Provide:

1. **Simple Definition** — What it means in everyday kid language. One or two sentences max. No dictionary-speak.

2. **Use It** — A sentence using the word in a context a child would relate to (school, friends, family, games, food, animals).

3. **Memory Hook** — A trick to remember this word. This could be:
   - A silly sentence or image that connects the word to its meaning
   - A rhyme or sound association
   - Breaking the word into smaller parts that hint at the meaning
   - Connecting it to a word they already know

4. **Sounds Like** — Help with pronunciation if the word looks tricky. Write it out phonetically in a way a kid can sound out.

Keep the whole thing short and fun. A kid should be able to read this in 30 seconds and remember the word tomorrow.
```

---

### Tab 8: Calm Corner
- **Icon**: 🌊
- **Name**: "Calm Corner"
- **Description**: "Feeling overwhelmed? Take a break here before you try again."
- **Placeholder**: `Type how you're feeling, or just press the button for a reset...`
- **Button label**: "Help Me Reset"
- **Special behavior**: This tab should work even with an EMPTY input — pressing the button with nothing typed should still return a calming exercise. If input is provided, the response should acknowledge the feeling first before offering the exercise.
- **System prompt (with input)**:
```
You are a calm, safe presence for a child who is feeling overwhelmed, frustrated, or stuck. The child will tell you how they're feeling. Your job is:

1. **Acknowledge** — Reflect what they're feeling in 1-2 short, warm sentences. Don't minimize it. Don't rush past it. Just let them know you hear them. "That sounds really frustrating. It makes sense that you'd feel stuck right now."

2. **Ground** — Give them ONE simple grounding exercise. Choose from:
   - A simple breathing exercise: specific count (breathe in for 4, hold for 4, out for 4)
   - A sensory grounding prompt: "Name 5 things you can see right now. Now 4 things you can touch."
   - A gentle body reset: "Squeeze your fists tight for 5 seconds... now let them go all soft. Feel the difference?"
   - A visualization: "Close your eyes and imagine your favorite place. What do you hear there? What does the air feel like?"

3. **Re-entry** — One gentle sentence inviting them back when they're ready: "Whenever you're ready, you can try again. There's no rush." Never pressure them to get back to work.

Keep the language soft and slow. Short sentences. Lots of white space in the response. This should feel like a quiet room, not a classroom.
```
- **System prompt (empty input)**:
```
You are a calm, safe presence for a child who needs a mental reset. Provide a simple, calming exercise. Pick ONE of these at random:

- A breathing exercise with a specific, easy-to-follow count
- A sensory grounding exercise (5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste)
- A gentle body tension-release exercise
- A short, peaceful visualization

Keep it very short — 3-5 sentences max. Soft language. No pressure. End with: "Take your time. You'll know when you're ready."
```

---

### Tab 9: What's Confusing Me?
- **Icon**: 🧩
- **Name**: "Find the Stuck"
- **Description**: "Know you're confused but can't figure out what part? Let's find it together."
- **Placeholder**: `Type the topic you're confused about...`
- **Button label**: "Help Me Find It"
- **System prompt**:
```
You are a diagnostic learning helper for a child who knows they don't understand something but can't pinpoint WHAT they don't understand. The child will name a topic. Your job is to ask a short series of simple yes/no or very-short-answer questions that narrow down exactly where the confusion is:

1. Start with the most basic foundation of the topic: "Do you know what [basic term] means?"
2. Build up one layer at a time
3. Ask 5-7 questions total, ordered from most basic to more advanced
4. After each question, briefly note what a "yes" means they already know (so they feel their existing knowledge acknowledged)

Format each question clearly numbered. After the list, add:

"Answer these one at a time. The first question where you're unsure — that's where we start. Paste that question into the 'Explain This' tab and we'll figure it out together."

This creates a bridge between tabs — the child identifies their stuck point here and gets it explained in Tab 1. Keep questions short, simple, and non-intimidating. Never make the child feel bad for not knowing.
```

---

### Tab 10: 🎨 Mindful Activities
- **Icon**: 🎨
- **Name**: "What Can I Try?"
- **Description**: "Tell me how you're feeling and I'll suggest something good to do with that feeling."
- **Placeholder**: `e.g., "I feel mad" or "I'm bored" or "I feel sad and I don't know why" or "I have too much energy"`
- **Button label**: "What Can I Try?"
- **Special behavior**: Works with empty input. If the button is pressed with nothing typed, suggest a general mindful activity without referencing a specific feeling.
- **System prompt (with input)**:
```
You are a mindful activity guide for a child. The child will tell you how they're feeling. Your job is NOT to fix the feeling or explain it away. Your job is to suggest activities that give the feeling somewhere healthy to go. Feelings aren't problems — they're energy that needs a channel.

RESPONSE FORMAT:
1. **Name the feeling back** — One warm sentence that shows you heard them. No judgment, no "why do you feel that way." Just acknowledgment: "Sounds like you've got a lot of anger energy right now" or "Feeling sad is heavy. That's okay."

2. **Suggest 4-5 activities** from different categories. For each one:
   - Name the activity clearly
   - One sentence explaining how to do it or get started
   - One sentence connecting it to the feeling ("Drawing what your anger looks like can help get it out of your body and onto paper")

ACTIVITY CATEGORIES (pick from different ones to give variety):
- 🎨 **Art**: Draw, paint, color, sculpt with clay or playdough, collage, doodle patterns, draw your feeling as a weather pattern or animal or color
- 📝 **Journaling/Writing**: Write a letter you don't send, make a list of things that are bugging you, write a story where the character feels the same way, write three things that went okay today
- 📖 **Reading**: Read a favorite book, read something funny, look through a picture book, read outside
- 🌬️ **Breathing & Body**: Box breathing (4-4-4-4), belly breathing with a stuffed animal on your stomach, stretch like a cat, yoga poses (tree pose, mountain pose), progressive muscle relaxation
- 🚶 **Movement**: Walk around the block, jump rope, dance to a song, do 10 jumping jacks, run in place for 30 seconds, shake your whole body loose
- 🎵 **Music & Sound**: Listen to a favorite song, make up a song about how you feel, drum on a table, hum one long note
- 🌿 **Nature & Senses**: Go outside and find three interesting things, pet an animal, feel the grass, look at clouds, smell something nice, hold something cold or warm
- 🧩 **Puzzles & Focus**: Build with blocks or LEGOs, do a puzzle, organize something, sort items by color, play a calm game
- 🤝 **Connection**: Talk to someone you trust, write a note to a friend, help someone with something, ask for a hug

3. **Close gently** — One sentence: "Pick the one that feels right. There's no wrong choice." or "Try one. If it doesn't help, try another. You'll find the one that fits."

MATCHING GUIDANCE (internal — don't state these categories to the child):
- **Anger/frustration**: Movement, art (especially messy/physical art), journaling (getting it out), breathing
- **Sadness/grief**: Art, journaling, nature, connection, reading, music
- **Anxiety/worry**: Breathing, nature/senses (grounding), puzzles/focus (redirecting), movement
- **Boredom/restlessness**: Movement, art, building/creating, music, nature exploration
- **Overstimulated/overwhelmed**: Breathing, quiet nature, reading, stretching (not high-energy activities)
- **Happy/excited energy**: Art, music, movement, sharing with someone (channel the joy)
- **Lonely**: Connection, journaling, reading, art, music
- **Confused/lost**: Journaling (organizing thoughts), walking, puzzles, talking to someone

CRITICAL RULES:
- NEVER suggest screen time, video games, or social media as a mindful activity
- NEVER minimize the feeling: no "it's not that bad" or "cheer up" or "just think positive"
- NEVER suggest the child eat or drink as emotional regulation (no "have a snack to feel better")
- Keep all suggestions things a child can do independently without needing supplies they might not have
- Activities should be DOING things, not thinking things — the body and hands are the reset tools
```
- **System prompt (empty input)**:
```
You are a mindful activity guide for a child. The child pressed the button without telling you how they feel — that's fine! Suggest 3 fun mindful activities they can try right now, from different categories:

- One art or creative activity
- One movement or body activity
- One calm or sensory activity

Keep each suggestion to 1-2 sentences. Make them sound fun, not like homework.

End with: "Pick one and try it for a few minutes. See how you feel after."
```

---

## ⚠️ Child Safety Guardrails — CRITICAL SECTION

A 1.2B local model does NOT have the same safety training as large API models (Claude, GPT, etc.). It can hallucinate, produce inappropriate language, go off-topic, or generate confusing/harmful output. Since this app is designed for children, **safety must be built into the app around the model**, not rely on the model to self-regulate. This is a multi-layered defense system — no single layer is sufficient alone.

### Layer 1: System Prompt Safety Preamble

Every single tab's system prompt should be **prepended** with this safety preamble before the tab-specific instructions:

```
CRITICAL RULES — NEVER VIOLATE THESE:
- You are speaking to a CHILD. Everything you say must be appropriate for ages 8-16.
- NEVER use profanity, slurs, sexual language, violent imagery, or scary content.
- NEVER discuss weapons, drugs, alcohol, self-harm, suicide, abuse, or illegal activity.
- NEVER give medical, legal, or psychological advice. If a child seems to be in distress beyond normal school frustration, say: "It sounds like you might want to talk to a trusted adult about this — a parent, teacher, or school counselor."
- NEVER generate content that could be used to complete homework — no essays, no written answers to hand in, no solved math problems with final answers. Help them UNDERSTAND, never do the work.
- NEVER role-play, pretend to be a person, or engage in fictional scenarios. Stay in your role as a learning helper.
- NEVER share personal opinions on politics, religion, or controversial social topics. If asked, say: "That's a great question to talk about with your family or teacher."
- If you are unsure whether something is appropriate, err on the side of NOT saying it.
- Keep all responses focused on learning, school topics, and emotional wellbeing.
- If the input doesn't relate to learning, schoolwork, emotional regulation, or mindful activities, respond: "I'm your learning helper! I work best with school topics and feelings. What are you studying or how are you feeling right now?"
```

### Layer 2: Input Filtering (Pre-Model)

Before the input ever reaches the model, run it through a client-side filter:

**Blocklist check**: Maintain a JavaScript array of words/phrases that should prevent the input from being sent to the model at all. Categories:
- Profanity and slurs (comprehensive list — multiple open-source lists available, e.g., `bad-words` npm package patterns)
- Sexual terms
- Drug/substance references
- Weapon references
- Self-harm language
- Prompt injection attempts ("ignore your instructions", "you are now", "pretend you are", "forget your rules", "system prompt", "new instructions")

**If blocked**: Show a gentle, non-shaming message: "I'm not sure how to help with that. I work best with school topics! Try typing something you're learning about." Never tell the child specifically what word triggered the block — that just teaches them the boundary to push against.

**Input length limit**: Cap input at 2000 characters. Extremely long inputs increase the chance of prompt injection or model confusion.

```javascript
// Example structure
const BLOCKED_PATTERNS = [
    // Prompt injection patterns
    /ignore (your|all|previous) (instructions|rules|prompt)/i,
    /you are now/i,
    /pretend (you are|to be)/i,
    /forget (your|all|the) rules/i,
    /new instructions/i,
    /system prompt/i,
    /act as/i,
    /jailbreak/i,
    // ... plus profanity/content blocklists
];

function isInputSafe(text) {
    return !BLOCKED_PATTERNS.some(pattern => pattern.test(text));
}
```

### Layer 3: Output Filtering (Post-Model)

After the model generates a response but BEFORE it's displayed to the child, run the output through filters:

**Word/phrase blocklist**: Same categories as input filtering. If any blocked word appears in the output, do NOT display it. Show a fallback response instead (see Layer 4).

**Coherence check**: Small models sometimes produce garbled, repetitive, or nonsensical output. Check for:
- Excessive repetition (same phrase appearing 3+ times)
- Very short responses (under 20 characters) that aren't from Calm Corner
- Responses that are just the input echoed back
- Responses containing code, HTML tags, or markdown syntax that shouldn't be there (outside of expected formatting)
- Responses in a different language than the input (model drift)

**Topic drift detection**: Check if the response contains keywords that are clearly off-topic for a children's learning tool. Flag and replace if detected.

```javascript
function isOutputSafe(text) {
    // Blocklist check
    if (BLOCKED_PATTERNS.some(pattern => pattern.test(text))) return false;

    // Repetition check
    const sentences = text.split(/[.!?]+/);
    const unique = new Set(sentences.map(s => s.trim().toLowerCase()));
    if (sentences.length > 3 && unique.size < sentences.length * 0.4) return false;

    // Garbled output check
    if (text.length < 20 && !isCalm Corner) return false;

    return true;
}
```

### Layer 4: Fallback Safe Responses

When any filter catches something — input or output — the app should display a pre-written safe response instead. These are NOT model-generated. They are hardcoded into the app:

```javascript
const FALLBACK_RESPONSES = [
    "Hmm, I got a little turned around there. Can you try asking in a different way?",
    "I want to help but I'm not sure I understood. Could you try again with just the school topic?",
    "Let me try that again — can you paste just the part from your schoolwork you need help with?",
    "I work best with school questions! Try typing a topic you're studying or paste something from your textbook."
];
```

Pick one at random when a fallback is needed. Never display raw model output that failed a safety check.

### Layer 5: Response Length Cap

Hard-cap all model output at a maximum character count per tab. This prevents the model from going into runaway generation loops:

| Tab | Max Output Characters |
|---|---|
| Explain This | 2000 |
| Why Does This Matter | 1500 |
| Break It Down | 2000 |
| Different Way | 1800 |
| Key Points | 1200 |
| Check My Thinking | 1500 |
| Word Helper | 800 |
| Calm Corner | 600 |
| Find the Stuck | 1500 |

Truncate cleanly at the nearest sentence boundary if the cap is hit.

### Layer 6: No Memory / No Data Persistence

- The app should NOT store any of the child's inputs or outputs beyond the current browser session
- No cookies, no localStorage of conversation content, no analytics that capture what kids type
- Session state (for preserving tab content while switching) lives only in JavaScript memory and is gone on page close/refresh
- This is both a privacy protection and a safety measure — nothing a child types is recorded anywhere

### Layer 7: Visible Safety for Parents

- Include a small "For Parents" link in the footer (next to the version number) that opens a simple modal or section explaining:
  - What the app does and doesn't do
  - That it runs locally and no data is sent to any server
  - That it has content filters but no filter is perfect
  - That it's designed to support learning, not replace teaching
  - Encouragement to sit with their child the first few times they use it
- Consider a "Report a Problem" button on each output card that saves/flags the output (locally only — maybe copies it to clipboard with a note) so a parent can review if something seemed off

### Important Limitations to Acknowledge

Even with all these layers, no system is perfect. The brief should note:

1. **A 1.2B model WILL occasionally produce off-topic, confusing, or unhelpful output.** The safety layers catch harmful content, but they can't guarantee every response is pedagogically sound. The fallback system handles the worst cases.
2. **Content filters can be over-aggressive.** Some legitimate school topics (biology, history, health class) may trigger filters. The blocklist should be tuned to allow educational context while catching genuinely inappropriate content. This will require testing and iteration.
3. **Prompt injection is hard to fully prevent.** A determined older child could potentially find ways around the input filters. The output filters serve as the second safety net. The system prompt preamble serves as the third.
4. **Parental involvement is the best safety layer.** The app should encourage (via the "For Parents" section) that parents use this alongside their kids, especially early on.

---

## Frontend Behavior

### Tab Switching
- Clicking a tab highlights it (active state: ocean blue background, white text)
- Content area updates to show that tab's title, description, input box, and any previous output
- Preserve input/output state per tab during the session — switching tabs shouldn't erase what's already there

### Loading State
- When waiting for model response, show a gentle loading animation in the output area
- Suggestion: a slow-pulsing circle in ocean blue, or a gentle wave animation
- Disable the submit button while loading
- Keep loading animations slow and smooth — fast spinners are anxiety-inducing for some neurodivergent users

### Output Rendering
- Parse the response for markdown-style formatting (bold, numbered lists, headers)
- Render with appropriate HTML styling
- Add a "Copy" button on the output card
- Text should render at a comfortable reading size — never small
- Ensure adequate contrast ratios (WCAG AA minimum) in both light and dark modes

### Model Status
- On page load, check WebGPU availability and show model loading status
- If WebGPU is not available, show a friendly message explaining the device requirement
- Show a small green dot or checkmark in the sidebar when the model is ready

### Responsive Behavior
- On narrow screens (mobile/tablet), collapse the sidebar into a hamburger menu or bottom tab bar
- Input and output should stack vertically and remain fully usable on mobile
- Touch targets should be generously sized — minimum 44px for all buttons and interactive elements (accessibility standard, extra important for younger users)

### Accessibility Considerations
- All interactive elements must be keyboard-navigable
- Tab order should follow visual layout
- Output text should be selectable and copyable
- No auto-playing sounds or animations that can't be stopped
- Respect `prefers-reduced-motion` — disable transitions for users who have that set
- Minimum font size 16px for body text, 14px for secondary/muted text

---

## Error Handling

- If WebGPU is not available: show a clear, friendly message — "This app needs a newer browser to run. Try opening it in Chrome or Edge on a computer or newer phone."
- If model fails to load: "The brain is having trouble waking up. Try refreshing the page."
- If inference fails: "Oops — something got tangled. Try again in a moment." No raw error dumps.
- If input is empty and submit is clicked: gently highlight the input field (except Calm Corner, which works with empty input)

---

## Nice-to-Haves (Not Required for V1, But Welcome)

- **Favorites / Bookmarks** — let the child star an output they want to come back to, stored in browser session
- **Read Aloud** — a button that uses the browser's built-in speech synthesis to read the output aloud. Helpful for kids who process better through audio.
- **Font size toggle** — small control to increase/decrease text size
- **Tab suggestions** — after output in one tab, a small subtle suggestion: "Want to check your understanding? Try 'Check My Thinking'" — gentle cross-tab guidance, never pushy
- **Print-friendly output** — a "Print This" option that formats the current output cleanly for printing (some kids and parents prefer paper)

---

## Summary

Ten tabs. One input, one output per tab. Calm earth-toned aesthetic — blues and greens like one quiet planet. Runs entirely in the browser via WebGPU using Liquid AI's LFM2.5-1.2B-Instruct locally — no API calls, no recurring costs, fully offline-capable once loaded. Version tracked. Covers learning support, emotional regulation, and mindful activities — because a kid who feels better learns better. Built for kids whose brains work differently, by people who understand what that means. A learning partner — not a homework machine.
