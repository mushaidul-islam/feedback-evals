export default function CampaignFeedbackPage() {
  return (
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#f7f1e5] p-5 text-[#121212] sm:p-8">
      <section className="w-full max-w-4xl">
        <h1 className="mb-6 text-center text-[clamp(3.8rem,15vw,10rem)] leading-[0.78] font-black tracking-[-0.09em] uppercase sm:mb-10">
          Feedback
        </h1>

        <form className="relative border-[5px] border-[#121212] bg-[#ff5c35] p-3 shadow-[9px_9px_0_#121212] sm:p-4">
          <textarea
            aria-label="Feedback"
            className="block h-44 w-full resize-none border-[4px] border-[#121212] bg-[#fffdf7] px-4 py-4 pr-18 text-xl leading-tight font-bold outline-none placeholder:text-[#121212]/35 focus:bg-white sm:h-52 sm:px-5 sm:py-5 sm:pr-22 sm:text-2xl"
            placeholder=""
          />
          <button
            aria-label="Send feedback"
            className="absolute right-6 bottom-6 grid size-14 place-items-center border-[4px] border-[#121212] bg-[#f9d94c] text-4xl leading-none font-black transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#121212] active:translate-x-1 active:translate-y-1 sm:right-8 sm:bottom-8 sm:size-16"
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}
