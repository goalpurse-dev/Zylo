// /auth/forgot — "Forgot password?" from the log-in page. The sign-in dialog
// shows the same view inside the dialog.
import { useLocation, useNavigate } from "react-router-dom";
import AuthPage from "../../components/auth/AuthPage.jsx";
import ForgotPassword from "../../components/auth/ForgotPassword.jsx";

export default function Forgot() {
  const navigate = useNavigate();
  const { state } = useLocation(); // { email } when the log-in page had one typed in
  return (
    <AuthPage title="Reset your password">
      <ForgotPassword initialEmail={state?.email ?? ""} onBack={() => navigate("/login")} />
    </AuthPage>
  );
}
