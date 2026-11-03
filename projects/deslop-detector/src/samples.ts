export interface Sample {
  id: string;
  label: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "blog",
    label: "Chatbot blog post",
    text: `Sure! Here's a short blog post about learning to cook.

Learning to cook isn't just about feeding yourself—it's about reclaiming your time, your health, and your creativity. In today's fast-paced world, the kitchen can feel like a daunting place. But here's the thing: every great chef started exactly where you are.

The best part? You don't need fancy equipment. A sharp knife, a sturdy pan, and a little curiosity are all it takes to embark on this journey. From simple weeknight pastas to elaborate weekend feasts, cooking serves as a gateway to a vibrant tapestry of flavors, cultures, and traditions.

Of course, there will be burnt onions, collapsed soufflés, and the occasional smoke alarm. That's okay. Every mistake is a lesson, helping you build confidence one dish at a time.

Ultimately, cooking is more than a skill—it's a testament to the joy of creating something meaningful with your own hands. So grab an apron and dive in. Your future self will thank you.`,
  },
  {
    id: "linkedin",
    label: "LinkedIn post",
    text: `I almost didn't post this. 👀

Last week, our team shipped the biggest release in company history. But it wasn't just a product launch. It was a lesson in resilience.

Here's what I learned:

- **Trust your team.** Great people do great work.
- **Embrace the chaos.** Growth lives outside your comfort zone.
- **Celebrate the small wins.** They add up.

Let's be honest: the road wasn't easy. There were late nights, tough conversations, and moments of doubt. But we kept going, fostering a culture of ownership, empowering every voice, and leveraging each other's strengths.

The result? A seamless experience that's redefining how teams collaborate. 🚀

Grateful. Humbled. Excited for what's next.

What's one lesson your last big launch taught you? 👇`,
  },
  {
    id: "plain",
    label: "A person wrote this",
    text: `We moved the release to Thursday because the migration took longer than I expected. The new index made reads faster, but it doubled the time to write a batch, and on the biggest customer that meant a forty-minute lock. Nobody would have noticed at 3 a.m., but I didn't want to find out on a Monday morning.

Priya rewrote the batch job to commit every ten thousand rows instead of once at the end. It runs a little longer overall and never holds the lock for more than a second. We tested it against a copy of last week's data and it finished in fifty-two minutes with no errors.

If anything looks off on Thursday, roll back with the usual script and page me. I'll be online from seven.`,
  },
];
