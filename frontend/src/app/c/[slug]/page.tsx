import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function CampaignFeedbackPage() {
  return (
    <main className="bg-background text-foreground grid min-h-screen place-items-center overflow-hidden p-5 sm:p-8">
      <section className="w-full max-w-4xl">
        <h1
          className="font-head mb-12 text-center text-[clamp(3.75rem,14vw,9.5rem)] leading-[0.72] tracking-[-0.075em] text-[#ff5c35] uppercase sm:mb-16"
          style={{ textShadow: '6px 6px 0 #121212, 14px 14px 0 rgb(223, 198, 36)' }}
        >
          <span className="block mb-1">Truth</span>
          <span className="inline-block sm:mr-4">Be </span>
          <span className="inline-block">Told</span>
        </h1>

        <p className="mb-5 max-w-2xl mx-auto text-center font-sans text-xl leading-snug font-bold sm:mb-6 sm:text-2xl">
          How was my dance or art? How am I as a colleague? Tell me what you really think.
        </p>

        <form className="border-border bg-accent relative border-2 p-3 shadow-xl sm:p-4">
          <Textarea
            aria-label="Feedback"
            className="border-border h-44 resize-none border-2 px-4 py-4 pr-18 font-sans text-xl leading-tight font-semibold sm:h-52 sm:px-5 sm:py-5 sm:pr-22 sm:text-2xl"
            placeholder=""
          />
          <Button
            aria-label="Send feedback"
            className="absolute right-6 bottom-6 size-14 p-0 text-4xl leading-none sm:right-8 sm:bottom-8 sm:size-16"
            size="icon-lg"
            type="button"
          >
            <span aria-hidden="true">→</span>
          </Button>
        </form>
      </section>
    </main>
  );
}
