import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
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

const AuthCallback = lazy(() => import("./pages/auth/AuthCallback"));

const BillingSuccess = lazy(() => import("./pages/billing/Success.jsx"));
const BillingCancel = lazy(() => import("./pages/billing/Cancel.jsx"));

const HelpCenter = lazy(() => import("./pages/help/HelpCenter"));
const Feedback = lazy(() => import("./pages/help/Feedback"));
const FeedbackAnalytics = lazy(() => import("./pages/admin/FeedbackAnalytics"));
const TextToVoice = lazy(() => import("./pages/tools/TextToVoice"));

// already lazy
const Workspace = lazy(() => import("./pages/workspace/home.jsx"));

// 🔥 ALSO lazy these workspace pages (important for performance)
const WorkspaceLayout = lazy(() => import("./pages/workspace/layout.jsx"));
const Creations = lazy(() => import("./pages/workspace/creations.jsx"));

const ImageGenTest = lazy(() => import("./pages/image-gen-test.jsx"));
import { GenerationsProvider } from "./components/GenerationsDock";


// blogs

const BlogIndex = lazy(() => import("./app/blog/BlogIndex"));

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
const ViralScore = lazy(() => import("./pages/viral/ViralScore.jsx"));
const LipSync    = lazy(() => import("./pages/viral/LipSync.jsx"));


import ScrollToTop from "./components/ScrollToTop";
import CookieConsent from "./components/CookieConsent";
import EmailConsentModal from "./components/EmailConsentModal";
import WelcomeModal from "./components/WelcomeModal";
import { supabase } from "./lib/supabaseClient";
import NotFoundRedirect from "./components/NotFoundRedirect";
import PublicContentLayout from "./components/seo/PublicContentLayout.jsx";
import WorkspaceRouteSeo from "./components/seo/WorkspaceRouteSeo.jsx";
import PublicGallery from "./components/public-gallery/gallery";
const AIFruitStoryLanding = lazy(() => import("./pages/landing/AIFruitStoryLanding.jsx"));
const CartoonDriveByLanding = lazy(() => import("./pages/landing/CartoonDriveByLanding.jsx"));
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
const ScheduleAutoPublishAIVideosBlog = lazy(() => import("./app/blog/imagegenerator/schedule-auto-publish-ai-videos.jsx"));
const OneClickPublishingPlaybookBlog = lazy(() => import("./app/blog/imagegenerator/one-click-publishing-playbook.jsx"));
{/* Viral */}


const Image = lazy(() => import("./pages/viral/Image.jsx"));
const Video = lazy(() => import("./pages/viral/video-generator.jsx"));
const Script = lazy(() => import("./pages/viral/ScriptBuilder.jsx"));






import { Analytics } from "@vercel/analytics/react";






import NewHome from "./pages/home/home.jsx";
import AuthCallbackPage from "./pages/AuthCallback.jsx";
const FaceAsmrPage           = lazy(() => import("./pages/workspace/FaceAsmr.jsx"));
const MicroCameraAnimalPage  = lazy(() => import("./pages/workspace/MicroCameraAnimal.jsx"));
const ClayRescuePage         = lazy(() => import("./pages/workspace/ClayRescue.jsx"));
const AICookingMaticPage     = lazy(() => import("./pages/workspace/AICookingMatic.jsx"));
const FootballerNationalitySwapPage = lazy(() => import("./pages/workspace/FootballerNationalitySwap.jsx"));
const TwoAmPage               = lazy(() => import("./pages/workspace/TwoAm.jsx"));
const CartoonDriveByPage       = lazy(() => import("./pages/workspace/CartoonDriveBy.jsx"));
const PublishPage            = lazy(() => import("./pages/workspace/publish.jsx"));
const StatsPage              = lazy(() => import("./pages/workspace/stats.jsx"));
const ConnectionsPage        = lazy(() => import("./pages/workspace/connections.jsx"));

import "./styles/sand.css";

/* ---------------- Route guards ---------------- */
function RequireAuth({ children }) {
  const { loading, user } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
function GuestOnly({ children }) {
  const { loading, user } = useAuth();

  if (loading) return null; // or spinner, NOT empty div

  if (user) {
    return <Navigate to="/workspace/home" replace />;
  }

  return children;
}

export default function App() {
 return (
<AuthProvider>
  <Router>
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
    "/workspace"
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

{/* WelcomeModal disabled — WelcomeScreen in layout.jsx handles new user welcome */}
{/* {showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />} */}

    <main className={mainClass}>
   <Suspense fallback={
  <div className="min-h-screen flex items-center justify-center bg-[#0B1117]">
    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  </div>
}>
        <Routes>
          {/* Public home */}
          <Route path="/" element={<Navigate to="/workspace/home" replace />} />

        

   


          {/* Auth callback — handles OAuth code exchange */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Blogs */}

        <Route path="/workspace/image-gen-test" element={<><WorkspaceRouteSeo /><ImageGenTest/></>} />
        <Route path="/public-gallery" element={<PublicGallery />} />

        <Route element={<PublicContentLayout />}>

        <Route path="/blog" element={<BlogIndex />} />

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

         <Route path="/ai-fruit-story-maker" element={<AIFruitStoryLanding />} />
         <Route path="/cartoon-drive-by-video-maker" element={<CartoonDriveByLanding />} />
         <Route path="/face-asmr-maker" element={<FaceAsmrLanding />} />
         <Route path="/micro-camera-animal-maker" element={<MicroCameraAnimalLanding />} />
         <Route path="/clay-rescue-maker" element={<ClayRescueLanding />} />
         <Route path="/publish" element={<PublishLanding />} />
         <Route path="/stats" element={<StatsLanding />} />
         <Route path="/connections" element={<ConnectionsLanding />} />
         <Route path="/2am-worlds-ai-generator" element={<SeoLandingPage slug="2am-worlds-ai-generator" />} />
         <Route path="/2am-in-pokemon-ai-generator" element={<SeoLandingPage slug="2am-in-pokemon-ai-generator" />} />
         <Route path="/2am-in-ninjago-ai-generator" element={<SeoLandingPage slug="2am-in-ninjago-ai-generator" />} />
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
         <Route path="/blog/how-to-create-2am-naruto-ai-images" element={<TwoAmBlogGuide slug="how-to-create-2am-naruto-ai-images" />} />
         <Route path="/blog/what-is-the-2am-worlds-ai-trend" element={<TwoAmBlogGuide slug="what-is-the-2am-worlds-ai-trend" />} />
         <Route path="/blog/best-2am-world-ai-prompts" element={<TwoAmBlogGuide slug="best-2am-world-ai-prompts" />} />
         <Route path="/blog/how-to-create-2am-pokemon-ai-images" element={<TwoAmBlogGuide slug="how-to-create-2am-pokemon-ai-images" />} />
         <Route path="/blog/how-to-create-2am-ninjago-ai-images" element={<TwoAmBlogGuide slug="how-to-create-2am-ninjago-ai-images" />} />
         <Route path="/blog/ai-world-generator-guide" element={<TwoAmBlogGuide slug="ai-world-generator-guide" />} />
         <Route path="/blog/ai-world-generator-prompts" element={<TwoAmBlogGuide slug="ai-world-generator-prompts" />} />
         <Route path="/blog/how-to-make-ai-nostalgia-videos" element={<TwoAmBlogGuide slug="how-to-make-ai-nostalgia-videos" />} />
         <Route path="/blog/ai-worlds-at-2am-ideas" element={<TwoAmBlogGuide slug="ai-worlds-at-2am-ideas" />} />

        </Route>




  




<Route  element={<WorkspaceLayout />}>
  {/* 🔒 PROTECTED HOME */}
  <Route
    path="/workspace/home"
    index
    element={
   
        <Workspace />
   
    }
  />

  {/* PUBLIC ROUTES */}
  <Route path="/workspace/library" element={<Navigate to="/workspace/creations" replace />} />
  <Route path="/workspace/creations" element={<Creations />} />
  <Route path="/workspace/creations/viral-videos" element={<Creations />} />
  <Route path="/workspace/pricing" element={<Pricing />} />
  <Route path="/workspace/image-generator" element={<Image />} />
  <Route path="/workspace/video-generator" element={<Video />} />
  <Route path="/workspace/viral-script" element={<Script />} />
  <Route path="/workspace/viral-score" element={<ViralScore />} />
  <Route path="/workspace/lip-sync"    element={<LipSync />} />
  <Route path="/workspace/ai-fruit-story" element={<AIFruitStory />} />
  <Route path="/workspace/face-asmr" element={<FaceAsmrPage />} />
  <Route path="/workspace/skeleton-shorts" element={<SkeletonShorts />} />
  <Route path="/workspace/micro-camera-animal" element={<MicroCameraAnimalPage />} />
  <Route path="/workspace/clay-rescue" element={<ClayRescuePage />} />
  <Route path="/workspace/ai-cooking-matic" element={<AICookingMaticPage />} />
  <Route path="/workspace/footballer-nationality-swap" element={<FootballerNationalitySwapPage />} />
  <Route path="/workspace/two-am" element={<TwoAmPage />} />
  <Route path="/workspace/cartoon-drive-by" element={<CartoonDriveByPage />} />
  <Route path="/workspace/publish"          element={<Navigate to="/workspace/home" replace />} />
  <Route path="/workspace/publishv"         element={<PublishPage />} />
  <Route path="/workspace/stats"            element={<StatsPage />} />
  <Route path="/workspace/connections"      element={<ConnectionsPage />} />


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

        
          <Route path="/home" element={<Navigate to="/workspace/home" replace />} />


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
