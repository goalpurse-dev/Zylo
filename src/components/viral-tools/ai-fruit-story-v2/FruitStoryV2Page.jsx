import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import FaceAsmrPaywall from "../face-asmr/FaceAsmrPaywall";
import NoCreditsModal from "../shared/NoCreditsModal";
import { ErrorBanner, FOCUS, PrimaryButton, SegmentedControl, StepBar, UpgradeDialog, cx } from "../../ui/zyvo";
import { isMockBackend, setFruitStoryV2Adapter } from "./api/fruitStoryV2Api";
import { createMockAdapter } from "./api/mock/mockAdapter";
import { createSupabaseAdapter } from "./api/supabaseAdapter";
import { EXAMPLE_VIDEO, MODES, SINGLE_STEPS, UPGRADE_COPY, stepForStatus } from "./constants";
import { PRICING_PLANS } from "../../../lib/pricingOutputs";
import BuilderPanel, { FootNote, StepHeading } from "./builder/BuilderPanel";
import { PipelineActions, PipelineSummary } from "./builder/Pipeline";
import { EpisodeCard, SeriesList, SeriesPlanPanel, SeriesWizard } from "./builder/SeriesPanels";
import SettingsFields from "./builder/SettingsFields";
import StoryStep from "./builder/StoryStep";
import CharacterLibraryDialog from "./dialogs/CharacterLibraryDialog";
import SceneActionDialog from "./dialogs/SceneDialogs";
import useAccount from "./hooks/useAccount";
import useCharacters from "./hooks/useCharacters";
import useFruitV2Flow from "./hooks/useFruitV2Flow";
import { TIERS, videosPerMonth } from "./pricing/fruitV2Estimates";
import { quoteFor } from "./pricing/useFruitV2Prices";
import FinalView from "./workspace/FinalView";
import IdleView from "./workspace/IdleView";
import { Roadmap, SeriesPreview, WritingPlan } from "./workspace/SeriesViews";
import StoryBoard, { WritingBoard } from "./workspace/StoryBoard";

/**
 * AI Fruit Story v2 (lime). Rendered by /workspace/ai-fruit-story when the
 * fruit_v2 flag is on (see src/pages/workspace/AIFruitStory.jsx).
 *
 * Layout: one tree for every width. Below lg, #workspace-scroll is the only
 * scroller, a sticky tab bar switches between Build and the result view, and
 * each view has a footer fixed above the bottom nav. At lg+, the builder
 * (420/460px) and the result view sit side by side and scroll on their own.
 */
export default function FruitStoryV2Page({ preview = null }) {
  // Real users get the real backend (the API's default). Only the dev preview
  // (?fruitV2Preview=1) runs on the mock; ?fail=… makes those steps fail once.
  // Runs during the first render, before any effect talks to the API.
  useState(() => {
    setFruitStoryV2Adapter(preview ? createMockAdapter({ fail: preview.fail || "", empty: Boolean(preview.emptyRecent) }) : createSupabaseAdapter());
  });
  const navigate = useNavigate();
  const account = useAccount(preview);
  const characters = useCharacters();
  const flow = useFruitV2Flow(account, characters.characters);
  const { mode, single, series, story } = flow;
  const byId = characters.byId;
  // Keep the last "Who is …?" name so the dialog title doesn't blank while it closes.
  const lastAssigning = useRef(null);
  if (flow.assigning) lastAssigning.current = flow.assigning;
  const mock = isMockBackend();

  const isEpisodeStory = mode === "series" && series.view === "episode" && Boolean(story);
  const nextEpisode = flow.seriesData?.episodes.find((e) => e.status === "next") ?? null;
  const currentEpisode = flow.seriesData?.episodes.find((e) => e.number === series.episodeNumber) ?? null;

  // ── Left panel ─────────────────────────────────────────────────────────
  const modeToggle = (
    <SegmentedControl size="lg" ariaLabel="What are you making?" options={MODES} value={mode} onChange={flow.changeMode} disabled={Boolean(flow.acting)} />
  );
  let top = modeToggle;
  let bodyKey = "";
  let body = null;
  let footer = null;

  const errorLine = flow.actionError && <ErrorBanner className="mb-2">{flow.actionError}</ErrorBanner>;
  const pipelineFooter = story && (
    <>
      {errorLine}
      <PipelineActions story={story} quotes={flow.quotes} balance={account.balance} acting={flow.acting} isEpisode={mode === "series"} handlers={flow.pipeline} />
    </>
  );

  if (mode === "single") {
    if (single.storyId) {
      top = <>{modeToggle}<StepBar steps={SINGLE_STEPS} current={story ? stepForStatus(story.status) : 2} /></>;
      bodyKey = "single-pipeline";
      body = story ? <PipelineSummary story={story} byId={byId} /> : <LoadingOrError status={flow.storyStatus} onRetry={flow.reloadStory} what="this video" />;
      footer = story ? pipelineFooter : <PrimaryButton variant="secondary" onClick={flow.newStory}>Start a new story</PrimaryButton>;
    } else if (single.step === "story") {
      top = <>{modeToggle}<StepBar steps={SINGLE_STEPS} current={0} /></>;
      bodyKey = "single-story";
      body = (
        <StoryStep
          single={single}
          ideas={flow.ideas}
          characters={characters}
          scriptParse={flow.scriptParse}
          onChange={flow.updateSingle}
          onNewIdeas={flow.newIdeas}
          onRetryIdeas={flow.ideas.retry}
          onOpenLibrary={() => flow.openLibrary("single")}
          onAssignName={flow.startAssigning}
        />
      );
      footer = (
        <>
          <PrimaryButton chevron disabled={Boolean(flow.storyBlocker)} onClick={() => flow.updateSingle({ step: "settings" })}>
            Next: choose length and quality
          </PrimaryButton>
          {flow.storyBlocker && <FootNote>{flow.storyBlocker}</FootNote>}
        </>
      );
    } else {
      const est = flow.singleEstimate;
      const short = est.total != null && est.total > account.balance;
      top = <>{modeToggle}<StepBar steps={SINGLE_STEPS} current={1} /></>;
      bodyKey = "single-settings";
      body = (
        <>
          <StepHeading title="How should it look?" subtitle="You'll see every scene picture before any video is made." />
          <SettingsFields
            value={single}
            onChange={flow.updateSingle}
            allowedTiers={account.allowedTiers}
            onLockedTier={flow.setUpgradeTier}
            quotes={flow.quotes}
            balance={account.balance}
            scriptScenes={flow.scriptScenes}
            firstVideo={flow.firstVideo}
          />
        </>
      );
      footer = (
        <>
          {errorLine}
          <div className="flex gap-2">
            <PrimaryButton variant="secondary" fullWidth={false} className="shrink-0 px-5" onClick={() => flow.updateSingle({ step: "story" })} disabled={Boolean(flow.acting)}>Back</PrimaryButton>
            {short ? (
              <PrimaryButton className="flex-1" onClick={() => flow.setNoCredits({ needed: est.total })}>Add credits</PrimaryButton>
            ) : (
              <PrimaryButton className="flex-1" price={quoteFor(flow.quotes, est.pictures)} priceOf={{ value: est.total, approx: !flow.scriptScenes }} busy={flow.acting === "start" ? "Writing your script…" : null} onClick={flow.startSingle}>
                Make scene pictures
              </PrimaryButton>
            )}
          </div>
          <FootNote tone={short ? "warn" : "muted"}>
            {short ? `You need ${(est.total - account.balance).toLocaleString()} more credits for this video. Pick a shorter length or V2, or add credits.` : `Pictures now (${est.pictures ?? "…"}), the rest (about ${est.video ?? "…"}) only when you animate, after you've approved the pictures.`}
          </FootNote>
        </>
      );
    }
  } else if (series.view === "list") {
    bodyKey = "series-list";
    body = <SeriesList list={flow.seriesList} byId={byId} onOpen={flow.openSeries} onRetry={flow.seriesList.retry} />;
    footer = <PrimaryButton onClick={flow.newSeries}>Create a new series</PrimaryButton>;
  } else if (series.view === "create") {
    const last = series.wizardStep === 4;
    bodyKey = `series-create-${series.wizardStep}`;
    body = <SeriesWizard step={series.wizardStep} draft={series.draft} byId={byId} onChange={flow.updateDraft} onOpenLibrary={() => flow.openLibrary("series")} />;
    footer = (
      <>
        <div className="flex gap-2">
          <PrimaryButton variant="secondary" fullWidth={false} className="shrink-0 px-5" onClick={flow.wizardBack} disabled={series.writing}>{series.wizardStep === 0 ? "Cancel" : "Back"}</PrimaryButton>
          <PrimaryButton
            className="flex-1"
            chevron={!last}
            disabled={Boolean(flow.wizardBlocker)}
            busy={series.writing ? "Writing your plan…" : null}
            onClick={last ? flow.createPlan : flow.wizardNext}
          >
            {last ? "Write my series plan" : "Next"}
          </PrimaryButton>
        </div>
        <FootNote>{flow.wizardBlocker ?? (last ? "Writing the plan is free." : `Question ${series.wizardStep + 1} of 5`)}</FootNote>
      </>
    );
  } else if (series.view === "plan") {
    bodyKey = `series-plan-${series.seriesId}`;
    body = flow.seriesData ? <SeriesPlanPanel series={flow.seriesData} byId={byId} /> : <LoadingOrError status={flow.seriesStatus} onRetry={flow.retrySeries} what="this series" />;
    footer = (
      <>
        <BackLink onClick={flow.allSeries}>All series</BackLink>
        {nextEpisode
          ? <PrimaryButton chevron onClick={() => flow.startEpisode(nextEpisode.number)}>Make episode {nextEpisode.number}</PrimaryButton>
          : <PrimaryButton variant="secondary" onClick={flow.allSeries} disabled={!flow.seriesData}>Back to your series</PrimaryButton>}
      </>
    );
  } else if (series.view === "episode") {
    if (series.storyId) {
      top = <>{modeToggle}<StepBar steps={SINGLE_STEPS} current={story ? stepForStatus(story.status) : 2} /></>;
      bodyKey = `episode-pipeline-${series.episodeNumber}`;
      body = story
        ? <PipelineSummary story={story} byId={byId} header={currentEpisode && flow.seriesData && <EpisodeCard episode={currentEpisode} total={flow.seriesData.episodes.length} />} />
        : <LoadingOrError status={flow.storyStatus} onRetry={flow.reloadStory} what="this episode" />;
      footer = story ? pipelineFooter : <PrimaryButton variant="secondary" onClick={flow.backToSeries}>Back to series</PrimaryButton>;
    } else {
      const est = flow.episodeEstimate;
      const short = est.total != null && est.total > account.balance;
      top = <>{modeToggle}<StepBar steps={SINGLE_STEPS} current={1} /></>;
      bodyKey = `episode-settings-${series.episodeNumber}`;
      body = currentEpisode && flow.seriesData ? (
        <>
          <EpisodeCard episode={currentEpisode} total={flow.seriesData.episodes.length} />
          <StepHeading title={`Make episode ${currentEpisode.number}`} subtitle={flow.seriesData.title} />
          <SettingsFields
            value={{ ...series.episode, aspect: "9:16" }}
            onChange={flow.updateEpisode}
            allowedTiers={account.allowedTiers}
            onLockedTier={flow.setUpgradeTier}
            quotes={flow.quotes}
            balance={account.balance}
            showAspect={false}
          />
        </>
      ) : <LoadingOrError status={flow.seriesStatus} onRetry={flow.retrySeries} what="this series" />;
      footer = (
        <>
          {errorLine}
          <div className="flex gap-2">
            <PrimaryButton variant="secondary" fullWidth={false} className="shrink-0 px-5" onClick={flow.backToSeries} disabled={Boolean(flow.acting)}>Back</PrimaryButton>
            {short ? (
              <PrimaryButton className="flex-1" onClick={() => flow.setNoCredits({ needed: est.total })}>Add credits</PrimaryButton>
            ) : (
              <PrimaryButton className="flex-1" price={quoteFor(flow.quotes, est.pictures)} priceOf={{ value: est.total, approx: true }} busy={flow.acting === "start" ? "Writing the episode…" : null} onClick={flow.startEpisodeStory} disabled={!currentEpisode}>
                Make scene pictures
              </PrimaryButton>
            )}
          </div>
          <FootNote tone={short ? "warn" : "muted"}>
            {short ? `You need ${(est.total - account.balance).toLocaleString()} more credits for this episode. Pick a shorter length or V2, or add credits.` : `Pictures now (${est.pictures ?? "…"}), the rest (about ${est.video ?? "…"}) only when you animate, after you've approved the pictures.`}
          </FootNote>
        </>
      );
    }
  }

  // ── Right panel ────────────────────────────────────────────────────────
  let result;
  let resultTabLabel = "Recent";
  let resultFooter = null;
  const storyExpected = (mode === "single" && single.storyId) || (mode === "series" && series.view === "episode" && series.storyId);

  if (flow.acting === "start" && !story) {
    // The script is being written: show the storyboard right away.
    resultTabLabel = "Your video";
    result = mode === "series"
      ? <WritingBoard sceneCount={flow.episodeEstimate.sceneCount} label="Writing the episode…" />
      : <WritingBoard sceneCount={flow.scriptScenes?.count ?? flow.singleEstimate.sceneCount} aspect={single.aspect} />;
  } else if (storyExpected) {
    resultTabLabel = "Your video";
    if (!story) {
      result = <LoadingOrError status={flow.storyStatus} onRetry={flow.reloadStory} what="this video" />;
    } else if (story.status === "final_ready") {
      result = (
        <FinalView
          story={story}
          byId={byId}
          isEpisode={isEpisodeStory}
          series={flow.seriesData}
          onCaptions={flow.setCaptions}
          onFinalOption={flow.setFinalOption}
          onDownloadCover={flow.downloadCover}
          onDownload={flow.pipeline.onDownload}
          onNextEpisode={flow.startEpisode}
          captionsBusy={flow.captionsBusy}
        />
      );
      resultFooter = pipelineFooter;
    } else {
      result = (
        <StoryBoard
          story={story}
          byId={byId}
          prices={flow.quotes.prices}
          onEdit={(scene) => flow.openSceneDialog("edit", scene)}
          onRegenerate={(scene) => flow.openSceneDialog("regenerate", scene)}
          onRegenerateClip={(scene) => flow.openSceneDialog("clip", scene)}
          onRegenerateFree={flow.regenerateFree}
          acting={flow.acting}
        />
      );
      resultFooter = pipelineFooter;
    }
  } else if (mode === "series" && (series.writing || series.planError)) {
    resultTabLabel = "Plan";
    result = <WritingPlan castIds={series.draft.castIds} byId={byId} error={series.planError} onRetry={flow.createPlan} />;
  } else if (mode === "series" && series.view === "create") {
    resultTabLabel = "Preview";
    result = <SeriesPreview draft={series.draft} byId={byId} />;
  } else if (mode === "series" && (series.view === "plan" || series.view === "episode")) {
    resultTabLabel = "Episodes";
    result = flow.seriesData ? <Roadmap series={flow.seriesData} byId={byId} onOpenEpisode={flow.startEpisode} /> : <LoadingOrError status={flow.seriesStatus} onRetry={flow.retrySeries} what="this series" />;
    if (series.view === "plan" && nextEpisode) {
      resultFooter = <PrimaryButton chevron onClick={() => flow.startEpisode(nextEpisode.number)}>Make episode {nextEpisode.number}</PrimaryButton>;
    }
  } else {
    result = (
      <IdleView
        recentTab={flow.recentTab}
        onRecentTab={flow.setRecentTab}
        recent={flow.recent}
        byId={byId}
        onOpenSingle={flow.openSingle}
        onOpenSeries={flow.openSeries}
        viewer={account.viewer}
        onSignUp={() => navigate("/signup")}
        onGetPlan={account.paywall.show}
        onStart={() => { if (mode !== "single") flow.changeMode("single"); flow.setTab("build"); }}
      />
    );
  }

  const banner = mock && (
    <p className="rounded-xl border border-lime-300/20 bg-lime-300/[0.06] px-3 py-2 text-[11px] font-semibold leading-relaxed text-lime-200">
      Preview mode. Nothing is charged or saved.
      {preview && <span className="text-lime-200/60"> Dev preview: {preview.plan} plan, {account.balance.toLocaleString()} credits.</span>}
    </p>
  );

  return (
    <>
      <div className="flex min-h-full w-full flex-col bg-[#0B0D0F] lg:h-full lg:flex-row lg:gap-3 lg:overflow-hidden lg:p-3">
        {/* Mobile: banner, then the sticky Build / result tab bar. */}
        {banner && <div className="px-3 pt-3 lg:hidden">{banner}</div>}
        <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0B0D0F]/95 px-3 py-3 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1" role="tablist" aria-label="View">
            {[["build", "Build"], ["result", resultTabLabel]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={flow.tab === id}
                onClick={() => flow.setTab(id)}
                className={cx("rounded-full px-3 py-2 text-[13px] font-semibold transition", FOCUS, flow.tab === id ? "bg-white text-black" : "text-white/60")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={cx("flex-col gap-2 px-3 pt-3 lg:flex lg:h-full lg:w-[420px] lg:shrink-0 lg:p-0 xl:w-[460px]", flow.tab === "build" ? "flex" : "hidden")}>
          {banner && <div className="hidden lg:block">{banner}</div>}
          <div className="lg:min-h-0 lg:flex-1">
            <BuilderPanel top={top} footer={footer} bodyKey={bodyKey}>{body}</BuilderPanel>
          </div>
        </div>

        <section
          aria-label="Your video"
          className={cx("min-w-0 px-3 pt-3 lg:block lg:h-full lg:flex-1 lg:overflow-y-auto lg:p-0", flow.tab === "result" ? "block" : "hidden")}
        >
          <div className={cx(
            "relative flex min-h-[520px] flex-col rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-4 sm:p-5 lg:min-h-full",
            resultFooter ? "mb-[200px] lg:mb-0" : "mb-[100px] lg:mb-0",
          )}>
            {result}
          </div>
          {resultFooter && (
            <div className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:hidden">
              {resultFooter}
            </div>
          )}
        </section>
      </div>

      <CharacterLibraryDialog
        open={Boolean(flow.library)}
        onClose={flow.closeLibrary}
        characters={characters}
        selectedIds={flow.libraryIds}
        max={flow.libraryMax}
        onToggle={flow.toggleLibrary}
      />
      <CharacterLibraryDialog
        open={Boolean(flow.assigning)}
        onClose={flow.cancelAssigning}
        characters={characters}
        selectedIds={lastAssigning.current?.speakerId ? [lastAssigning.current.speakerId] : []}
        max={1}
        pickOne
        onPick={(id) => flow.assignName(lastAssigning.current.key, id)}
        title={`Who is "${lastAssigning.current?.name ?? ""}"?`}
        description="Pick the library character who says these lines. They look the same in every scene."
      />
      <SceneActionDialog
        kind={flow.sceneDialog?.kind}
        scene={flow.dialogScene}
        speakerName={flow.dialogScene ? byId(flow.dialogScene.speakerId)?.name.split(" ")[0] : ""}
        price={flow.dialogPrice == null ? null : { status: "ready", value: flow.dialogPrice }}
        onClose={flow.closeSceneDialog}
        onSubmit={flow.submitSceneDialog}
      />
      <UpgradeDialog
        open={Boolean(flow.upgradeTier)}
        onClose={() => flow.setUpgradeTier(null)}
        title={UPGRADE_COPY[flow.upgradeTier]?.title ?? ""}
        body={UPGRADE_COPY[flow.upgradeTier]?.body ?? ""}
        requiredPlan={flow.upgradeTier ? TIERS[flow.upgradeTier].minPlan : null}
      />
      <NoCreditsModal
        open={Boolean(flow.noCredits)}
        onClose={() => flow.setNoCredits(null)}
        creditsNeeded={flow.noCredits?.needed ?? 0}
        creditBalance={account.balance}
        variant="lime"
      />
      {(!preview || preview.viewer !== "paid") && (
        <FaceAsmrPaywall
          open={account.paywall.open}
          onClose={account.paywall.close}
          isGuest={account.paywall.guest}
          dismissable
          toolName="AI Fruit Story"
          previewSrc={EXAMPLE_VIDEO.url}
          planLines={paywallLines(flow.quotes.prices)}
        />
      )}
    </>
  );
}

function BackLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={cx("mb-2 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[11px] font-bold text-white/45 transition hover:text-white", FOCUS)}>
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

function LoadingOrError({ status, onRetry, what }) {
  if (status === "error") {
    return <ErrorBanner action="Try again" onAction={onRetry}>We couldn&apos;t open {what}. Check your connection and try again.</ErrorBanner>;
  }
  return (
    <div className="flex flex-col gap-2" aria-label={`Loading ${what}`} role="status">
      <div className="h-20 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none" />
    </div>
  );
}

/**
 * Paywall lines per plan from the live prices: about how many 20-second
 * stories a month of credits makes, on each tier the plan includes.
 * null (line dropped) until prices load; nothing is guessed.
 */
function paywallLines(prices) {
  const n = (plan, tier) => videosPerMonth(PRICING_PLANS[plan].credits, 20, tier, prices);
  const line = (plan, tiers) => {
    const counts = tiers.map((t) => [t, n(plan, t)]);
    if (counts.some(([, c]) => c == null)) return null;
    const [[, first], ...rest] = counts;
    return `About ${first} AI Fruit Story videos of 20 s / month on V2${rest.map(([t, c]) => `, or ${c} on ${t.toUpperCase()}`).join("")}`;
  };
  return { starter: line("starter", ["v2"]), pro: line("pro", ["v2", "v3"]), generative: line("generative", ["v2", "v3", "v4"]) };
}
