import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ToolShell from "./components/layout/ToolShell";
import NewsBar from "./components/NewsBar";

// pages…
//import Home from "./pages/Home";
import ThumbnailGenerator from "./pages/ThumbnailGenerator";
import MotivationalQuote from "./pages/MotivationalQuote";
import Pricing from "./pages/Pricing";
import Settings from "./pages/settings/WorkspaceSettings";
import Product from "./pages/Product";
import TextVideo from "./pages/TextVideo";
import CartoonCreator from "./pages/CartoonCreator";

import TextLanding from "./pages/landing/TextStoriesLanding";
import ImageStudio from "./pages/studio/ImageStudio";
import ImageEnhancement from "./pages/studio/ImageEnhancement";
import VideoStudio from "./pages/studio/videostudio";
import VideoEnhancement from "./pages/studio/VideoEnhancement";
import StoryStudio from "./pages/studio/StoryStudio";
import ComicStudio from "./pages/studio/ComicStudio";
import VideoGenerator from "./pages/tools/VideoGenerator";
import SupportLayout from "./pages/support/SupportLayout";
import SupportHome from "./pages/support/SupportHome";
import SupportArticle from "./pages/support/SupportArticle";
import SupportPolicies from "./pages/support/SupportPolicies";
import SupportContact from "./pages/support/SupportContact";
import CreateLauncher from "./pages/CreateLauncher";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Forgot from "./pages/tools/Forgot";
import Reset from "./pages/tools/Reset";
import Contact from "./pages/Contact";
import ImageGenerator from "./pages/tools/ImageGenerator";
import JobsLab from "./pages/dev/JobsLab";
import JobProgress from "./pages/JobProgress";
import AuthCallback from "./pages/auth/AuthCallback";
import TextToImage from "./pages/tools/TextToImage";
import PromptLibrary from "./pages/tools/PromptLibrary";
import Library from "./pages/Library";
import AdStudio from "./pages/tools/AdStudio";
import ProductCreate from "./pages/products/ProductCreate";
import AvatarStudio from "./pages/brands/AvatarStudio";
import ProductPhotos from "./pages/products/ProductPhotos";
import Enhancements from "./pages/tools/Enhancements";

// Brand pages
import BrandPicker from "./pages/brands/BrandPicker";
import BrandHome from "./pages/brands/BrandHome";
import BrandWorkspace from "./pages/brands/BrandWorkspace";
import NameAssistant from "./pages/brands/NameAssistant";
import TextToVideo from "./pages/tools/TextToVideo";
import BrandDashboard from "./pages/brands/BrandDashboard";
import VideoLibrary from "./pages/tools/VideoLibrary";

import BillingSuccess from "./pages/billing/Success.jsx";
import BillingCancel from "./pages/billing/Cancel.jsx";

import HelpCenter from "./pages/help/HelpCenter";
import Feedback from "./pages/help/Feedback";
import { GenerationsProvider } from "./components/GenerationsDock";
import FeedbackAnalytics from "./pages/admin/FeedbackAnalytics";
import TextToVoice from "./pages/tools/TextToVoice";

//ads
import AdCreateStep1 from "./pages/adstudio/AdCreateStep1";
import AdCreateStep2 from "./pages/adstudio/AdCreateStep2";
import AdCreateStep3 from "./pages/adstudio/AdCreateStep3";
import AdCreateStep4 from "./pages/adstudio/AdCreateStep4";
import AdCreateStep5 from "./pages/adstudio/AdCreateStep5";


import Workspace from "./pages/workspace/home.jsx"
import ProductPhoto from "./pages/workspace/productphoto.jsx"
import Library1 from "./pages/workspace/library.jsx"
import WorkspaceLayout from "./pages/workspace/layout.jsx"
import Creations from "./pages/workspace/creations.jsx"
import Myproduct from "./pages/workspace/myproduct.jsx"
import Step2 from "./pages/workspace/step2.jsx"
import Step3 from "./pages/workspace/step3.jsx"
import Step21 from "./pages/workspace/myproduct/step1.jsx"
import Step31 from "./pages/workspace/myproduct/step2.jsx"


// blogs

import BlogIndex from "./app/blog/BlogIndex";
import ProductPhotosShopify from "./app/blog/ProductPhotosShopify";
import ProductPhotosForShopify from "./app/blog/productphotos/Forshopifystores.jsx";
import AiIncreaseRates from "./app/blog/productphotos/AIroductIncreaseRates.jsx";
import BestAiToolsEcommerce from "./app/blog/productphotos/BestAiToolsEcommerce.jsx";
import ShopifyProductPhotoBestPractices from "./app/blog/productphotos/ShopifyProductPhotoBestPractices.jsx";




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

  if (loading) {
    return <div />; // IMPORTANT: block render
  }

  if (user) {
    return <Navigate to="/workspace" replace />;
  }

  return children;
}

export default function App() {
 return (
<AuthProvider>
  <Router>
    <GenerationsProvider>
      <AppWithRouting />
    </GenerationsProvider>
  </Router>
</AuthProvider>
  );
}

function AppWithRouting() {
  const location = useLocation();

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
      {!hideNav && <Navbar />}

      <main className={mainClass}>
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

          
























  




<Route path="/workspace" element={<WorkspaceLayout />}>
  {/* 🔒 PROTECTED HOME */}
  <Route
    index
    element={
      <RequireAuth>
        <Workspace />
      </RequireAuth>
    }
  />

  {/* PUBLIC ROUTES */}
  <Route path="productphoto" element={<ProductPhoto />} />
  <Route path="library" element={<Library1 />} />
  <Route path="creations" element={<Creations />} />
  <Route path="myproduct" element={<Myproduct />} />
  <Route path="step2" element={<Step2 />} />
  <Route path="step3" element={<Step3 />} />
  <Route path="pricing" element={<Pricing />} />

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
              <GuestOnly>
                <AuthCallback />
              </GuestOnly>
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
 

       
          <Route path="/contact" element={<Contact />} />
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
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="p-10 text-center">Not Found</div>
            }
          />
        </Routes>

     {/* Vercel Analytics */}
      <Analytics />

      </main>

    </>
  );
}
