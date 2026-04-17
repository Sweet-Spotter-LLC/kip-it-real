import { QuizContainer } from "@/components/quiz/QuizContainer";

export const metadata = {
  title: "Quiz — Kip It Real",
  description:
    "Answer a few questions about how you play and get your top three glove matches.",
};

export default function QuizPage() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">The matchmaker</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold text-brand-primary">
            Let&rsquo;s find your glove.
          </h1>
          <p className="mt-4 text-base md:text-lg text-brand-text">
            No signup. No email. Answer honestly — the scoring engine rewards
            honesty with a better match.
          </p>
        </div>

        <div className="mt-12">
          <QuizContainer />
        </div>
      </div>
    </section>
  );
}
