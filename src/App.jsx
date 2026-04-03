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
const ProductPhoto = lazy(() => import("./pages/workspace/productphoto.jsx"));
const Library1 = lazy(() => import("./pages/workspace/library.jsx"));
const WorkspaceLayout = lazy(() => import("./pages/workspace/layout.jsx"));
const Creations = lazy(() => import("./pages/workspace/creations.jsx"));
const Myproduct = lazy(() => import("./pages/workspace/myproduct.jsx"));
const Step2 = lazy(() => import("./pages/workspace/step2.jsx"));
const Step3 = lazy(() => import("./pages/workspace/step3.jsx"));

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


import ScrollToTop from "./components/ScrollToTop";
import CookieConsent from "./components/CookieConsent";
import EmailConsentModal from "./components/EmailConsentModal";
import { supabase } from "./lib/supabaseClient";
import NotFoundRedirect from "./components/NotFoundRedirect";
import PublicGallery from "./components/public-gallery/gallery";
{/* Viral */}


const Image = lazy(() => import("./pages/viral/Image.jsx"));
const Video = lazy(() => import("./pages/viral/video-generator.jsx"));
const Script = lazy(() => import("./pages/viral/ScriptBuilder.jsx"));






import { Analytics } from "@vercel/analytics/react";






import NewHome from "./pages/home/home.jsx";

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

    // 🔥 THIS CONTROLS MODAL
  setShowOnboarding(!data.onboarding_completed);
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
      setShowOnboarding(false)

      // 🔥 THIS IS THE KEY FIX
      setProfile(prev => ({
        ...prev,
        onboarding_completed: true
      }))
    }}
  />
)}

  {!hideNav && <Navbar />}

    <main className={mainClass}>
   <Suspense fallback={
  <div className="min-h-screen flex items-center justify-center bg-[#0B1117]">
    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  </div>
}>
        <Routes>
          {/* Public home */}
          <Route path="/" element={<Navigate to="/home" replace />} />

        

   


          {/* Blogs */}  
        
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
        <Route path="/blog/product-images-that-conver-full-guide" element={<ProductImagesThatConverGuide/>} />
        <Route path="/blog/ai-tools-every-shopify-store-owner-should-know" element={<AiToolsEveryShopifyStoreOwnerKnow/>} />
        <Route path="/blog/how-to-launch-products-faster-with-ai" element={<HowToLaunchProductsFasterWithAi/>} />
        <Route path="/blog/studio-quality-product-photos" element={<StudioQualityProductPhotos/>} />
        <Route path="/blog/why-clean-product-photos-build-trust" element={<WhyCleanProductPhotoBuildTrust/>} />
        <Route path="/blog/visual-optimization-for-mobile-ecommerce" element={<VisualOptimizationForMobielEcommerce/>} />
        <Route path="/blog/how-ai-helps-ecommerce-brands-scale-faster" element={<HowAiHelpsEcommerceBrandsScaleFaster/>} />
        <Route path="/blog/product-photography-trends-for-ecommerce" element={<ProductPhotographyTrendsForEcommerce/>} />
        <Route path="/blog/ai-product-photos-for-fashion-stores" element={<AIProductPhotosForFashionStores/>} />
        <Route path="/blog/ai-product-photos-for-beaty-and-skincare" element={<AIProductPhotosForBeatyAndSkincare/>} />
        <Route path="/blog/how-visual-branding-seperates-winners-from-losers" element={<HowVisualBrandingSeperatesWinnersFromLosers/>} />
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



        <Route path="/workspace/image-gen-test" element={<ImageGenTest/>} />
         <Route path="/public-gallery" element={<PublicGallery />} />           




  




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
  <Route path="/workspace/productphotoo" element={<ProductPhoto />} />
  <Route path="/workspace/libraryo" element={<Library1 />} />
  <Route path="/workspace/creations" element={<Creations />} />
  <Route path="/workspace/myproducto" element={<Myproduct />} />
  <Route path="/workspace/step2o" element={<Step2 />} />
  <Route path="/workspace/step3o" element={<Step3 />} />
  <Route path="/workspace/pricing" element={<Pricing />} />
  <Route path="/workspace/image-generator" element={<Image />} />
  <Route path="/workspace/video-generator" element={<Video />} />
  <Route path="/workspace/viral-script" element={<Script />} />


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

        
          {/* Home stays in ToolShell BUT without sidebar (dead-centered content) */}
          <Route
  path="/home"
  element={
    <GuestOnly>
      <NewHome />
    </GuestOnly>
  }
/>


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
