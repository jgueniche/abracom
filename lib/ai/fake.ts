import "server-only";

import {
  SAMPLE_FRENCH_SHEET,
  SAMPLE_HEBREW_SHEET,
  SAMPLE_MATH_SHEET,
} from "@/lib/practice/samples";

import type { PracticeProvider, SheetRequest } from "./types";
import { pcmToWav } from "./wav";

/**
 * A provider that calls nobody (`PRACTICE_AI_PROVIDER=fake`): a fixed sheet, a drawn
 * placeholder and a short tone. For development without Google Cloud keys and for the e2e
 * suite, so that the whole path — request, waiting, sheet, print, team gestures — is played
 * without paying for a call or depending on a network.
 */
export function fakeProvider(): PracticeProvider {
  return {
    name: "fake",
    textModel: "fake",

    async writeSheet(request: SheetRequest) {
      const prompt = request.parts.map((part) => ("text" in part ? part.text : "")).join("\n");
      await pause(600);
      // The subject line only: the level guidance mentions numbers for every class.
      const subject = /^Matière : (.*)$/m.exec(prompt)?.[1] ?? "";
      if (/math|calcul|nombre/i.test(subject)) return SAMPLE_MATH_SHEET;
      if (/h[ée]breu|kodesh/i.test(subject)) return SAMPLE_HEBREW_SHEET;
      return SAMPLE_FRENCH_SHEET;
    },

    async illustrate() {
      await pause(300);
      return Buffer.from(PLACEHOLDER_SVG);
    },

    async speak() {
      return tone();
    },
  };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 0.4 s of a soft 440 Hz tone, then silence: enough for a player to play something. */
function tone(): Buffer {
  const rate = 24000;
  const samples = Math.round(rate * 0.6);
  const pcm = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    const fade = index < rate * 0.4 ? Math.min(1, (rate * 0.4 - index) / 2400) : 0;
    pcm.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * index) / rate) * 6000 * fade),
      index * 2,
    );
  }
  return pcmToWav(pcm, rate);
}

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
<rect width="1200" height="675" fill="#e8f1fb"/>
<circle cx="980" cy="150" r="90" fill="#ffd36b"/>
<path d="M0 520 C 250 430 450 600 700 520 S 1050 430 1200 500 V675 H0Z" fill="#9ed49a"/>
<path d="M0 590 C 300 520 600 660 900 590 S 1150 560 1200 580 V675 H0Z" fill="#6cbf72"/>
<circle cx="320" cy="470" r="46" fill="#e2463f"/><rect x="314" y="410" width="10" height="24" rx="4" fill="#6b4a2b"/>
<circle cx="440" cy="500" r="40" fill="#e2463f"/><circle cx="560" cy="478" r="44" fill="#e2463f"/>
</svg>`;
