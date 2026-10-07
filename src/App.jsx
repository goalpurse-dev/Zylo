import { USE_LEGACY_HOME } from "./data/homeContent";
import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  StaticRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
// StaticRouter is only ever instantiated when import.meta.env.SSR is true —
// i.e. only inside the build-time SEO HTML generator (scripts/generateSeoHtml.js),
// never in the real client bundle. Vite statically resolves import.meta.env.SSR
// to `false` for every normal build, so this whole branch is dead code there
// and gets tree-shaken out — real users always get exactly the same
// BrowserRouter they always did.
const Router = import.meta.env.SSR ? StaticRouter : BrowserRouter;

import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import { Toaster } from "sonner";
import ResumeCheckout from "./components/billing/ResumeCheckout.jsx";
import PasswordRecoveryRedirect from "./components/auth/PasswordRecoveryRedirect.jsx";
import LongFormScriptReadyNotifier from "./components/LongFormScriptReadyNotifier";
import AIFruitStory from "./pages/workspace/AIFruitStory";
import SkeletonShorts from "./pages/workspace/SkeletonShorts";

// pages…
//import Home from "./pages/Home";

const Pricing = lazy(() => import("./pages/Pricing"));
// 🔥 LAZY LOAD THESE
const Settings = lazy(() => import("./pages/settings/WorkspaceSettings"));

const SupportLayout = lazy(() => import("./pages/support/SupportLayout"));
const SupportHome = lazy(() => import("./pages/support/SupportHome"));
const SupportArticle = lazy(() => import("./pages/support/SupportArticle"));
const SupportPolicies = lazy(() => import("./pages/support/SupportPolicies"));
const SupportPolicyArticle = lazy(() => import("./pages/support/SupportPolicyArticle"));
const SupportContact = lazy(() => import("./pages/support/SupportContact"));

const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const Forgot = lazy(() => import("./pages/tools/Forgot"));
const Reset = lazy(() => import("./pages/tools/Reset"));
const AuthConfirm = lazy(() => import("./pages/auth/Confirm.jsx"));

const AuthCallback = lazy(() => import("./pages/auth/AuthCallback"));

const BillingSuccess = lazy(() => import("./pages/billing/Success.jsx"));
const BillingCancel = lazy(() => import("./pages/billing/Cancel.jsx"));

const HelpCenter = lazy(() => import("./pages/help/HelpCenter"));
const Feedback = lazy(() => import("./pages/help/Feedback"));
const FeedbackAnalytics = lazy(() => import("./pages/admin/FeedbackAnalytics"));
const OpsPage = lazy(() => import("./pages/admin/Ops"));
const TextToVoice = lazy(() => import("./pages/tools/TextToVoice"));

// already lazy
const Workspace = lazy(() => import("./pages/workspace/home.jsx"));
const HomeV2 = lazy(() => import("./pages/workspace/HomeV2.jsx"));
// Previous Home, kept for one release behind src/data/homeContent.js.

// 🔥 ALSO lazy these workspace pages (important for performance)
const WorkspaceLayout = lazy(() => import("./pages/workspace/layout.jsx"));
const Creations = lazy(() => import("./pages/workspace/creations.jsx"));

const ImageGenTest = lazy(() => import("./pages/image-gen-test.jsx"));
import { GenerationsProvider } from "./components/GenerationsDock";


// blogs

const BlogIndex = lazy(() => import("./app/blog/BlogIndex"));
const BlogCategoryPage = lazy(() => import("./app/blog/BlogCategoryPage"));

{/* Product Photo Blogs */}
const ProductPhotosShopify = lazy(() => import("./app/blog/ProductPhotosShopify"));
const ProductPhotosForShopify = lazy(() => import("./app/blog/productphotos/Forshopifystores.jsx"));
const AiIncreaseRates = lazy(() => import("./app/blog/productphotos/AIroductIncreaseRates.jsx"));
const BestAiToolsEcommerce = lazy(() => import("./app/blog/productphotos/BestAiToolsEcommerce.jsx"));
const ShopifyProductPhotoBestPractices = lazy(() => import("./app/blog/productphotos/ShopifyProductPhotoBestPractices.jsx"));
const AiVsTraditional = lazy(() => import("./app/blog/productphotos/ai-vs-traditional-product-photography.jsx"));
const WhyProductPhotosMatter = lazy(() => import("./app/blog/productphotos/WhyProductPhotosMatter.jsx"));
const BestAiProductBgToUse = lazy(() => import("./app/blog/productphotos/BestAiProductBgToUse.jsx"));
const HowImproveEcommerceVisualTrust = lazy(() => import("./app/blog/productphotos/HowImproveEcommerceVisualTrust.jsx"));
const ProductPhotographyMistakesEcommerce = lazy(() => import("./app/blog/productphotos/ProductPhotographyMistakesEcommerce.jsx"));
const HowVisualBrandingImpactsOnlineSales = lazy(() => import("./app/blog/productphotos/HowVisualBrandingImpactsOnlineSales.jsx"));
const AIBackgroundRemovalForProductPhotos = lazy(() => import("./app/blog/productphotos/AIBackgroundRemovalForProductPhotos.jsx"));
const ScaleEcommerceContent = lazy(() => import("./app/blog/productphotos/ScaleEcommerceContent.jsx"));
const ConvertingProductImagesForShopify = lazy(() => import("./app/blog/productphotos/ConvertingProductImagesForShopify.jsx"));
const AIProductPhotoForSmallBusiness = lazy(() => import("./app/blog/productphotos/AIProductPhotoForSmallBusiness.jsx"));
const HowBetterImagesReduceBounceRate = lazy(() => import("./app/blog/productphotos/HowBetterImagesReduceBounceRate.jsx"));
const EcommerceVisualConsistencyExplained = lazy(() => import("./app/blog/productphotos/EcommerceVisualConsistencyExplained.jsx"));
const AiProductPhotosForDropshipping = lazy(() => import("./app/blog/productphotos/AiProductPhotosForDropshipping.jsx"));
const HowVisualQualityImpactsSeo = lazy(() => import("./app/blog/productphotos/HowVisualQualityImpactsSeo.jsx"));
const ProductImagesThatConverGuide = lazy(() => import("./app/blog/productphotos/ProductImagesThatConvertGuide.jsx"));
const AiToolsEveryShopifyStoreOwnerKnow = lazy(() => import("./app/blog/productphotos/Ai-Tools-Every-Shopify-Store-Owner-Know.jsx"));
const HowToLaunchProductsFasterWithAi = lazy(() => import("./app/blog/productphotos/HowToLaunchProductsFasyerWithAi.jsx"));
const StudioQualityProductPhotos = lazy(() => import("./app/blog/productphotos/StudioQualityProductPhotos.jsx"));
const WhyCleanProductPhotoBuildTrust = lazy(() => import("./app/blog/productphotos/WhyCleanProductPhotosBuildTrust.jsx"));
const VisualOptimizationForMobielEcommerce = lazy(() => import("./app/blog/productphotos/VisualOptimizationForMobileEcommerce.jsx"));
const HowAiHelpsEcommerceBrandsScaleFaster = lazy(() => import("./app/blog/productphotos/HowAIHelpsEcommerceBrandsScaleFaster.jsx"));
const ProductPhotographyTrendsForEcommerce = lazy(() => import("./app/blog/productphotos/ProductPhotographyTrendsForEcommerce.jsx"));
const AIProductPhotosForFashionStores = lazy(() => import("./app/blog/productphotos/AIProductPhotosForFashionStores.jsx"));
const AIProductPhotosForBeatyAndSkincare = lazy(() => import("./app/blog/productphotos/AIProductPhotosForBeautyAndSkincare.jsx"));
const HowVisualBrandingSeperatesWinnersFromLosers = lazy(() => import("./app/blog/productphotos/HowVisualBrandingSeparatesWinnersFromLosers.jsx"));
const ViralAiImagesTiktok = lazy(() => import("./app/blog/imagegenerator/ViralAiImagesTikTok.jsx"));
const CreatorsBlowingUpWithAi = lazy(() => import("./app/blog/imagegenerator/CreatorsBlowingUpWithAI.jsx"));
const ITestViralPromts = lazy(() => import("./app/blog/imagegenerator/ITestViralAIPrompts.jsx"));
const AllImageStylesEveryoneObsessedWith = lazy(() => import("./app/blog/imagegenerator/AIImageStylesEveryoneObsessedWith.jsx"));
const ScrollStoppingIMagesNoDesign = lazy(() => import("./app/blog/imagegenerator/ScrollStoppingImagesNoDesign.jsx"));
const WhyAIImagesOutperformRealPhotos = lazy(() => import("./app/blog/imagegenerator/WhyAIImagesOutperformRealPhotos.jsx"));
const TheSecretPromptsBehindViralAIImages = lazy(() => import("./app/blog/imagegenerator/TheSecretPromptsBehindViralAIImages.jsx"));
const TurnAnyIdeaIntoViralImage = lazy(() => import("./app/blog/imagegenerator/TurnAnyIdeaIntoViralImage.jsx"));
const AllImageTrendsYouNeedTojumpOn = lazy(() => import("./app/blog/imagegenerator/AIImageTrendsYouNeedToJumpOn.jsx"));
const WhyYourPostsDontGoViral = lazy(() => import("./app/blog/imagegenerator/WhyYourPostsDontGoViral.jsx"));
const BestAIImageGeneratorForSocialMedia = lazy(() => import("./app/blog/imagegenerator/BestAIImageGeneratorForSocialMedia.jsx"));
const GenerateHighQualityImagesWithAI = lazy(() => import("./app/blog/imagegenerator/GenerateHighQualityImagesWithAI.jsx"));
const AIImageGeneratorBeginnersGuide2026 = lazy(() => import("./app/blog/imagegenerator/AIImageGeneratorBeginnersGuide2026.jsx"));
const CreateProfessionalImagesWithAI = lazy(() => import("./app/blog/imagegenerator/CreateProfessionalImagesWithAI.jsx"));
const AIImageGeneratorVsTraditionalDesign = lazy(() => import("./app/blog/imagegenerator/AIImageGeneratorVsTraditionalDesign.jsx"));
const TopAIImageGeneratorFeaturesThatMatter = lazy(() => import("./app/blog/imagegenerator/TopAIImageGeneratorFeaturesThatMatter.jsx"));
const HowtoGenerateImagesforAdsUsingAI = lazy(() => import("./app/blog/imagegenerator/GenerateImagesForAdsUsingAI.jsx"));
const AIImageGeneratorForContentCreators = lazy(() => import("./app/blog/imagegenerator/AIImageGeneratorForContentCreators.jsx"));
const HowAIImageGeneratorsWork = lazy(() => import("./app/blog/imagegenerator/HowAIImageGeneratorsWork.jsx"));
const IsAIImageGenerationWorthItForCreators = lazy(() => import("./app/blog/imagegenerator/IsAIImageGenerationWorthItForCreators.jsx"));
const TopAIImageStylesThatGoViralOnSocialMedia = lazy(() => import("./app/blog/imagegenerator/TopAIImageStylesThatGoViralOnSocialMedia.jsx"));
const HowToCreateMinimalistImagesUsingAI = lazy(() => import("./app/blog/imagegenerator/HowtoCreateMinimalistImagesUsingAI.jsx"));
const HowToCreateMovieStyleVisuals = lazy(() => import("./app/blog/imagegenerator/HowtoCreateMovieStyleVisuals.jsx"));
const Why3dAIImagesPerform = lazy(() => import("./app/blog/imagegenerator/why3daiimagesperform.jsx"));
const HowtoGenerateAestheticImagesWithAI = lazy(() => import("./app/blog/imagegenerator/HowtoGenerateAestheticImagesWithAI.jsx"));
const WhichAIImageStyleWorksBest = lazy(() => import("./app/blog/imagegenerator/whichaiimagestyleworksbest.jsx"));
const LuxuryAIImages = lazy(() => import("./app/blog/imagegenerator/how-to-create-luxury-ai-images.jsx"));
const DarkMoodyCinematicImages = lazy(() => import("./app/blog/imagegenerator/ai-dark-moody-cinematic-images.jsx"));
const AIProductPhotography = lazy(() => import("./app/blog/imagegenerator/ai-product-photography-high-end.jsx"));
const VisualStylesAI = lazy(() => import("./app/blog/imagegenerator/ai-visual-styles-most-engagement.jsx"));
const HowToGoViralWithAI = lazy(() => import("./app/blog/imagegenerator/HowToGoViralWithAI.jsx"));
const AIVideoNewViralCurrency = lazy(() => import("./app/blog/imagegenerator/AIVideoNewViralCurrency.jsx"));
const AIProductPhotoGenerator = lazy(() => import("./app/blog/productphotos/AIProductPhotoGenerator.jsx"));
const ZyvoVsMidjourneyProductPhotos = lazy(() => import("./app/blog/productphotos/ZyvoVsMidjourneyProductPhotos.jsx"));
const FreeAIImageGenerator = lazy(() => import("./app/blog/imagegenerator/free-ai-image-generator.jsx"));
const FreeViralAITool = lazy(() => import("./app/blog/imagegenerator/free-viral-ai-tool.jsx"));
const HowToWriteAViralScript = lazy(() => import("./app/blog/imagegenerator/how-to-write-a-viral-script.jsx"));
const AIScriptGeneratorViralVideos = lazy(() => import("./app/blog/imagegenerator/ai-script-generator-viral-videos.jsx"));
const AIVideoGeneratorTikTokReels = lazy(() => import("./app/blog/imagegenerator/ai-video-generator-tiktok-reels.jsx"));
const HowToCreateViralAIVideos = lazy(() => import("./app/blog/imagegenerator/how-to-create-viral-ai-videos.jsx"));
const HowToMakeViralAITikTokVideos = lazy(() => import("./app/blog/imagegenerator/how-to-make-viral-ai-tiktok-videos.jsx"));
const BestAIToolsFacelessTikTokVideos = lazy(() => import("./app/blog/imagegenerator/best-ai-tools-faceless-tiktok-videos.jsx"));
const AIContentCreationToolsInstagram = lazy(() => import("./app/blog/imagegenerator/ai-content-creation-tools-instagram-viral.jsx"));
const BestAIImageGeneratorsSocialMedia2026 = lazy(() => import("./app/blog/imagegenerator/best-ai-image-generators-social-media-2026.jsx"));
const ViralAIFruitDramaVideos = lazy(() => import("./app/blog/imagegenerator/viral-ai-fruit-drama-videos.jsx"));
const HowToGoViralTikTokFruitDrama = lazy(() => import("./app/blog/imagegenerator/how-to-go-viral-tiktok-fruit-drama.jsx"));
const BestAIFruitStoryIdeas = lazy(() => import("./app/blog/imagegenerator/best-ai-fruit-story-ideas.jsx"));
const AIFruitStoryTalkingDialogueTips = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-talking-dialogue-tips.jsx"));
const AIFruitStoryVsTraditionalAnimation = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-vs-traditional-animation.jsx"));
const AIFruitStoryPromptFormula = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-prompt-formula.jsx"));
const AIFruitStoryInstagramYouTubeShorts = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-instagram-youtube-shorts.jsx"));
const AIFruitStoryPlotTwists = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-plot-twists.jsx"));
const AIFruitStoryMistakes = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-mistakes.jsx"));
const AIFruitStoryDramaTierList = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-drama-tier-list.jsx"));
const AIFruitStoryCraziestGeneration = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-craziest-generation.jsx"));
const WhatIsAIFruitStory = lazy(() => import("./app/blog/imagegenerator/what-is-ai-fruit-story.jsx"));
const AIFruitStoryExamples = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-examples.jsx"));
const AIFruitStoryPricing = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-pricing.jsx"));
const AIImageGeneratorPromptFormula = lazy(() => import("./app/blog/imagegenerator/ai-image-generator-prompt-formula.jsx"));
const AIImageGeneratorExamples = lazy(() => import("./app/blog/imagegenerator/ai-image-generator-examples.jsx"));
const SkeletonXrayAiTrend = lazy(() => import("./app/blog/imagegenerator/skeleton-xray-ai-trend.jsx"));
const HiddenAiImageStyles = lazy(() => import("./app/blog/imagegenerator/hidden-ai-image-styles.jsx"));
const MinecraftStyleAiImages = lazy(() => import("./app/blog/imagegenerator/voxel-style-ai-images.jsx"));
const NoirVsCyberpunkAiImages = lazy(() => import("./app/blog/imagegenerator/noir-vs-cyberpunk-ai-images.jsx"));
const DisneyVsGhibliAiImages = lazy(() => import("./app/blog/imagegenerator/classic-3d-vs-hand-painted-anime-images.jsx"));
const AIFruitStoryCliffhangers = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-cliffhangers.jsx"));
const AIFruitStoryHalloween = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-halloween.jsx"));
const AIFruitStoryFinaleIdeas = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-finale-ideas.jsx"));
const AIFruitStoryVs2amWorlds = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-vs-2am-worlds.jsx"));
const AIFruitStoryCharacterNames = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-character-names.jsx"));
const AIImageGeneratorMistakes = lazy(() => import("./app/blog/imagegenerator/ai-image-generator-mistakes.jsx"));
const WhatIsMicroCameraAnimal = lazy(() => import("./app/blog/imagegenerator/what-is-micro-camera-animal.jsx"));
const MicroCameraAnimalVideoIdeas = lazy(() => import("./app/blog/imagegenerator/micro-camera-animal-video-ideas.jsx"));
const WhatIsClayRescue = lazy(() => import("./app/blog/imagegenerator/what-is-clay-rescue.jsx"));
const WhatIsFaceAsmr = lazy(() => import("./app/blog/imagegenerator/what-is-face-asmr.jsx"));
const WhatIsZyvo = lazy(() => import("./app/blog/imagegenerator/what-is-zyvo.jsx"));
const IsZyvoFree = lazy(() => import("./app/blog/imagegenerator/is-zyvo-free.jsx"));
const HowToGetStartedWithZyvo = lazy(() => import("./app/blog/imagegenerator/how-to-get-started-with-zyvo.jsx"));
const ZyvoVsOtherAiTools = lazy(() => import("./app/blog/imagegenerator/zyvo-vs-other-ai-tools.jsx"));
const ClayRescueVideoIdeas = lazy(() => import("./app/blog/imagegenerator/clay-rescue-video-ideas.jsx"));
const ClayRescueMistakes = lazy(() => import("./app/blog/imagegenerator/clay-rescue-mistakes.jsx"));
const MicroCameraAnimalMistakes = lazy(() => import("./app/blog/imagegenerator/micro-camera-animal-mistakes.jsx"));
const FaceAsmrMistakes = lazy(() => import("./app/blog/imagegenerator/face-asmr-mistakes.jsx"));
const CartoonDriveByMistakes = lazy(() => import("./app/blog/imagegenerator/cartoon-drive-by-mistakes.jsx"));
const FootballerNationalitySwapIdeas = lazy(() => import("./app/blog/imagegenerator/kit-swap-ideas.jsx"));
const WhichZyvoTemplate = lazy(() => import("./app/blog/imagegenerator/which-zyvo-template.jsx"));
const ClayRescueSeries = lazy(() => import("./app/blog/imagegenerator/clay-rescue-series.jsx"));
const MicroCameraAnimalSeries = lazy(() => import("./app/blog/imagegenerator/micro-camera-animal-series.jsx"));
const CartoonDriveByVs2amWorlds = lazy(() => import("./app/blog/imagegenerator/cartoon-drive-by-vs-2am-worlds.jsx"));
const FootballerNationalitySwapTime = lazy(() => import("./app/blog/imagegenerator/kit-swap-time.jsx"));
const FaceAsmrPrivacy = lazy(() => import("./app/blog/imagegenerator/face-asmr-privacy.jsx"));
const WhatIsZyvoPublish = lazy(() => import("./app/blog/imagegenerator/what-is-zyvo-publish.jsx"));
const WhatIsZyvoStats = lazy(() => import("./app/blog/imagegenerator/what-is-zyvo-stats.jsx"));
const WhatIsZyvoConnections = lazy(() => import("./app/blog/imagegenerator/what-is-zyvo-connections.jsx"));
const ZyvoContentWorkflow = lazy(() => import("./app/blog/imagegenerator/zyvo-content-workflow.jsx"));
const ZyvoTemplateComparison = lazy(() => import("./app/blog/imagegenerator/zyvo-template-comparison.jsx"));
const BestTimeToPostAiContent = lazy(() => import("./app/blog/imagegenerator/best-time-to-post-ai-content.jsx"));
const AiContentHooksCaptionsThatGoViral = lazy(() => import("./app/blog/imagegenerator/ai-content-hooks-captions-that-go-viral.jsx"));
const CartoonDriveByExplained = lazy(() => import("./app/blog/imagegenerator/cartoon-drive-by-explained.jsx"));
const CartoonDriveByVideoIdeas = lazy(() => import("./app/blog/imagegenerator/cartoon-drive-by-video-ideas.jsx"));
const FootballerNationalitySwapExplained = lazy(() => import("./app/blog/imagegenerator/kit-swap-explained.jsx"));
const FootballerNationalitySwapTips = lazy(() => import("./app/blog/imagegenerator/kit-swap-tips.jsx"));
const FootballerNationalitySwapMistakes = lazy(() => import("./app/blog/imagegenerator/kit-swap-mistakes.jsx"));
const FootballerNationalitySwapSeries = lazy(() => import("./app/blog/imagegenerator/kit-swap-series.jsx"));
const ViralScore = lazy(() => import("./pages/viral/ViralScore.jsx"));
// Lip Sync is hidden for now: it runs on fal, that account is locked, and the tool has never had a job.
// To bring it back, restore this import and the /workspace/lip-sync route below.
// const LipSync = lazy(() => import("./pages/viral/LipSync.jsx"));


import ScrollToTop from "./components/ScrollToTop";
import CookieConsent from "./components/CookieConsent";
import EmailConsentModal from "./components/EmailConsentModal";
import WelcomeModal from "./components/WelcomeModal";
import { supabase } from "./lib/supabaseClient";
import NotFoundRedirect from "./components/NotFoundRedirect";
import PublicContentLayout from "./components/seo/PublicContentLayout.jsx";
import { STICKMAN_LANDING_PAGES } from "./data/stickmanLandingPages.js";
// Not lazy: this page is hydrated (src/main.jsx). A lazy route would leave its
// Suspense boundary waiting for the chunk, and any state update in that gap
// makes React drop the server HTML and redraw the page.
import StickmanVideoLanding from "./pages/landing/StickmanVideoLanding.jsx";
import WorkspaceRouteSeo from "./components/seo/WorkspaceRouteSeo.jsx";
import { clearRouteReloadAttempt, lazyRoute } from "./lib/lazyRouteRecovery.js";
import PublicGallery from "./components/public-gallery/gallery";
const AIFruitStoryLanding = lazy(() => import("./pages/landing/AIFruitStoryLanding.jsx"));
const ImageGeneratorLanding = lazy(() => import("./pages/landing/ImageGeneratorLanding.jsx"));
const CartoonDriveByLanding = lazy(() => import("./pages/landing/CartoonDriveByLanding.jsx"));
const FootballerNationalitySwapLanding = lazy(() => import("./pages/landing/FootballerNationalitySwapLanding.jsx"));
const BehindTheScenesLanding = lazy(() => import("./pages/landing/BehindTheScenesLanding.jsx"));
const ThirtyDaysLanding = lazy(() => import("./pages/landing/ThirtyDaysLanding.jsx"));
const ThirtyDaysSeriesLanding = lazy(() => import("./pages/landing/ThirtyDaysSeriesLanding.jsx"));
const WhatIs30DaysAiTrend = lazy(() => import("./app/blog/imagegenerator/what-is-30-days-ai-trend.jsx"));
const ThirtyDaysUniverseIdeas = lazy(() => import("./app/blog/imagegenerator/30-days-universe-ideas.jsx"));
const ThirtyDaysVideoSeries = lazy(() => import("./app/blog/imagegenerator/30-days-video-series.jsx"));
const ThirtyDaysMistakes = lazy(() => import("./app/blog/imagegenerator/30-days-mistakes.jsx"));
const ThirtyDaysVsAiFruitStory = lazy(() => import("./app/blog/imagegenerator/30-days-vs-ai-fruit-story.jsx"));
const ThirtyDaysTime = lazy(() => import("./app/blog/imagegenerator/30-days-time.jsx"));
const ThirtyDaysQualityTiers = lazy(() => import("./app/blog/imagegenerator/30-days-quality-tiers.jsx"));
const ThirtyDaysPremiseFormula = lazy(() => import("./app/blog/imagegenerator/30-days-premise-formula.jsx"));
const ThirtyDaysHalloweenSpecial = lazy(() => import("./app/blog/imagegenerator/30-days-halloween-special.jsx"));
const Is30DaysWorthIt = lazy(() => import("./app/blog/imagegenerator/is-30-days-worth-it.jsx"));
const WhatIs30DaysSeriesMode = lazy(() => import("./app/blog/imagegenerator/what-is-30-days-series-mode.jsx"));
const ThirtyDaysSeriesWorldBibleExplained = lazy(() => import("./app/blog/imagegenerator/30-days-series-world-bible-explained.jsx"));
const ThirtyDaysSeriesDaysPerEpisode = lazy(() => import("./app/blog/imagegenerator/30-days-series-days-per-episode.jsx"));
const ThirtyDaysSeriesVsSingleVideo = lazy(() => import("./app/blog/imagegenerator/30-days-series-vs-single-video.jsx"));
const ThirtyDaysSeriesCliffhangers = lazy(() => import("./app/blog/imagegenerator/30-days-series-cliffhangers.jsx"));
const ThirtyDaysCameraMode = lazy(() => import("./app/blog/imagegenerator/30-days-camera-mode.jsx"));
const ThirtyDaysCharacterConsistency = lazy(() => import("./app/blog/imagegenerator/30-days-character-consistency.jsx"));
const ThirtyDaysSceneContinuity = lazy(() => import("./app/blog/imagegenerator/30-days-scene-continuity.jsx"));
const ThirtyDaysVoiceoverSync = lazy(() => import("./app/blog/imagegenerator/30-days-voiceover-sync.jsx"));
const ThirtyDaysSeriesDashboardTour = lazy(() => import("./app/blog/imagegenerator/30-days-series-dashboard-tour.jsx"));
const BehindTheScenesTrendExplained = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-trend-explained.jsx"));
const BehindTheScenesHowItsMade = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-how-its-made.jsx"));
const BehindTheScenesVideoIdeas = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-video-ideas.jsx"));
const BehindTheScenesCameraVantage = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-camera-vantage.jsx"));
const BehindTheScenesSeries = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-series.jsx"));
const WhatsHotRightNowAiTrends = lazy(() => import("./app/blog/imagegenerator/whats-hot-right-now-ai-trends.jsx"));
const HowToSpotViralAiTrend = lazy(() => import("./app/blog/imagegenerator/how-to-spot-viral-ai-trend.jsx"));
const ImperfectAiVideosWinning = lazy(() => import("./app/blog/imagegenerator/imperfect-ai-videos-winning.jsx"));
const BehindTheScenesDisasterTypes = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-disaster-types.jsx"));
const BehindTheScenesMistakes = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-mistakes.jsx"));
const BehindTheScenesExtendedModules = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-extended-modules.jsx"));
const BehindTheScenesVsClayRescue = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-vs-clay-rescue.jsx"));
const BehindTheScenesVsMicroCameraAnimal = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-vs-micro-camera-animal.jsx"));
const BehindTheScenesTime = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-time.jsx"));
const BehindTheScenesTierList = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-tier-list.jsx"));
const BehindTheScenesHalloween = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-halloween.jsx"));
const BehindTheScenesIsItReal = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-is-it-real.jsx"));
const BehindTheScenesBeginnersGuide = lazy(() => import("./app/blog/imagegenerator/behind-the-scenes-beginners-guide.jsx"));
const EveryZyvoVideoFormatCompared = lazy(() => import("./app/blog/imagegenerator/every-zyvo-video-format-compared.jsx"));
const ClayRescueVsMicroCameraAnimal = lazy(() => import("./app/blog/imagegenerator/clay-rescue-vs-micro-camera-animal.jsx"));
const FruitStoryVsFootballerNationalitySwap = lazy(() => import("./app/blog/imagegenerator/fruit-story-vs-kit-swap.jsx"));
const MultiFormatWeeklyCalendar = lazy(() => import("./app/blog/imagegenerator/multi-format-weekly-calendar.jsx"));
const CrossPromoteZyvoFormats = lazy(() => import("./app/blog/imagegenerator/cross-promote-zyvo-formats.jsx"));
const FaceAsmrLanding = lazy(() => import("./pages/landing/FaceAsmrLanding.jsx"));
const MicroCameraAnimalLanding = lazy(() => import("./pages/landing/MicroCameraAnimalLanding.jsx"));
const ClayRescueLanding = lazy(() => import("./pages/landing/ClayRescueLanding.jsx"));
const PublishLanding = lazy(() => import("./pages/landing/PublishLanding.jsx"));
const StatsLanding = lazy(() => import("./pages/landing/StatsLanding.jsx"));
const ConnectionsLanding = lazy(() => import("./pages/landing/ConnectionsLanding.jsx"));
const CreatorGrowthGuide = lazy(() => import("./app/blog/CreatorGrowthGuide.jsx"));
const SeoLandingPage = lazy(() => import("./pages/seo/SeoLandingPage.jsx"));
const TwoAmBlogGuide = lazy(() => import("./app/blog/TwoAmBlogGuide.jsx"));
const FaceAsmrMakerBlog = lazy(() => import("./app/blog/imagegenerator/face-asmr-maker.jsx"));
const ViralFaceAsmrVideos = lazy(() => import("./app/blog/imagegenerator/viral-face-asmr-videos.jsx"));
const AsmrVideoIdeasTiktok = lazy(() => import("./app/blog/imagegenerator/asmr-video-ideas-tiktok-2026.jsx"));
const HowToStartAsmrChannel = lazy(() => import("./app/blog/imagegenerator/how-to-start-asmr-channel-with-ai.jsx"));
const BestFaceAsmrVideoIdeas = lazy(() => import("./app/blog/imagegenerator/best-face-asmr-video-ideas-2026.jsx"));
const MicroCameraAnimalMakerBlog = lazy(() => import("./app/blog/imagegenerator/micro-camera-animal-maker.jsx"));
const ViralAnimalBodycamVideos = lazy(() => import("./app/blog/imagegenerator/viral-animal-bodycam-videos.jsx"));
const ClayRescueMakerBlog = lazy(() => import("./app/blog/imagegenerator/clay-rescue-ai-video-maker.jsx"));
const GiantHandRescueVideosBlog = lazy(() => import("./app/blog/imagegenerator/why-giant-hand-rescue-videos-go-viral.jsx"));
const AIFruitStoryCharacterIdeas = lazy(() => import("./app/blog/imagegenerator/ai-fruit-story-character-ideas.jsx"));
const BestAiVideoGeneratorsTiktok = lazy(() => import("./app/blog/imagegenerator/best-ai-video-generators-tiktok.jsx"));
const BestFreeAiToolsCreators = lazy(() => import("./app/blog/imagegenerator/best-free-ai-tools-creators.jsx"));
const HowToMakeMoneyAiContent = lazy(() => import("./app/blog/imagegenerator/how-to-make-money-ai-content.jsx"));
const IsAiContentWorthIt = lazy(() => import("./app/blog/imagegenerator/is-ai-content-worth-it.jsx"));
const VerticalVideoFormatsGuide = lazy(() => import("./app/blog/imagegenerator/vertical-video-formats-guide.jsx"));
const CartoonDriveBySeries = lazy(() => import("./app/blog/imagegenerator/cartoon-drive-by-series.jsx"));
const TiktokAlgorithmExplained = lazy(() => import("./app/blog/imagegenerator/tiktok-algorithm-explained.jsx"));
const InstagramReelsAlgorithmExplained = lazy(() => import("./app/blog/imagegenerator/instagram-reels-algorithm-explained.jsx"));
const ContentSlumpRecovery = lazy(() => import("./app/blog/imagegenerator/content-slump-recovery.jsx"));
const HowOftenShouldYouPost = lazy(() => import("./app/blog/imagegenerator/how-often-should-you-post.jsx"));
const RepurposeOneVideoTenPieces = lazy(() => import("./app/blog/imagegenerator/repurpose-one-video-ten-pieces.jsx"));
const FacelessYoutubeChannelIdeas = lazy(() => import("./app/blog/imagegenerator/faceless-youtube-channel-ideas.jsx"));
const ScheduleAutoPublishAIVideosBlog = lazy(() => import("./app/blog/imagegenerator/schedule-auto-publish-ai-videos.jsx"));
const OneClickPublishingPlaybookBlog = lazy(() => import("./app/blog/imagegenerator/one-click-publishing-playbook.jsx"));
{/* Viral */}


const Image = lazy(() => import("./pages/viral/Image.jsx"));
const Video = lazy(() => import("./pages/viral/video-generator.jsx"));
const Script = lazy(() => import("./pages/viral/ScriptBuilder.jsx"));






import { Analytics } from "@vercel/analytics/react";






import AuthCallbackPage from "./pages/AuthCallback.jsx";
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.jsx"));
const FaceAsmrPage           = lazy(() => import("./pages/workspace/FaceAsmr.jsx"));
const MicroCameraAnimalPage  = lazy(() => import("./pages/workspace/MicroCameraAnimal.jsx"));
const ClayRescuePage         = lazy(() => import("./pages/workspace/ClayRescue.jsx"));
const AICookingMaticPage     = lazy(() => import("./pages/workspace/AICookingMatic.jsx"));
const FootballerNationalitySwapPage = lazy(() => import("./pages/workspace/FootballerNationalitySwap.jsx"));
const TwoAmPage               = lazy(() => import("./pages/workspace/TwoAm.jsx"));
const ThirtyDaysPage          = lazy(() => import("./pages/workspace/ThirtyDays.jsx"));
const CartoonDriveByPage       = lazy(() => import("./pages/workspace/CartoonDriveBy.jsx"));
const BehindTheScenesPage      = lazy(() => import("./pages/workspace/BehindTheScenes.jsx"));
const PublishPage            = lazy(() => import("./pages/workspace/publish.jsx"));
const StatsPage              = lazy(() => import("./pages/workspace/stats.jsx"));
const ConnectionsPage        = lazy(() => import("./pages/workspace/connections.jsx"));
const EarnPage                = lazy(() => import("./pages/workspace/earn/index.jsx"));
const LongFormPage            = lazy(() => import("./pages/workspace/long-form/index.jsx"));
const LongFormNewPage         = lazy(() => import("./pages/workspace/long-form/new.jsx"));
const LongFormStoryPage       = lazy(() => import("./pages/workspace/long-form/story.jsx"));
const LongFormResearchPage    = lazy(() => import("./pages/workspace/long-form/research.jsx"));
const LongFormScriptPage      = lazy(() => import("./pages/workspace/long-form/script.jsx"));
const LongFormLookPage        = lazy(() => import("./pages/workspace/long-form/look.jsx"));
const LongFormVisualWorldPage = lazy(() => import("./pages/workspace/long-form/visualWorld.jsx"));
const LongFormNarrationPage   = lazy(() => import("./pages/workspace/long-form/narration.jsx"));
const LongFormVisualsPage     = lazy(() => import("./pages/workspace/long-form/visuals.jsx"));
// Phase 6a — Stickman: one continuous "Writing your script" screen + the Script review.
const LongFormWritingPage      = lazy(() => import("./pages/workspace/long-form/writing.jsx"));
const LongFormScenesPage       = lazy(() => import("./pages/workspace/long-form/scenes.jsx"));
const StickmanRouteGuard       = lazy(() => import("./pages/workspace/long-form/StickmanRouteGuard.jsx"));
const LongFormEditPage         = lazy(() => import("./pages/workspace/long-form/edit.jsx"));
const LongFormGeneratingPage   = lazy(() => import("./pages/workspace/long-form/generating.jsx"));
const LongFormIdeaPage         = lazy(() => import("./pages/workspace/long-form/idea.jsx"));
const LongFormPublishPage      = lazy(() => import("./pages/workspace/long-form/publish.jsx"));
const LongFormScriptReviewPage = lazy(() => import("./pages/workspace/long-form/scriptReview.jsx"));
const LongFormProductionSetupPage = lazy(() => import("./pages/workspace/long-form/ProductionSetup.jsx"));
const LongFormTeaserPage = lazy(() => import("./pages/workspace/long-form/teaser.jsx"));
const LongFormGeneratePage    = lazyRoute(() => import("./pages/workspace/long-form/generate.jsx"), "long-form-generate");

import "./styles/sand.css";

/* ---------------- Route guards ---------------- */
function RequireAuth({ children }) {
  const { loading, user } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
function OldHomeRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/", search, hash }} replace />;
}

// /workspace/pricing is the old address of /pricing (301 in vercel.json; this
// client redirect covers in-app navigation to it). Keeps ?utm_… and #hash.
function OldPricingRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/pricing", search, hash }} replace />;
}

function GuestOnly({ children }) {
  const { loading, user } = useAuth();

  if (loading) return null; // or spinner, NOT empty div

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

class LongFormGenerateRouteBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    console.error("[long-form-generate] route failed to load", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const retry = () => {
      clearRouteReloadAttempt("long-form-generate");
      window.location.reload();
    };
    const back = () => {
      window.history.pushState({}, "", "/long-form");
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#080b09] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d120f] p-7 text-center shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">Scenes</p>
          <h1 className="mt-3 text-2xl font-semibold">We couldn't open this page</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">The page module could not be loaded. Your project and generation state are still saved.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={retry} className="rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-semibold text-black">Try Again</button>
            <button type="button" onClick={back} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white">Back to Long Form</button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App({ ssrPath } = {}) {
 const routerProps = import.meta.env.SSR ? { location: ssrPath } : {};
 return (
<AuthProvider>
  <Router {...routerProps}>
   <ScrollToTop /> {/* 🔥 THIS LINE */}

    <GenerationsProvider>
      <AppWithRouting />
    </GenerationsProvider>
  </Router>
</AuthProvider>
  );
}

function AppWithRouting() {
  const location = useLocation();
  const { user } = useAuth();
const [profile, setProfile] = React.useState(null);
const [showOnboarding, setShowOnboarding] = React.useState(false);
const [showWelcomeNotif, setShowWelcomeNotif] = React.useState(false);
const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);

// WelcomeModal via zyvo_show_welcome flag disabled — WelcomeScreen in layout.jsx handles this
// React.useEffect(() => {
//   if (localStorage.getItem("zyvo_show_welcome") === "1") {
//     setShowWelcomeModal(true);
//     localStorage.removeItem("zyvo_show_welcome");
//   }
// }, []);

React.useEffect(() => {
  if (!user) return;

 const loadProfile = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("email_updates, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!error && data) {
    setProfile(data);

    // 🔥 THIS CONTROLS MODAL — set to true to re-enable onboarding
    // setShowOnboarding(!data.onboarding_completed);
    setShowOnboarding(false);
  }
};

  loadProfile();
}, [user]);

  // Prefixes where the top navbar should be hidden
  const HIDE_NAV_PREFIXES = [
    "/",
    "/login",
    "/signup",
    "/auth/callback",

    // tool shells
    "/textimage",
    "/textvideo",
    "/brands",
    "/library",
    "/jobs",
    "/ad-studio",
    "/brand",
    "/brand/name-assistant",
    "/brand/workspace",
    "/products/new",
    "/products/", // covers /products/:id/edit too
    "/avatar-studio",
    "/product-photos",
    "/enhancements",
    //"/home", // Home uses ToolShell; keep navbar hidden
    "/settings",
    "/video-library",
    "/pricing",
    "/text-to-voice",
    "/workspace",
    "/long-form"
  ];

  const computeHide = React.useCallback(
    (path) => path === "/" || HIDE_NAV_PREFIXES.some((p) => path.startsWith(p)),
    []
  );

  // Set initial value synchronously to avoid first-frame flicker
  const [hideNav, setHideNav] = React.useState(() =>
    computeHide(location.pathname)
  );

  // Recompute before paint on route changes
  React.useLayoutEffect(() => {
    setHideNav(computeHide(location.pathname));
  }, [location.pathname, computeHide]);

  const mainClass = hideNav
    ? "min-h-screen bg-[#0B1117] text-white p-0"
    : "min-h-screen bg-[#0B1117] text-white";

return (
 <>
  <CookieConsent />

{user && profile && showOnboarding && (
  <EmailConsentModal
    user={user}
    onComplete={() => {
      setShowOnboarding(false);
      setProfile(prev => ({ ...prev, onboarding_completed: true }));
      // Set flag in localStorage so it survives the page refresh
      localStorage.setItem("zyvo_show_welcome", "1");
    }}
  />
)}

  {!hideNav && <Navbar />}
  {/* Phase 6a: toasts + "your script is ready" notifications. */}
  <Toaster theme="dark" position="bottom-right" richColors />
  {/* A plan picked while logged out continues to checkout right after sign-up. */}
  <ResumeCheckout />
  {/* A reset-password link that lands anywhere in the app goes on to "set a new password". */}
  <PasswordRecoveryRedirect />
  <LongFormScriptReadyNotifier />

{/* WelcomeModal disabled — WelcomeScreen in layout.jsx handles new user welcome */}
{/* {showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />} */}

    <main className={mainClass}>
   <Suspense fallback={
  <div className="min-h-screen flex items-center justify-center bg-[#0B1117]">
    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  </div>
}>
        <Routes>
          {/* "/" is Home: see the WorkspaceLayout routes below. */}

        

   


          {/* Auth callback — handles OAuth code exchange */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {/* Email footer: signed one-click unsubscribe (noindex) */}
          <Route path="/unsubscribe" element={<Unsubscribe />} />

          {/* Blogs */}

        <Route path="/workspace/image-gen-test" element={<><WorkspaceRouteSeo /><ImageGenTest/></>} />
        <Route path="/public-gallery" element={<PublicGallery />} />

        <Route element={<PublicContentLayout />}>

        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/category/ai-video" element={<BlogCategoryPage category="AI Video" />} />
        <Route path="/blog/category/ai-images" element={<BlogCategoryPage category="AI Images" />} />
        <Route path="/blog/category/viral-ideas" element={<BlogCategoryPage category="Viral Ideas" />} />
        <Route path="/blog/category/2am-worlds" element={<BlogCategoryPage category="2AM Worlds" />} />
        <Route path="/blog/category/fruit-stories" element={<BlogCategoryPage category="Fruit Stories" />} />
        <Route path="/blog/category/product-photos" element={<BlogCategoryPage category="Product Photos" />} />
        <Route path="/blog/category/tutorials" element={<BlogCategoryPage category="Tutorials" />} />
        <Route path="/blog/category/growth-analytics" element={<BlogCategoryPage category="Growth & Analytics" />} />

        <Route path="/blog/product-photos-with-ai-for-shopify" element={<ProductPhotosShopify />} />
        <Route path="/blog/product-photos-for-shopify-store" element={<ProductPhotosForShopify />} />
        <Route path="/blog/AI-product-photos-increase-conversion-rates" element={<AiIncreaseRates />} />
        <Route path="/blog/best-ai-tools-for-ecommerce" element={<BestAiToolsEcommerce />} />
        <Route path="/blog/shopify-product-photo-best-practices" element={<ShopifyProductPhotoBestPractices />} />
        <Route path="/blog/ai-vs-traditional-product-photography" element={<AiVsTraditional />} />
        <Route path="/blog/why-product-photos-matter-for-ecommerce-success" element={<WhyProductPhotosMatter />} />
        <Route path="/blog/best-ai-product-backgrounds-to-use" element={<BestAiProductBgToUse />} /> 
        <Route path="/blog/how-to-improve-ecommerce-visual-trust" element={<HowImproveEcommerceVisualTrust />} />
        <Route path="/blog/product-photography-mistakes-ecommerce-brands-make" element={<ProductPhotographyMistakesEcommerce />} />
        <Route path="/blog/how-visual-branding-impacts-online-sales" element={<HowVisualBrandingImpactsOnlineSales />} />
        <Route path="/blog/ai-background-removal-for-product-photos" element={<AIBackgroundRemovalForProductPhotos />} />
        <Route path="/blog/how-to-scale-ecommerce-content-creation-with-ai" element={<ScaleEcommerceContent />} />
        <Route path="/blog/converting-product-images-for-shopify-stores" element={<ConvertingProductImagesForShopify />} />
        <Route path="/blog/ai-product-photography-for-small-businesses" element={<AIProductPhotoForSmallBusiness />} />
        <Route path="/blog/how-better-images-reduce-bounce-rate" element={<HowBetterImagesReduceBounceRate />} />
        <Route path="/blog/ecommerce-visual-consistency-explained" element={<EcommerceVisualConsistencyExplained />} />
        <Route path="/blog/ai-productphotos-for-dropshipping" element={<AiProductPhotosForDropshipping />} />
        <Route path="/blog/how-visual-quality-impacts-seo" element={<HowVisualQualityImpactsSeo />} />
        <Route path="/blog/product-images-that-conver-full-guide" element={<Navigate to="/blog/product-images-that-convert-full-guide" replace />} />
        <Route path="/blog/product-images-that-convert-full-guide" element={<ProductImagesThatConverGuide/>} />
        <Route path="/blog/ai-tools-every-shopify-store-owner-should-know" element={<AiToolsEveryShopifyStoreOwnerKnow/>} />
        <Route path="/blog/how-to-launch-products-faster-with-ai" element={<HowToLaunchProductsFasterWithAi/>} />
        <Route path="/blog/studio-quality-product-photos" element={<StudioQualityProductPhotos/>} />
        <Route path="/blog/why-clean-product-photos-build-trust" element={<WhyCleanProductPhotoBuildTrust/>} />
        <Route path="/blog/visual-optimization-for-mobile-ecommerce" element={<VisualOptimizationForMobielEcommerce/>} />
        <Route path="/blog/how-ai-helps-ecommerce-brands-scale-faster" element={<HowAiHelpsEcommerceBrandsScaleFaster/>} />
        <Route path="/blog/product-photography-trends-for-ecommerce" element={<ProductPhotographyTrendsForEcommerce/>} />
        <Route path="/blog/ai-product-photos-for-fashion-stores" element={<AIProductPhotosForFashionStores/>} />
        <Route path="/blog/ai-product-photos-for-beaty-and-skincare" element={<AIProductPhotosForBeatyAndSkincare/>} />
        <Route path="/blog/how-visual-branding-seperates-winners-from-losers" element={<Navigate to="/blog/how-visual-branding-separates-winners-from-losers" replace />} />
        <Route path="/blog/how-visual-branding-separates-winners-from-losers" element={<HowVisualBrandingSeperatesWinnersFromLosers/>} />
        <Route path="/blog/viral-ai-images-tiktok" element={<ViralAiImagesTiktok/>} />
        <Route path="/blog/creators-blowingup-with-ai" element={<CreatorsBlowingUpWithAi/>} />
        <Route path="/blog/i-test-viral-prompts" element={<ITestViralPromts/>} />
        <Route path="/blog/all-image-styles-everyone-obsessed-with" element={<AllImageStylesEveryoneObsessedWith/>} />
        <Route path="/blog/scroll-stopping-images-no-design-skills" element={<ScrollStoppingIMagesNoDesign/>} />
        <Route path="/blog/why-ai-images-outperform-real-photos" element={<WhyAIImagesOutperformRealPhotos/>} />  
        <Route path="/blog/the-secret-prompts-behind-viral-ai-images" element={<TheSecretPromptsBehindViralAIImages/>} />
        <Route path="/blog/how-to-turn-any-idea-into-a-viral-image-using-ai" element={<TurnAnyIdeaIntoViralImage/>} />
        <Route path="/blog/all-ai-image-trends-you-need-to-jump-on" element={<AllImageTrendsYouNeedTojumpOn/>} />
        <Route path="/blog/why-your-posts-dont-go-viral" element={<WhyYourPostsDontGoViral/>} />
        <Route path="/blog/best-ai-image-generator-for-social-media" element={<BestAIImageGeneratorForSocialMedia/>} />
        <Route path="/blog/how-to-generate-high-quality-images-with-ai" element={<GenerateHighQualityImagesWithAI/>} />
        <Route path="/blog/ai-image-generator-beginners-guide-2026" element={<AIImageGeneratorBeginnersGuide2026/>} />  
        <Route path="/blog/create-professional-images-with-ai" element={<CreateProfessionalImagesWithAI/>} />
        <Route path="/blog/ai-image-generator-vs-traditional-design" element={<AIImageGeneratorVsTraditionalDesign/>} />
        <Route path="/blog/top-ai-image-generator-features-that-matter" element={<TopAIImageGeneratorFeaturesThatMatter/>} />
        <Route path="/blog/generate-images-for-ads-using-ai" element={<HowtoGenerateImagesforAdsUsingAI/>} />
        <Route path="/blog/ai-image-generator-for-content-creators" element={<AIImageGeneratorForContentCreators/>} />
        <Route path="/blog/how-ai-image-generators-work" element={<HowAIImageGeneratorsWork/>} />
        <Route path="/blog/is-ai-image-generation-worth-it-for-creators" element={<IsAIImageGenerationWorthItForCreators/>} />
        <Route path="/blog/top-ai-image-styles-that-go-viral-on-social-media" element={<TopAIImageStylesThatGoViralOnSocialMedia/>} />
        <Route path="/blog/how-to-create-minimalist-images-using-ai" element={<HowToCreateMinimalistImagesUsingAI/>} />
        <Route path="/blog/how-to-create-movie-style-visuals" element={<HowToCreateMovieStyleVisuals/>} />
        <Route path="/blog/why-3d-ai-images-perform-better" element={<Why3dAIImagesPerform/>} />
        <Route path="/blog/how-to-generate-aesthetic-images-with-ai" element={<HowtoGenerateAestheticImagesWithAI/>} />
        <Route path="/blog/which-ai-image-style-works-best" element={<WhichAIImageStyleWorksBest/>} />
        <Route path="/blog/how-to-create-luxury-ai-images" element={<LuxuryAIImages/>} />
        <Route path="/blog/ai-image-generator-for-dark-visuals" element={<DarkMoodyCinematicImages/>} />
        <Route path="/blog/ai-product-photography-high-end" element={<AIProductPhotography/>} />
        <Route path="/blog/ai-visual-styles-most-engagement" element={<VisualStylesAI/>} />
        <Route path="/blog/ai-visual-styles-most-engagementd" element={<Navigate to="/blog/ai-visual-styles-most-engagement" replace />} />
        <Route path="/blog/how-to-go-viral-with-ai" element={<HowToGoViralWithAI/>} />
        <Route path="/blog/ai-video-new-viral-currency" element={<AIVideoNewViralCurrency/>} />
        <Route path="/blog/ai-product-photo-generator" element={<AIProductPhotoGenerator/>} />
        <Route path="/blog/zyvo-vs-midjourney-product-photos" element={<ZyvoVsMidjourneyProductPhotos/>} />
        <Route path="/blog/free-ai-image-generator" element={<FreeAIImageGenerator/>} />
        <Route path="/blog/free-viral-ai-tool" element={<FreeViralAITool/>} />
        <Route path="/blog/how-to-write-a-viral-script" element={<HowToWriteAViralScript/>} />
        <Route path="/blog/ai-script-generator-viral-videos" element={<AIScriptGeneratorViralVideos/>} />
        <Route path="/blog/ai-video-generator-tiktok-reels" element={<AIVideoGeneratorTikTokReels/>} />
        <Route path="/blog/how-to-create-viral-ai-videos" element={<HowToCreateViralAIVideos/>} />
        <Route path="/blog/how-to-make-viral-ai-tiktok-videos" element={<HowToMakeViralAITikTokVideos/>} />
        <Route path="/blog/best-ai-tools-faceless-tiktok-videos" element={<BestAIToolsFacelessTikTokVideos/>} />
        <Route path="/blog/ai-content-creation-tools-instagram-viral" element={<AIContentCreationToolsInstagram/>} />
        <Route path="/blog/best-ai-image-generators-social-media-2026" element={<BestAIImageGeneratorsSocialMedia2026/>} />
        <Route path="/blog/ai-fruit-story-maker" element={<Navigate to="/ai-fruit-story-maker" replace />} />
        <Route path="/blog/viral-ai-fruit-drama-videos" element={<ViralAIFruitDramaVideos/>} />
        <Route path="/blog/how-to-go-viral-tiktok-fruit-drama" element={<HowToGoViralTikTokFruitDrama/>} />
        <Route path="/blog/best-ai-fruit-story-ideas" element={<BestAIFruitStoryIdeas/>} />
        <Route path="/blog/ai-fruit-story-talking-dialogue-tips" element={<AIFruitStoryTalkingDialogueTips/>} />
        <Route path="/blog/ai-fruit-story-vs-traditional-animation" element={<AIFruitStoryVsTraditionalAnimation/>} />
        <Route path="/blog/ai-fruit-story-prompt-formula" element={<AIFruitStoryPromptFormula/>} />
        <Route path="/blog/ai-fruit-story-instagram-youtube-shorts" element={<AIFruitStoryInstagramYouTubeShorts/>} />
        <Route path="/blog/ai-fruit-story-plot-twists" element={<AIFruitStoryPlotTwists/>} />
        <Route path="/blog/ai-fruit-story-couples" element={<Navigate to="/blog/ai-fruit-story-character-ideas" replace />} />
        <Route path="/blog/ai-fruit-story-duets-stitches" element={<Navigate to="/blog/how-to-go-viral-tiktok-fruit-drama" replace />} />
        <Route path="/blog/ai-fruit-story-series-universe" element={<Navigate to="/ai-fruit-story-maker" replace />} />
        <Route path="/blog/ai-fruit-story-mistakes" element={<AIFruitStoryMistakes/>} />
        <Route path="/blog/ai-fruit-story-unhinged-plots" element={<Navigate to="/blog/best-ai-fruit-story-ideas" replace />} />
        <Route path="/blog/ai-fruit-story-quiz" element={<Navigate to="/blog/ai-fruit-story-character-ideas" replace />} />
        <Route path="/blog/ai-fruit-story-drama-tier-list" element={<AIFruitStoryDramaTierList/>} />
        <Route path="/blog/ai-fruit-story-craziest-generation" element={<AIFruitStoryCraziestGeneration/>} />
        <Route path="/blog/ai-fruit-story-fan-theories" element={<Navigate to="/blog/ai-fruit-story-character-ideas" replace />} />
        <Route path="/blog/ai-fruit-story-best-lines" element={<Navigate to="/blog/ai-fruit-story-talking-dialogue-tips" replace />} />
        <Route path="/blog/ai-fruit-story-group-chat" element={<Navigate to="/blog/ai-fruit-story-character-ideas" replace />} />
        <Route path="/blog/what-is-ai-fruit-story" element={<WhatIsAIFruitStory/>} />
        <Route path="/blog/ai-fruit-story-examples" element={<AIFruitStoryExamples/>} />
        <Route path="/blog/ai-fruit-story-pricing" element={<AIFruitStoryPricing/>} />
        <Route path="/blog/ai-image-generator-prompt-formula" element={<AIImageGeneratorPromptFormula/>} />
        <Route path="/blog/ai-image-generator-examples" element={<AIImageGeneratorExamples/>} />
        <Route path="/blog/skeleton-xray-ai-trend" element={<SkeletonXrayAiTrend/>} />
        <Route path="/blog/hidden-ai-image-styles" element={<HiddenAiImageStyles/>} />
        <Route path="/blog/voxel-style-ai-images" element={<MinecraftStyleAiImages/>} />
        <Route path="/blog/noir-vs-cyberpunk-ai-images" element={<NoirVsCyberpunkAiImages/>} />
        <Route path="/blog/classic-3d-vs-hand-painted-anime-images" element={<DisneyVsGhibliAiImages/>} />
        <Route path="/blog/ai-fruit-story-time" element={<Navigate to="/blog/ai-fruit-story-pricing" replace />} />
        <Route path="/blog/ai-fruit-story-cliffhangers" element={<AIFruitStoryCliffhangers/>} />
        <Route path="/blog/ai-fruit-story-halloween" element={<AIFruitStoryHalloween/>} />
        <Route path="/blog/ai-fruit-story-finale-ideas" element={<AIFruitStoryFinaleIdeas/>} />
        <Route path="/blog/ai-fruit-story-vs-2am-worlds" element={<AIFruitStoryVs2amWorlds/>} />
        <Route path="/blog/ai-fruit-story-character-names" element={<AIFruitStoryCharacterNames/>} />
        <Route path="/blog/ai-image-generator-mistakes" element={<AIImageGeneratorMistakes/>} />
        <Route path="/blog/what-is-micro-camera-animal" element={<WhatIsMicroCameraAnimal/>} />
        <Route path="/blog/micro-camera-animal-video-ideas" element={<MicroCameraAnimalVideoIdeas/>} />
        <Route path="/blog/what-is-clay-rescue" element={<WhatIsClayRescue/>} />
        <Route path="/blog/what-is-face-asmr" element={<WhatIsFaceAsmr/>} />
        <Route path="/blog/what-is-zyvo" element={<WhatIsZyvo/>} />
        <Route path="/blog/is-zyvo-free" element={<IsZyvoFree/>} />
        <Route path="/blog/how-to-get-started-with-zyvo" element={<HowToGetStartedWithZyvo/>} />
        <Route path="/blog/zyvo-vs-other-ai-tools" element={<ZyvoVsOtherAiTools/>} />
        <Route path="/blog/clay-rescue-video-ideas" element={<ClayRescueVideoIdeas/>} />
        <Route path="/blog/clay-rescue-mistakes" element={<ClayRescueMistakes/>} />
        <Route path="/blog/micro-camera-animal-mistakes" element={<MicroCameraAnimalMistakes/>} />
        <Route path="/blog/face-asmr-mistakes" element={<FaceAsmrMistakes/>} />
        <Route path="/blog/cartoon-drive-by-mistakes" element={<CartoonDriveByMistakes/>} />
        <Route path="/blog/kit-swap-ideas" element={<FootballerNationalitySwapIdeas/>} />
        <Route path="/blog/which-zyvo-template" element={<WhichZyvoTemplate/>} />
        <Route path="/blog/clay-rescue-series" element={<ClayRescueSeries/>} />
        <Route path="/blog/micro-camera-animal-series" element={<MicroCameraAnimalSeries/>} />
        <Route path="/blog/cartoon-drive-by-vs-2am-worlds" element={<CartoonDriveByVs2amWorlds/>} />
        <Route path="/blog/kit-swap-time" element={<FootballerNationalitySwapTime/>} />
        <Route path="/blog/face-asmr-privacy" element={<FaceAsmrPrivacy/>} />
        <Route path="/blog/what-is-zyvo-publish" element={<WhatIsZyvoPublish/>} />
        <Route path="/blog/what-is-zyvo-stats" element={<WhatIsZyvoStats/>} />
        <Route path="/blog/what-is-zyvo-connections" element={<WhatIsZyvoConnections/>} />
        <Route path="/blog/zyvo-content-workflow" element={<ZyvoContentWorkflow/>} />
        <Route path="/blog/zyvo-template-comparison" element={<ZyvoTemplateComparison/>} />
        <Route path="/blog/best-time-to-post-ai-content" element={<BestTimeToPostAiContent/>} />
        <Route path="/blog/ai-content-hooks-captions-that-go-viral" element={<AiContentHooksCaptionsThatGoViral/>} />
        <Route path="/blog/cartoon-drive-by-explained" element={<CartoonDriveByExplained/>} />
        <Route path="/blog/cartoon-drive-by-video-ideas" element={<CartoonDriveByVideoIdeas/>} />
        <Route path="/blog/kit-swap-explained" element={<FootballerNationalitySwapExplained/>} />
        <Route path="/blog/kit-swap-tips" element={<FootballerNationalitySwapTips/>} />
        <Route path="/blog/kit-swap-mistakes" element={<FootballerNationalitySwapMistakes/>} />
        <Route path="/blog/kit-swap-series" element={<FootballerNationalitySwapSeries/>} />
        <Route path="/blog/cartoon-drive-by-series" element={<CartoonDriveBySeries/>} />
        <Route path="/blog/tiktok-algorithm-explained" element={<TiktokAlgorithmExplained/>} />
        <Route path="/blog/instagram-reels-algorithm-explained" element={<InstagramReelsAlgorithmExplained/>} />
        <Route path="/blog/content-slump-recovery" element={<ContentSlumpRecovery/>} />
        <Route path="/blog/how-often-should-you-post" element={<HowOftenShouldYouPost/>} />
        <Route path="/blog/repurpose-one-video-ten-pieces" element={<RepurposeOneVideoTenPieces/>} />
        <Route path="/blog/faceless-youtube-channel-ideas" element={<FacelessYoutubeChannelIdeas/>} />

         <Route path="/ai-fruit-story-maker" element={<AIFruitStoryLanding />} />
         <Route path="/image-generator" element={<ImageGeneratorLanding />} />
         <Route path="/cartoon-drive-by-video-maker" element={<CartoonDriveByLanding />} />
         <Route path="/kit-swap-ai" element={<FootballerNationalitySwapLanding />} />
         <Route path="/behind-the-scenes-video-maker" element={<BehindTheScenesLanding />} />
         <Route path="/30-days-video-maker" element={<ThirtyDaysLanding />} />
         <Route path="/30-days-series-video-maker" element={<ThirtyDaysSeriesLanding />} />
         {/* Long Form landing pages: one route per entry of src/data/stickmanLandingPages.js */}
         {STICKMAN_LANDING_PAGES.map((page) => <Route key={page.path} path={page.path} element={<StickmanVideoLanding page={page} />} />)}
         <Route path="/blog/what-is-30-days-ai-trend" element={<WhatIs30DaysAiTrend />} />
         <Route path="/blog/30-days-universe-ideas" element={<ThirtyDaysUniverseIdeas />} />
         <Route path="/blog/30-days-video-series" element={<ThirtyDaysVideoSeries />} />
         <Route path="/blog/30-days-mistakes" element={<ThirtyDaysMistakes />} />
         <Route path="/blog/30-days-vs-ai-fruit-story" element={<ThirtyDaysVsAiFruitStory />} />
         <Route path="/blog/30-days-time" element={<ThirtyDaysTime />} />
         <Route path="/blog/30-days-quality-tiers" element={<ThirtyDaysQualityTiers />} />
         <Route path="/blog/30-days-premise-formula" element={<ThirtyDaysPremiseFormula />} />
         <Route path="/blog/30-days-halloween-special" element={<ThirtyDaysHalloweenSpecial />} />
         <Route path="/blog/is-30-days-worth-it" element={<Is30DaysWorthIt />} />
         <Route path="/blog/what-is-30-days-series-mode" element={<WhatIs30DaysSeriesMode />} />
         <Route path="/blog/30-days-series-world-bible-explained" element={<ThirtyDaysSeriesWorldBibleExplained />} />
         <Route path="/blog/30-days-series-days-per-episode" element={<ThirtyDaysSeriesDaysPerEpisode />} />
         <Route path="/blog/30-days-series-vs-single-video" element={<ThirtyDaysSeriesVsSingleVideo />} />
         <Route path="/blog/30-days-series-cliffhangers" element={<ThirtyDaysSeriesCliffhangers />} />
         <Route path="/blog/30-days-camera-mode" element={<ThirtyDaysCameraMode />} />
         <Route path="/blog/30-days-character-consistency" element={<ThirtyDaysCharacterConsistency />} />
         <Route path="/blog/30-days-scene-continuity" element={<ThirtyDaysSceneContinuity />} />
         <Route path="/blog/30-days-voiceover-sync" element={<ThirtyDaysVoiceoverSync />} />
         <Route path="/blog/30-days-series-dashboard-tour" element={<ThirtyDaysSeriesDashboardTour />} />
        <Route path="/blog/behind-the-scenes-trend-explained" element={<BehindTheScenesTrendExplained/>} />
        <Route path="/blog/behind-the-scenes-how-its-made" element={<BehindTheScenesHowItsMade/>} />
        <Route path="/blog/behind-the-scenes-video-ideas" element={<BehindTheScenesVideoIdeas/>} />
        <Route path="/blog/behind-the-scenes-camera-vantage" element={<BehindTheScenesCameraVantage/>} />
        <Route path="/blog/behind-the-scenes-series" element={<BehindTheScenesSeries/>} />
        <Route path="/blog/whats-hot-right-now-ai-trends" element={<WhatsHotRightNowAiTrends/>} />
        <Route path="/blog/how-to-spot-viral-ai-trend" element={<HowToSpotViralAiTrend/>} />
        <Route path="/blog/imperfect-ai-videos-winning" element={<ImperfectAiVideosWinning/>} />
        <Route path="/blog/behind-the-scenes-disaster-types" element={<BehindTheScenesDisasterTypes/>} />
        <Route path="/blog/behind-the-scenes-mistakes" element={<BehindTheScenesMistakes/>} />
        <Route path="/blog/behind-the-scenes-extended-modules" element={<BehindTheScenesExtendedModules/>} />
        <Route path="/blog/behind-the-scenes-vs-clay-rescue" element={<BehindTheScenesVsClayRescue/>} />
        <Route path="/blog/behind-the-scenes-vs-micro-camera-animal" element={<BehindTheScenesVsMicroCameraAnimal/>} />
        <Route path="/blog/behind-the-scenes-time" element={<BehindTheScenesTime/>} />
        <Route path="/blog/behind-the-scenes-tier-list" element={<BehindTheScenesTierList/>} />
        <Route path="/blog/behind-the-scenes-halloween" element={<BehindTheScenesHalloween/>} />
        <Route path="/blog/behind-the-scenes-is-it-real" element={<BehindTheScenesIsItReal/>} />
        <Route path="/blog/behind-the-scenes-beginners-guide" element={<BehindTheScenesBeginnersGuide/>} />
        <Route path="/blog/every-zyvo-video-format-compared" element={<EveryZyvoVideoFormatCompared/>} />
        <Route path="/blog/clay-rescue-vs-micro-camera-animal" element={<ClayRescueVsMicroCameraAnimal/>} />
        <Route path="/blog/fruit-story-vs-kit-swap" element={<FruitStoryVsFootballerNationalitySwap/>} />
        <Route path="/blog/multi-format-weekly-calendar" element={<MultiFormatWeeklyCalendar/>} />
        <Route path="/blog/cross-promote-zyvo-formats" element={<CrossPromoteZyvoFormats/>} />
         <Route path="/face-asmr-maker" element={<FaceAsmrLanding />} />
         <Route path="/micro-camera-animal-maker" element={<MicroCameraAnimalLanding />} />
         <Route path="/clay-rescue-maker" element={<ClayRescueLanding />} />
         <Route path="/publish" element={<PublishLanding />} />
         <Route path="/stats" element={<StatsLanding />} />
         <Route path="/connections" element={<ConnectionsLanding />} />
         <Route path="/2am-worlds-ai-generator" element={<SeoLandingPage slug="2am-worlds-ai-generator" />} />
         <Route path="/2am-creature-town-ai-generator" element={<SeoLandingPage slug="2am-creature-town-ai-generator" />} />
         <Route path="/2am-ninja-city-ai-generator" element={<SeoLandingPage slug="2am-ninja-city-ai-generator" />} />
         <Route path="/blog/face-asmr-maker" element={<FaceAsmrMakerBlog />} />
         <Route path="/blog/viral-face-asmr-videos" element={<ViralFaceAsmrVideos />} />
         <Route path="/blog/asmr-video-ideas-tiktok-2026" element={<AsmrVideoIdeasTiktok />} />
         <Route path="/blog/how-to-start-asmr-channel-with-ai" element={<HowToStartAsmrChannel />} />
         <Route path="/blog/best-face-asmr-video-ideas-2026" element={<BestFaceAsmrVideoIdeas />} />
         <Route path="/blog/micro-camera-animal-maker" element={<MicroCameraAnimalMakerBlog />} />
         <Route path="/blog/viral-animal-bodycam-videos" element={<ViralAnimalBodycamVideos />} />
         <Route path="/blog/clay-rescue-ai-video-maker" element={<ClayRescueMakerBlog />} />
         <Route path="/blog/why-giant-hand-rescue-videos-go-viral" element={<GiantHandRescueVideosBlog />} />
         <Route path="/blog/ai-fruit-story-character-ideas" element={<AIFruitStoryCharacterIdeas />} />
         <Route path="/blog/best-ai-video-generators-tiktok" element={<BestAiVideoGeneratorsTiktok />} />
         <Route path="/blog/best-free-ai-tools-creators" element={<BestFreeAiToolsCreators />} />
         <Route path="/blog/how-to-make-money-ai-content" element={<HowToMakeMoneyAiContent />} />
         <Route path="/blog/is-ai-content-worth-it" element={<IsAiContentWorthIt />} />
         <Route path="/blog/vertical-video-formats-guide" element={<VerticalVideoFormatsGuide />} />
         <Route path="/blog/schedule-auto-publish-ai-videos" element={<ScheduleAutoPublishAIVideosBlog />} />
         <Route path="/blog/one-click-publishing-playbook" element={<OneClickPublishingPlaybookBlog />} />
         <Route path="/blog/social-media-scheduler-for-creators" element={<CreatorGrowthGuide slug="social-media-scheduler-for-creators" />} />
         <Route path="/blog/how-to-cross-post-instagram-tiktok-youtube" element={<CreatorGrowthGuide slug="how-to-cross-post-instagram-tiktok-youtube" />} />
         <Route path="/blog/28-day-social-media-content-calendar" element={<CreatorGrowthGuide slug="28-day-social-media-content-calendar" />} />
         <Route path="/blog/social-media-automation-for-creators" element={<CreatorGrowthGuide slug="social-media-automation-for-creators" />} />
         <Route path="/blog/youtube-analytics-for-creators" element={<CreatorGrowthGuide slug="youtube-analytics-for-creators" />} />
         <Route path="/blog/short-form-video-metrics-that-matter" element={<CreatorGrowthGuide slug="short-form-video-metrics-that-matter" />} />
         <Route path="/blog/how-to-go-viral-tiktok-ai-worlds" element={<TwoAmBlogGuide slug="how-to-go-viral-tiktok-ai-worlds" />} />
         <Route path="/blog/liminal-space-ai-generator" element={<TwoAmBlogGuide slug="liminal-space-ai-generator" />} />
         <Route path="/blog/how-to-create-2am-anime-ai-images" element={<TwoAmBlogGuide slug="how-to-create-2am-anime-ai-images" />} />
         <Route path="/blog/how-to-create-2am-anime-village-images" element={<TwoAmBlogGuide slug="how-to-create-2am-anime-village-images" />} />
         <Route path="/blog/2am-voxel-world-ai-images" element={<TwoAmBlogGuide slug="2am-voxel-world-ai-images" />} />
         <Route path="/blog/2am-neon-city-ai-images" element={<TwoAmBlogGuide slug="2am-neon-city-ai-images" />} />
         <Route path="/blog/2am-one-piece-ai-images" element={<TwoAmBlogGuide slug="2am-one-piece-ai-images" />} />
         <Route path="/blog/2am-hand-painted-anime-images" element={<TwoAmBlogGuide slug="2am-hand-painted-anime-images" />} />
         <Route path="/blog/2am-battle-island-ai-images" element={<TwoAmBlogGuide slug="2am-battle-island-ai-images" />} />
         <Route path="/blog/2am-wizard-school-ai-images" element={<TwoAmBlogGuide slug="2am-wizard-school-ai-images" />} />
         <Route path="/blog/2am-in-bikini-bottom-ai-images" element={<TwoAmBlogGuide slug="2am-in-bikini-bottom-ai-images" />} />
         <Route path="/blog/2am-cyberpunk-city-ai-images" element={<TwoAmBlogGuide slug="2am-cyberpunk-city-ai-images" />} />
         <Route path="/blog/2am-worlds-tier-list" element={<TwoAmBlogGuide slug="2am-worlds-tier-list" />} />
         <Route path="/blog/what-is-the-2am-worlds-ai-trend" element={<TwoAmBlogGuide slug="what-is-the-2am-worlds-ai-trend" />} />
         <Route path="/blog/best-2am-world-ai-prompts" element={<TwoAmBlogGuide slug="best-2am-world-ai-prompts" />} />
         <Route path="/blog/how-to-create-2am-creature-town-images" element={<TwoAmBlogGuide slug="how-to-create-2am-creature-town-images" />} />
         <Route path="/blog/how-to-create-2am-ninja-city-images" element={<TwoAmBlogGuide slug="how-to-create-2am-ninja-city-images" />} />
         <Route path="/blog/ai-world-generator-guide" element={<TwoAmBlogGuide slug="ai-world-generator-guide" />} />
         <Route path="/blog/ai-world-generator-prompts" element={<TwoAmBlogGuide slug="ai-world-generator-prompts" />} />
         <Route path="/blog/how-to-make-ai-nostalgia-videos" element={<TwoAmBlogGuide slug="how-to-make-ai-nostalgia-videos" />} />
         <Route path="/blog/ai-worlds-at-2am-ideas" element={<TwoAmBlogGuide slug="ai-worlds-at-2am-ideas" />} />
         <Route path="/blog/2am-wild-west-ai-images" element={<TwoAmBlogGuide slug="2am-wild-west-ai-images" />} />
         <Route path="/blog/2am-atlantis-ai-images" element={<TwoAmBlogGuide slug="2am-atlantis-ai-images" />} />
         <Route path="/blog/2am-space-station-ai-images" element={<TwoAmBlogGuide slug="2am-space-station-ai-images" />} />
         <Route path="/blog/2am-medieval-kingdom-ai-images" element={<TwoAmBlogGuide slug="2am-medieval-kingdom-ai-images" />} />
         <Route path="/blog/2am-worlds-halloween-special" element={<TwoAmBlogGuide slug="2am-worlds-halloween-special" />} />
         <Route path="/blog/how-to-pick-your-first-2am-world" element={<TwoAmBlogGuide slug="how-to-pick-your-first-2am-world" />} />

        </Route>




  




<Route  element={<WorkspaceLayout />}>
  {/* HOME at the site root: public, prerendered. Logged-out visitors get
      Login / Start for Free in the top bar, logged-in users their app.
      /workspace/home is the old address (301 in vercel.json; this client
      redirect covers in-app navigation to it). */}
  <Route path="/" element={USE_LEGACY_HOME ? <Workspace /> : <HomeV2 />} />
  <Route path="/workspace/home" element={<OldHomeRedirect />} />

  {/* PUBLIC ROUTES */}
  <Route path="/workspace/library" element={<Navigate to="/workspace/creations" replace />} />
  <Route path="/workspace/creations" element={<Creations />} />
  <Route path="/workspace/creations/viral-videos" element={<Creations />} />
  {/* PRICING: public and indexable at /pricing (prerendered, in the sitemap).
      Logged-out visitors see every plan; logged-in users also their own. */}
  <Route path="/pricing" element={<Pricing />} />
  <Route path="/workspace/pricing" element={<OldPricingRedirect />} />
  <Route path="/workspace/image-generator" element={<Image />} />
  <Route path="/workspace/video-generator" element={<Video />} />
  <Route path="/workspace/viral-script" element={<Script />} />
  <Route path="/workspace/viral-score" element={<ViralScore />} />
  <Route path="/workspace/lip-sync"    element={<Navigate to="/workspace" replace />} />
  <Route path="/workspace/ai-fruit-story" element={<AIFruitStory />} />
  <Route path="/workspace/face-asmr" element={<FaceAsmrPage />} />
  <Route path="/workspace/skeleton-shorts" element={<SkeletonShorts />} />
  <Route path="/workspace/micro-camera-animal" element={<MicroCameraAnimalPage />} />
  <Route path="/workspace/clay-rescue" element={<ClayRescuePage />} />
  <Route path="/workspace/ai-cooking-matic" element={<AICookingMaticPage />} />
  <Route path="/workspace/kit-swap" element={<FootballerNationalitySwapPage />} />
  <Route path="/workspace/two-am" element={<TwoAmPage />} />
  <Route path="/workspace/thirty-days" element={<ThirtyDaysPage />} />
  <Route path="/workspace/cartoon-drive-by" element={<CartoonDriveByPage />} />
  <Route path="/workspace/behind-the-scenes" element={<BehindTheScenesPage />} />
  <Route path="/workspace/publish"          element={<Navigate to="/" replace />} />
  <Route path="/workspace/publishv"         element={<PublishPage />} />
  <Route path="/workspace/stats"            element={<StatsPage />} />
  <Route path="/workspace/connections"      element={<ConnectionsPage />} />
  <Route path="/workspace/earn"             element={<EarnPage />} />
  <Route path="/workspace/earn/submissions" element={<EarnPage />} />
  <Route path="/workspace/earn/referrals"   element={<EarnPage />} />
  <Route path="/workspace/earn/payouts"     element={<EarnPage />} />
  <Route path="/workspace/earn/leaderboard" element={<EarnPage />} />
  <Route path="/workspace/earn/rules"       element={<EarnPage />} />
  <Route path="/long-form"                       element={<LongFormPage />} />
  <Route path="/long-form/new"                   element={<LongFormNewPage />} />
  <Route path="/long-form/create"                element={<LongFormProductionSetupPage />} />
  <Route path="/long-form/teaser/:id"            element={<LongFormTeaserPage />} />
  <Route path="/long-form/project/:id/story"     element={<StickmanRouteGuard page="story"><LongFormStoryPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/research"  element={<StickmanRouteGuard page="research"><LongFormResearchPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/script"    element={<StickmanRouteGuard page="script"><LongFormScriptPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/look"      element={<StickmanRouteGuard page="look"><LongFormLookPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/visual-world" element={<StickmanRouteGuard page="visual-world"><LongFormVisualWorldPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/generate"     element={<StickmanRouteGuard page="generate"><LongFormGenerateRouteBoundary><LongFormGeneratePage /></LongFormGenerateRouteBoundary></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/narration"    element={<StickmanRouteGuard page="narration"><LongFormNarrationPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/visuals"      element={<StickmanRouteGuard page="visuals"><LongFormVisualsPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/writing"      element={<StickmanRouteGuard page="writing"><LongFormWritingPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/scenes"       element={<StickmanRouteGuard page="scenes"><LongFormScenesPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/edit"         element={<StickmanRouteGuard page="edit"><LongFormEditPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/generating"   element={<StickmanRouteGuard page="generating"><LongFormGeneratingPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/idea"         element={<StickmanRouteGuard page="idea"><LongFormIdeaPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/publish"      element={<StickmanRouteGuard page="publish"><LongFormPublishPage /></StickmanRouteGuard>} />
  <Route path="/long-form/project/:id/script-review" element={<StickmanRouteGuard page="script-review"><LongFormScriptReviewPage /></StickmanRouteGuard>} />


</Route>






          {/* ---------- Auth (guest-only) ---------- */}
          <Route
            path="/signup"
            element={
              <GuestOnly>
                <Signup />
              </GuestOnly>
            }
          />

          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />

          {/* Forgot / Reset (guest-only) */}
          <Route
            path="/auth/forgot"
            element={
              <GuestOnly>
                <Forgot />
              </GuestOnly>
            }
          />
          {/* The link in the reset email: /auth/confirm checks it, /auth/reset sets the new password. */}
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route
            path="/auth/reset"
            element={<Reset />}
          />

          <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
          <Route
            path="/auth/callback"
            element={
         
                <AuthCallback />
          
            }
          />

          {/* ---------- Protected examples ---------- */}
          <Route
            path="/settings"
            element={
              <RequireAuth>
              
                  <Settings />
              </RequireAuth>
            }
          />

          {/* ---------- Misc pages ---------- */}
 

       
     
          <Route path="/admin/feedback" element={<FeedbackAnalytics />} />
          <Route path="/admin/ops" element={<OpsPage />} />

        
          <Route path="/home" element={<Navigate to="/" replace />} />


          <Route
            path="/help"
            element={<HelpCenter />}
          />
          <Route
            path="/help/feedback"
            element={<Feedback />}
          />

    


          {/* ---------- Image hub ---------- */}
    


          {/* ---------- Support section ---------- */}
          <Route path="/support" element={<SupportLayout />}>
            <Route index element={<SupportHome />} />
            <Route path="article/:slug" element={<SupportArticle />} />
            <Route path="policies" element={<SupportPolicies />} />
            <Route path="contact" element={<SupportContact />} />
            <Route path="policies/:slug" element={<SupportPolicyArticle />} />
          </Route>

          {/* 404 */}
        <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      
      </Suspense>

     {/* Vercel Analytics */}
      <Analytics />

      </main>

    </>
  );
}
