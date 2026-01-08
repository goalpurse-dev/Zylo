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
  if (loading) return null;
  if (user) return <Navigate to="/workspace" replace />;
  return children;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <GenerationsProvider>
          {/* Global news bar (appears on scroll anywhere) */}
          <NewsBar
            message="new zylo ads with avatar 3.1 launched🎉"
            href="/changelog"
          />
          <AppWithRouting />
        </GenerationsProvider>
      </AuthProvider>
    </Router>
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

          {/* ---------- Brand routes (ToolShell) ---------- */}
          <Route
            path="/brands"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <BrandPicker />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/brands/:id"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <BrandDashboard />
                </ToolShell>
              </RequireAuth>
            }
          />

          <Route
            path="/brand"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <BrandHome />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/brand/:id"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <BrandHome />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/products/new"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <ProductCreate />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/products/:productId/edit"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <ProductCreate />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/product-photos"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <ProductPhotos />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/avatar-studio"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <AvatarStudio />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/enhancements/*"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  Enhancements
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/brand/workspace"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <BrandWorkspace />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/video-library"
            element={
              <ToolShell overlaySidebar>
                <VideoLibrary />
              </ToolShell>
            }
          />
          <Route
            path="/brand/name-assistant"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <NameAssistant />
                </ToolShell>
              </RequireAuth>
            }
          />

            <Route
            path="/text-to-voice"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <TextToVoice />
                </ToolShell>
              </RequireAuth>
            }
            />

          {/* AD STEPS*/}

<Route
  path="/ad/create/step-1"
  element={
    <RequireAuth>
      <ToolShell overlaySidebar>
        <AdCreateStep1 />
      </ToolShell>
    </RequireAuth>
  }
/>

<Route
  path="/ad/create/step-2"
  element={
    <RequireAuth>
      <ToolShell overlaySidebar>
        <AdCreateStep2 />
      </ToolShell>
    </RequireAuth>
  }
/>

<Route
  path="/ad/create/step-3"
  element={
    <RequireAuth>
      <ToolShell overlaySidebar>
        <AdCreateStep3 />
      </ToolShell>
    </RequireAuth>
  }
/>
<Route
  path="/ad/create/step-4"
  element={
    <RequireAuth>
      <ToolShell overlaySidebar>
        <AdCreateStep4 />
      </ToolShell>
    </RequireAuth>
  }
/>
<Route
  path="/ad/create/step-5"
  element={
    <RequireAuth>
      <ToolShell overlaySidebar>
        <AdCreateStep5 />
      </ToolShell>
    </RequireAuth>
  }
/>


<Route
  path="/myproduct/step1"
  element={
    <RequireAuth>
        <Step21 />
    </RequireAuth>
  }
/>
<Route
  path="/myproduct/step2"
  element={
    <RequireAuth>
        <Step31 />
    </RequireAuth>
  }
/>




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
          <Route path="/thumbnail" element={<ThumbnailGenerator />} />
          <Route path="/motivation" element={<MotivationalQuote />} />
          <Route path="/product" element={<Product />} />
          <Route path="/text-video" element={<TextVideo />} />
          <Route path="/cartoon-creator" element={<CartoonCreator />} />
          <Route path="/textstory" element={<TextLanding />} />
          <Route path="/imagestudio" element={<ImageStudio />} />
          <Route path="/imageenhancement" element={<ImageEnhancement />} />
          <Route path="/videostudio" element={<VideoStudio />} />
          <Route path="/storystudio" element={<StoryStudio />} />
          <Route path="/videoenhancement" element={<VideoEnhancement />} />
          <Route path="/comicstudio" element={<ComicStudio />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/prompt-library" element={<PromptLibrary />} />
          <Route path="/admin/feedback" element={<FeedbackAnalytics />} />

          {/* ---------- Tool pages (ToolShell) ---------- */}
          <Route
            path="/textimage"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <TextToImage />
                </ToolShell>
              </RequireAuth>
            }
          />

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
            path="/textvideo"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <TextToVideo />
                </ToolShell>
              </RequireAuth>
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

          <Route
            path="/ad-studio"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <AdStudio />
                </ToolShell>
              </RequireAuth>
            }
          />
          <Route
            path="/library"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <Library />
                </ToolShell>
              </RequireAuth>
            }
          />

          {/* ---------- Jobs / Dev ---------- */}
          <Route path="/dev/jobs" element={<JobsLab />} />
          <Route
            path="/jobs/:id"
            element={
              <RequireAuth>
                <ToolShell overlaySidebar>
                  <JobProgress />
                </ToolShell>
              </RequireAuth>
            }
          />

          {/* ---------- Image hub ---------- */}
          <Route path="/image-generator" element={<ImageGenerator />} />
          <Route
            path="/image"
            element={<Navigate to="/image-generator" replace />}
          />

          {/* ---------- Video generator + aliases ---------- */}
          <Route path="/video-generator" element={<VideoGenerator />} />
          <Route
            path="/videogenerator"
            element={<Navigate to="/video-generator" replace />}
          />
          <Route
            path="/tools/video-generator"
            element={<VideoGenerator />}
          />
          <Route
            path="/tools"
            element={<Navigate to="/tools/video-generator" replace />}
          />

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
      </main>
    </>
  );
}
