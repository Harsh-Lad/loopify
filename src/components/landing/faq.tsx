import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";

const faqs = [
  {
    q: 'What is a "daily loop"?',
    a: "It's the rhythm Loopify is built around: plan your day in the morning, capture new work as it comes up, finish what you can, and let anything unfinished roll over into tomorrow's plan automatically.",
  },
  {
    q: "How does AI capture work?",
    a: "Paste a meeting transcript, a chat thread or a voice note. Loopify extracts the action items, suggests owners and due dates, and turns them into task cards you can review before adding them to a board.",
  },
  {
    q: "What happens to tasks I don't finish?",
    a: "They roll over into tomorrow's plan with their history intact, so you can see how long something has been carried and decide whether to finish, reschedule or drop it.",
  },
  {
    q: "Can managers see what everyone is doing?",
    a: "Managers get team reports, a consistency heatmap and a calendar view built from plans and end-of-day diaries. Personal diary entries stay private unless you choose to share them.",
  },
  {
    q: "Does it work with Google Sheets?",
    a: 'Yes. Connect a sheet and ask questions in plain language, like "which deals closed last week?". Loopify answers using the data in your sheet.',
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The Free plan covers small teams with the core daily loop. You can upgrade to Team or Business at any time, and downgrade whenever you like.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <Accordion type="single" collapsible className="mt-12 bg-card">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.q} value={`item-${index}`}>
              <AccordionTrigger className="text-base">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
