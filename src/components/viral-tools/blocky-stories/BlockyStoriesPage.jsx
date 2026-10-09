import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AuthModal from "../../AuthModal";
import NoCreditsModal from "../shared/NoCreditsModal";
import { ErrorBanner, FOCUS, PrimaryButton, SegmentedControl, StepBar, cx } from "../../ui/zyvo";
import { MODES, SINGLE_STEPS, stepForStatus } from "./constants";
import { useFeatureFlag } from "../../../lib/featureFlags";
import { BLOCKY_SERIES_FLAG, BLOCKY_STORIES_PATH } from "../../../data/blockyStories";
import BuilderPanel, { FootNote, StepHeading } from "./builder/BuilderPanel";
import { PipelineActions, PipelineSummary } from "./builder/Pipeline";
import { AvatarStack } from "./shared/Avatar";
import { EpisodeCard, SeriesList, SeriesPlanPanel, SeriesWizard } from "./builder/SeriesPanels";
import SettingsFields, { QuickSettings } from "./builder/SettingsFields";
import StoryStep from "./builder/StoryStep";
import CharacterLibraryDialog from "./dialogs/CharacterLibraryDialog";
import PlansDialog from "./dialogs/PlansDialog";
import SceneActionDialog from "./dialogs/SceneDialogs";
import useAccount from "./hooks/useAccount";
import useCharacters from "./hooks/useCharacters";
import useBlockyFlow from "./hooks/useBlockyFlow";
import { TIERS } from "./pricing/blockyEstimates";
import { quoteFor } from "./pricing/useBlockyPrices";
import FinalView from "./workspace/FinalView";
import IdleView from "./workspace/IdleView";
import { Roadmap, SeriesPreview, WritingPlan } from "./workspace/SeriesViews";
import StoryBoard, { WritingBoard } from "./workspace/StoryBoard";
import VersionsView from "./workspace/VersionsView";

/**
 * Blocky Stories (lime). Rendered by /workspace/blocky-stories when the
 * blocky_v1 flag is on (see src/pages/workspace/BlockyStories.jsx). Its own
 * product: this folder talks only to blocky-story-api and Blocky's tables.
 *
 * Layout: one tree for every width. Below lg, #workspace-scroll is the only
 * scroller, a sticky tab bar switches between Build and the result view, and
 * each view has a footer fixed above the bottom nav. At lg+, the builder
 * (420/460px) and the result view sit side by side and scroll on their own.
 */
/** The step bar while three versions are showing: the second step is the pick, not the settings. */
const VERSION_STEPS = SINGLE_STEPS.map((label, i) => (i === 1 ? "Your version" : label));

export default function BlockyStoriesPage() {
  const navigate = useNavigate();
  const account = useAccount();
  const characters = useCharacters();
  const flow = useBlockyFlow(account, characters.characters);
  // Series has its own switch (off for everyone until single stories pass the quality review): without it
  // the page is single videos only. Nothing of series is removed, it is just never shown or started.
  const seriesOn = useFeatureFlag(BLOCKY_SERIES_FLAG, account.user?.id).enabled;
  const { single, series, story } = flow;
  const mode = seriesOn ? flow.mode : "single";
  const byId = characters.byId;
  // Keep the last "Who is …?" name so the dialog title doesn't blank while it closes.
  const lastAssigning = useRef(null);
  if (flow.assigning) lastAssigning.current = flow.assigning;
  // The upgrade popup: a locked tier was pressed, or the free plan pressed a button past the ideas. What it
  // was opened for is kept while it closes, so its lines don't change on the way out.
  const plansOpen = Boolean(flow.upgradeTier) || flow.gate === "plan";
  const plansTier = useRef(null);
  if (plansOpen) plansTier.current = flow.upgradeTier;

  const isEpisodeStory = mode === "series" && series.view === "episode" && Boolean(story);
  const nextEpisode = flow.seriesData?.episodes.find((e) => e.status === "next") ?? null;
  const currentEpisode = flow.seriesData?.episodes.find((e) => e.number === series.episodeNumber) ?? null;

  // ── Left panel ─────────────────────────────────────────────────────────
  const modeToggle = seriesOn ? (
    <SegmentedControl size="lg" ariaLabel="What are you making?" options={MODES} value={mode} onChange={flow.changeMode} disabled={Boolean(flow.acting)} />
  ) : null;
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
    } else if (flow.draft) {
      // Three versions are being written or waiting for a pick (the result view): what was asked for, and what comes next.
      const est = flow.singleEstimate;
      top = <>{modeToggle}<StepBar steps={VERSION_STEPS} current={1} /></>;
      bodyKey = "single-versions";
      body = (
        <>
          <StepHeading title="Pick your version" subtitle="Three versions of your story, each with a different twist. Read them and pick the one you'd watch." />
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3">
            <AvatarStack ids={single.castIds} byId={byId} />
            <p className="mt-2.5 text-[12.5px] font-bold text-white/80">{TIERS[single.tierId].label} · about {single.lengthSec} sec</p>
            <ol className="mt-2.5 flex flex-col gap-1.5 text-[11.5px] font-medium leading-relaxed text-white/50">
              <li>1. Pick a version. Writing is free.</li>
              <li>2. Scene pictures{est.scriptShare ? ", script included" : ""}: {est.pictures ?? "…"} credits. You check every picture.</li>
              <li>3. Animate: about {est.video ?? "…"} credits, only when you say so.</li>
            </ol>
          </div>
        </>
      );
      footer = (
        <>
          <PrimaryButton className="lg:hidden" chevron onClick={() => flow.setTab("result")}>See your three versions</PrimaryButton>
          <PrimaryButton variant="secondary" onClick={flow.leaveVersions} disabled={Boolean(flow.picking)}>Change the story</PrimaryButton>
        </>
      );
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
          onPickIdea={flow.pickIdea}
          onAskIdeas={flow.askIdeas}
          onNewIdeas={flow.newIdeas}
          onRetryIdeas={flow.ideas.retry}
          onOpenLibrary={() => flow.openLibrary("single")}
          onAssignName={flow.startAssigning}
        />
      );
      const est = flow.singleEstimate;
      // Not enough credits is a paid user's question: with no plan the button leads to the sign-up or the plan popup.
      const short = account.viewer === "paid" && est.total != null && est.total > account.balance;
      // The user's own script goes on to the settings; an idea or a description leads straight to its three versions.
      const versionsReady = single.method === "idea" ? Boolean(single.ideaId) : !flow.storyBlocker;
      const quickSettings = <QuickSettings value={single} onChange={flow.updateSingle} allowedTiers={account.allowedTiers} onLockedTier={flow.setUpgradeTier} quotes={flow.quotes} />;
      if (single.method === "script") {
        footer = (
          <>
            <PrimaryButton chevron disabled={Boolean(flow.storyBlocker)} onClick={flow.continueToSettings}>
              Next: choose length and quality
            </PrimaryButton>
            {flow.storyBlocker && <FootNote>{flow.storyBlocker}</FootNote>}
          </>
        );
      } else if (versionsReady) {
        // Quality and length are chosen here, in view, before anything is written: the length decides the script.
        footer = (
          <>
            {errorLine}
            {quickSettings}
            {short ? (
              <PrimaryButton onClick={() => flow.setNoCredits({ needed: est.total })}>Add credits</PrimaryButton>
            ) : (
              <PrimaryButton busy={flow.acting === "versions" ? "Planning three versions…" : null} onClick={flow.startSingle}>Write 3 versions, free</PrimaryButton>
            )}
            {/* On a phone the bar stays short: the button says "free" and the cost line says the rest. */}
            <div className={short ? undefined : "hidden lg:block"}>
              <FootNote tone={short ? "warn" : "muted"}>
                {short ? `The full video needs ${(est.total - account.balance).toLocaleString()} more credits. Pick a shorter length or V2, or add credits.` : "Writing is free. You pay for the pictures after you pick a version, and for the video only when you animate."}
              </FootNote>
            </div>
          </>
        );
      } else if (single.method === "prompt") {
        // A description that isn't ready yet: the same button, off, with what is missing.
        footer = (
          <>
            {errorLine}
            {quickSettings}
            <PrimaryButton disabled>Write 3 versions, free</PrimaryButton>
            <FootNote>{flow.storyBlocker}</FootNote>
          </>
        );
      } else if (flow.actionError) {
        footer = errorLine;   // nothing to press until an idea is picked: no bar, unless there is something to say
      }
    } else {
      const est = flow.singleEstimate;
      // Not enough credits is a paid user's question: with no plan the button leads to the sign-up or the plan popup.
      const short = account.viewer === "paid" && est.total != null && est.total > account.balance;
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
            showAspect={false}
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
            ) : single.method === "script" ? (
              <PrimaryButton className="flex-1" price={quoteFor(flow.quotes, est.pictures)} priceOf={{ value: est.total, approx: !flow.scriptScenes }} busy={flow.acting === "start" ? "Writing your script…" : null} onClick={flow.startSingle}>
                Make scene pictures
              </PrimaryButton>
            ) : (
              <PrimaryButton className="flex-1" busy={flow.acting === "versions" ? "Planning three versions…" : null} onClick={flow.startSingle}>
                Write 3 versions, free
              </PrimaryButton>
            )}
          </div>
          <FootNote tone={short ? "warn" : "muted"}>
            {short
              ? `You need ${(est.total - account.balance).toLocaleString()} more credits for this video. Pick a shorter length or V2, or add credits.`
              : single.method === "script"
                ? `Pictures now (${est.pictures ?? "…"}), the rest (about ${est.video ?? "…"}) only when you animate, after you've approved the pictures.`
                : `Writing is free. Pictures (${est.pictures ?? "…"}) are made after you pick a version, and the rest (about ${est.video ?? "…"}) only when you animate.`}
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
  // With no plan the result side is the showcase: real videos, and the way in.
  let resultTabLabel = account.viewer === "paid" ? "Recent" : "Examples";
  let resultFooter = null;
  const storyExpected = (mode === "single" && single.storyId) || (mode === "series" && series.view === "episode" && series.storyId);

  if (mode === "single" && !single.storyId && flow.draft) {
    // Three versions of the story: the cards fill in as each is written. Nothing is charged until one is picked and its pictures are made.
    resultTabLabel = "Your story";
    result = <VersionsView draft={flow.draft} byId={byId} picking={flow.picking} error={flow.acting ? null : flow.actionError} onPick={flow.pickVersion} onNew={flow.newVersions} onBack={flow.leaveVersions} />;
  } else if (flow.acting === "start" && !story) {
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
          onFinalOption={seriesOn ? flow.setFinalOption : undefined}
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
        showSeries={seriesOn}
        onOpenSingle={flow.openSingle}
        onOpenSeries={flow.openSeries}
        viewer={account.viewer}
        onSignUp={() => flow.setGate("signup")}
        onUpgrade={() => navigate("/pricing")}
        onLookAround={() => flow.setTab("build")}
        onStart={() => { if (mode !== "single") flow.changeMode("single"); flow.setTab("build"); }}
      />
    );
  }

  return (
    <>
      <div className="flex min-h-full w-full flex-col bg-[#0B0D0F] lg:h-full lg:flex-row lg:gap-3 lg:overflow-hidden lg:p-3">
        {/* Mobile: the sticky Build / result tab bar. */}
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
      <PlansDialog
        open={plansOpen}
        onClose={() => { flow.setUpgradeTier(null); if (flow.gate === "plan") flow.setGate(null); }}
        tierId={plansTier.current}
        planCode={account.planCode}
      />
      <NoCreditsModal
        open={Boolean(flow.noCredits)}
        onClose={() => flow.setNoCredits(null)}
        creditsNeeded={flow.noCredits?.needed ?? 0}
        creditBalance={account.balance}
        variant="lime"
      />
      {/* A signed-out visitor pressed a button that makes or continues something: the app's own sign-up popup. */}
      {flow.gate === "signup" && (
        <AuthModal
          mode="signup"
          title="Sign up to create your own"
          subtitle="Free to join. Your Blocky story is a few minutes away."
          returnTo={BLOCKY_STORIES_PATH}
          onClose={() => flow.setGate(null)}
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

