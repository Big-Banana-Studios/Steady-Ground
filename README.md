# Steady Ground

A learning partner for kids whose brains work differently. Ten tabs, one input,
one answer each — built to help a child *understand* their schoolwork, get
started on it, or calm down enough to try.

It runs entirely inside the browser, on the child's own device, using Liquid
AI's `LFM2.5-1.2B-Instruct` through WebGPU. No server, no account, no API key,
no bill. Once the model has downloaded it works with no internet at all.

**Version 1.4.0 · Aug 2026**

---

## Try it right now

Double-click **`run.ps1`**, or from a terminal in this folder:

```powershell
.\run.ps1
```

That starts a small local server and opens the app in your browser. Stop it with
`Ctrl+C`.

If you'd rather do it by hand: `npm start`, then open <http://localhost:8123/>.

### What to expect the first time

1. **The welcome guidebook appears** — seven cards. Click through them, or Skip.
2. **"One download to go"** — the helper is about **814 MB** and it downloads
   once. On a decent connection that's a few minutes. Use wifi. Keep the page
   open while the bar fills.
3. After that it's cached by the browser. Every later visit takes seconds, and
   works with the wifi switched off.
4. First answer after loading is the slowest; later ones are quicker.

**Use Chrome or Edge.** Firefox and Safari don't have WebGPU on Windows yet, and
the app will tell you so kindly rather than breaking.

### Worth trying while you test

- **💡 Explain This** — paste something from a textbook, then press
  *Simpler Please* and *Even Simpler* to watch it climb down a level each time.
- **🌊 Calm Corner** — press the button with the box completely empty. It
  should still come back with a breathing or grounding exercise.
- **🎨 What Can I Try** — also works empty.
- **🧩 Find the Stuck** → then take a question it gives you to **Explain This**.
- Type a swear word. You should get a gentle redirect, and nothing should
  reach the model.
- Try **🔊 Read aloud**, **night mode**, and **text size** in the sidebar.

---

## The safety layers

The brief was right to insist on this: a 1.2B model has nothing like the safety
training of a big hosted model, so the safety is built *around* it rather than
trusted *to* it.

| Layer | What it does | Where |
|---|---|---|
| 1 | Safety preamble prepended to every system prompt, always | `prompts.js` |
| 2 | Input checked before it reaches the model | `safety.js` |
| 3 | Output checked in full before it reaches the screen | `safety.js` |
| 4 | Hardcoded fallback lines when a check fails | `safety.js` |
| 5 | Per-tab length cap, cut at a sentence boundary | `safety.js` |
| 6 | Nothing a child types is ever written to disk | `app.js` |
| 7 | A "For Parents" panel that explains all of the above | `index.html` |

Decisions inside that are worth knowing about, because they depart from what
the brief specified — most of them added after a real answer went wrong in
testing:

**Nothing is streamed to the screen.** Writer's Flow shows tokens as they
arrive. This app can't: that would put unfiltered words from a small model in
front of a child a second or more before any filter could look at them. The
text accumulates in the worker, gets checked there as it grows, and is drawn
once, after passing every check. A slow breathing dot covers the wait.

**Distress is not treated as misbehaviour.** The brief put self-harm language in
the same blocklist as swearing, which would answer a frightened child with
"I work best with school topics!". Instead, anything that reads as distress or
harm at home skips the model entirely and shows a fixed, human-written card that
leads with *tell a grown-up you trust* and then lists helplines (988, Crisis
Text Line, Childhelp, Childline). This over-triggers sometimes — "my brother hit
me" gets it too — and that's the right way round for the mistake to fall.

**Sensitive school topics get their own answer.** Drugs, alcohol, sex, weapons
and similar don't get the "try a school topic" brush-off; they get *"that one's
better to talk about with a grown-up you trust"*. Being told off for a real
question teaches a child to stop asking.

**The filters are tuned against over-blocking.** The Civil War, murder mystery
book reports, the Holocaust, "analysis of the poem", dykes in the Netherlands,
Assyria, shiitake mushrooms, sperm whales, the ovary of a flower and the
assassination of Archduke Franz Ferdinand all pass. There's a test for each.

**It teaches freely; it just won't hand over the finished work.** The brief's
rule — *"never generate content that could be used to complete homework"* — sat
in every prompt, and a fact about George Washington could be used to complete
homework, so the model hedged into answers with nothing in them. The rule now
says the opposite first: teach freely, facts and dates and names are the whole
point, an answer with no facts in it is a failed answer. What it withholds is
the artefact — the essay, the paragraph to copy, the answer to the exact sum
they were set. For maths it works a *similar* problem with different numbers, so
the method is taught and the homework isn't done.

**It will not write the work itself, and this is checked rather than asked.**
The rule lived only in the system prompt until "write an essay on Abraham
Lincoln" came back as a finished essay. Now: Break It Down has to return numbered steps that
start with something the child *does*, a finished essay is detected anywhere,
and a failure is retried once with the model told exactly what it got wrong.
Asked to write an essay in any other tab, the app points at Break It Down
instead.

**Religion is described, never preached.** Asked what Christianity is, the model
answered from inside the faith — "helps guide what we value in our daily lives".
When a question mentions a faith, the prompt gains a rule: describe beliefs from
the outside, say who holds them, lead with facts, never say "we believe" or
"God says". Answers that slip into the sermon voice are rejected and retried.

**Some questions belong to the family.** Three kinds: the ones with no factual
answer (does God exist, why does God allow suffering, what happens when you
die); adult topics (sex, puberty, where babies come from); and who people are
and who they love (gay, lesbian, transgender, non-binary). All get the same warm
message pointing home — nothing in it suggests the question was wrong to ask.

Sacred texts themselves — the Bible, the Quran, the Ten Commandments — *are*
answered, factually, because there are facts to give. The line is not the
subject, it is whether the answer is a fact or a family's to give. Every one of
these was drawn after reading what the model actually said, and each has a test
guarding the science and grammar that shares the vocabulary: asexual
reproduction, trans fats, binary numbers, the gender of French nouns, sperm
whales and the ovary of a flower are all still ordinary schoolwork.

**There is no chat, so it never pretends there is.** Answers that end "Want me
to explain another way?" or "What would you like to explore next?" have the
sign-off removed — there is nowhere for a child to reply. Only Find the Stuck keeps its
questions, since a numbered list of them is its entire deliverable.

**Calm Corner instructs rather than asks.** It used to be exempt from the
question trim, to protect "what can you hear?". Then an answer to "tired" came
back as four questions in a row — how are you feeling, is it your head or your
body, would you like to breathe, what sounds good — none of which a child can
answer. A child in overwhelm has run out of room to make decisions; that is much
of what being overwhelmed *is*. So the tab now says "listen for the quietest
sound in the room" instead of "what can you hear?", and with the questions gone
from the exercise, a question anywhere in the answer is a dead end like any
other.

**The answer starts inside its own format.** Every structured tab prefills the
model's reply — Break It Down begins at "1. ", Word Helper at "**Simple
Definition**" — so it is standing inside the shape before it writes a word.
This matters more the longer the shared rules get: 688 words of preamble arrive
before any tab's own instructions, and a 1.2B model quietly loses the format in
there. Prefilling is structure the model cannot drift out of; adding a
fourteenth rule about following the format would only have made the crowding
worse.

**Answers have to arrive in the shape the tab promised.** Break It Down owes
numbered steps that start with something the child *does*; Find the Stuck owes
numbered questions; five other tabs owe named sections ("Real-Life Connection",
"Story Version", "The Point"). An answer that ignores its format is retried once
with the model told exactly which mistake it made. Missing headings are then
shown anyway — untidy is not unusable, and a child who typed "science" should
never be told science isn't a school topic. The headings aren't
decoration — they're what makes the model do three separate jobs instead of one
vague one, and what lets a child skim.

**Vague is treated as a failure, not a style.** The commonest disappointment in
testing was not an unsafe answer but an empty one — four sentences about George
Washington that never mentioned he was a president. Every prompt now carries a
swap test the model applies to its own sentences: *would this still be true if
the topic were swapped for a different one?* "He worked hard and people followed
him" fits anybody, so it says nothing. Why Does This Matter leads with a facts
section — who, when, where, what for — before it tries to connect anything to a
child's life.

**No worked examples in the prompts.** A child typed "cat" and got five
paragraphs about "hindrance" — the example word that was sitting in Word
Helper's own misspelling instruction. This model copies examples as subject
matter, so the topic-bearing ones are gone, including an eight-step worked
answer about Amelia Earhart that was waiting to do the same thing to Break It
Down. Prefilling the first heading does the format work those examples were
carrying, without giving the model a topic to latch onto.

**An answer has to be about what was asked.** Asked what "hypothesis" meant,
the model read its own section heading as the subject, explained what a simple
definition is, and defined "fun" instead — never once mentioning the word. When
a child names a topic in a few words, those words have to appear in the answer,
allowing for inflection. Long pasted paragraphs and the two feelings tabs are
exempt, because neither is meant to be echoed back — and near misses count, so
"hinderance" is happily answered by "hindrance". A child looking up a word they
don't know often can't spell it yet; that is the whole reason they are there.

**The safety rules never leak out as content.** Twice the model turned a rule
about itself into something it said to the child: opening with "I notice a small
mistake" when there was none, and closing a chemistry answer with "if you notice
anything strange or uncomfortable, talk to someone you trust". Both are now
removed, and the preamble no longer hands it a quotable line to copy. Calm
Corner and What Can I Try are exempt — pointing at a person is their job.

**The two feelings tabs owe something you can do.** Calm Corner owes a
grounding exercise and What Can I Try owes activities, so an answer with neither
in it is rejected — "That's awesome! Feeling creative is such a cool emotion.
Want to explore what made you feel that way?" is not a suggestion.

**Calm Corner never apologises.** It owes exactly one thing — a grounding
exercise — so an answer with nothing in it to actually do is rejected. And when
the model fails twice in either feelings tab, the child gets the real thing
written out by people — box breathing, or three activities from three different
categories — rather than "that didn't come out right". Somebody who
came here overwhelmed should not be handed an error at the worst possible
moment, and a settling exercise is short, standard and safe enough to simply
write down.

**It never tells a child what to eat.** Asked for help while "tired and
hungry", it suggested snacks and how not to feel too full. This app talks to
eight to sixteen year olds, which are the years eating disorders most often
begin, and naming foods or commenting on fullness is not its place. Hunger is
still allowed to be real — the answer to it is one plain sentence saying so and
pointing at someone who can provide food. Digestion, photosynthesis and
herbivores are all still ordinary schoolwork.

**Nobody is called "little one".** A Calm Corner answer signed off "Take care,
little one" — a thing you say to a toddler, in an app built for eight to sixteen
year olds, at the moment a child is least able to shrug it off. Pet names are
stripped from every answer, in their vocative form only, so "ask a buddy to
check your work" survives untouched.

**Every model answer carries a caveat.** A small permanent line sits under
anything the model wrote: *"I get things wrong sometimes. If something looks
odd, check with a grown-up."* A child cannot tell a confident wrong answer from
a right one, and no filter fixes that. It never appears under the app's own
words — the care card, the fallbacks and the "ask your family" messages are
written by people and are not sometimes wrong.

**Everything is matched against flattened text.** Curly apostrophes, smart
quotes and en-dashes are straightened before any pattern runs. This is not
cosmetic: the model writes "Let's" and "don't" typographically far more often
than not, every pattern here spells them straight, and for a while a slice of
the crisis list, the injection list and the sign-off trim was silently failing
to match. It surfaced through a funny answer, not a frightening one, which is
worth remembering about filters in general.

**There is a way to tell somebody.** A Contact panel in the sidebar carries an
email address for concerns about the app, alongside a note that the 🚩 Looks
wrong button copies the exchange ready to paste in — since nothing is recorded,
that copy is the only record there is. The address is assembled in JavaScript
rather than written into the page, because a plain-text address on a public site
is harvested by spam bots, and this one belongs to a person.

### What it still can't do

- A determined older child can get past any filter running on their own device.
  The output filter is the second net, and the preamble is the third.
- A 1.2B model will sometimes give an answer that is simply unhelpful or a bit
  wrong. The filters catch harmful, not mediocre.
- Sitting with the child the first few times is worth more than all of the
  above. The parent panel says so.

---

## Running the tests

```powershell
npm test      # 109 filter tests — blocklists, coherence, length caps, fallbacks
npm run smoke # 58 browser tests — drives real headless Chrome through the app
npm run check # both
```

The smoke test walks the guidebook, the tabs, the settings, the parent panel and
the filters as they run in the browser. It stops where the model would speak —
that part needs WebGPU and the 814 MB download, so it's the one thing only you
can check.

---

## What's in here

The repository root *is* the site, so GitHub Pages can serve it with no
configuration beyond switching Pages on.

```
index.html               layout, parent panel, CSP
style.css                earth theme, light and dark
app.js                   tabs, generation, rendering, settings
prompts.js               the ten tabs and every word the model is told
safety.js                all the filtering, in one readable file
guidebook.js             the seven welcome cards
worker.js                runs the model, off the main thread
sw.js                    offline shell cache
manifest.webmanifest     name, colours, icon
assets/                  icon and the two self-hosted fonts

tests/                   filter tests and the browser smoke test
tools/serve.mjs          the little local server
run.ps1                  start it and open a browser
steady-ground-brief.md   the original build brief
```

The fonts are served from `assets/fonts/` rather than from Google. The app tells
parents nothing leaves the device, and a webfont request would have made that
untrue.

---

## Putting it online

This is a static site with no build step, and the repository root is the site.
In the repo on GitHub: **Settings → Pages → Source: Deploy from a branch →
Branch: `main`, folder: `/ (root)` → Save**. A minute later it is live at

    https://big-banana-studios.github.io/Steady-Ground/

Nothing large is ever hosted by you: the model comes from the Hugging Face CDN
and is cached in each child's browser. Every path in the app is relative, so it
works at whatever URL it ends up on.

When you deploy, bump **both**:

- `APP_VERSION` in `app.js`
- `VERSION` in `sw.js`

They must match. The version in the sidebar is how you tell at a glance which
build a device is actually running.
