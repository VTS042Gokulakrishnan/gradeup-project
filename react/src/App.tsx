import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import Dashboard from "./pages/dashboard";
import AuthPage from "./pages/auth-page";
import CoursesPage from "./pages/courses-page";
import CourseLessonsPage from "./pages/course-lessons-page";
import ProgressPage from "./pages/progress-page";
import AITutorModern from "./pages/ai-tutor-modern";
import VoiceStudyCompanionV2 from "./pages/voice-study-companion-v2";
import VoiceStudyCompanionV3 from "./pages/voice-study-companion-v3";
import QuizPage from "./pages/quiz-page";
import HomeworkPage from "./pages/homework-page";
import TeacherHomeworkPage from "./pages/teacher-homework-page";
import TeacherPDFUpload from "./pages/teacher-pdf-upload";
import AnalyticsPage from "./pages/analytics-page";
import ContentManagerPage from "./pages/content-manager-page";
import EnhancedContentManager from "./pages/enhanced-content-manager";
import CommunityPage from "./pages/community-page-fixed";
import StudentsPage from "./pages/students-page";
import ProfilePage from "./pages/profile-page";
import SettingsPage from "./pages/settings-page";
import NotificationPage from "./pages/notification-page";
import ForgotPasswordPage from "./pages/forgot-password-page";
import CommunityNewPage from "./pages/CommunityPage";
import Landing from "./pages/landing";
import NotFound from "./pages/not-found";
import BookContentWindow from "./components/BookContentWindow/BookContentWindow";
import BookContentWindowDemo from "./components/BookContentWindow/BookContentWindowDemo";
import BookGallery from "./components/BookGallery";
import SeminarToolPage from "./pages/seminar-tool-page";
import DebateToolPage from "./pages/debate-tool-page";
import { ThemeProvider } from "./hooks/use-theme";
import StudioQuizPage from "./pages/studio/quiz-page";
import QuizBankLanding from "./pages/studio/QuizBankLanding";
import QuizBankPageNew from "./pages/studio/QuizBankPageNew";
import TestPrepPage from "./pages/studio/test-prep-page";
import QAPage from "./pages/studio/qa-page";
import PreparationExamPage from "./pages/preparation-exam-page";
import HomeworkHelperPage from "./pages/homework-helper-page";
import MainExamPage from "./pages/main-exam-page";
import AchievementsPage from './pages/achievements-page';
import QuestionBank from "./pages/studio/QuestionBank";
import EnhancedView from "./components/BookContentWindow/EnhancedView";
import ExamPreparationPage from "./pages/exam-preparation";
import CalendarPage from "./pages/calendar-page";
import { useAutoLogout } from "./hooks/useAutoLogout";
import { SessionTimeoutModal } from "./components/SessionTimeoutModal";
import MeetingSystem from "./components/Meetingsystem";
import DebatePage from "./pages/DebatePage";
import SeminarPage from "./pages/SeminarPage";
import MeetingPage from "./pages/MeetingPage";
import TeacherDashboard from "./components/teacher-dashboard";

const WARNING_SECONDS = 120;

function AppWithAuth() {
  const { user, logoutMutation, isLoading } = useAuth();
  const [location] = useLocation();
  const { warningVisible, secondsLeft, extendSession } = useAutoLogout({
    onLogout:       () => logoutMutation.mutate(),
    idleMinutes:    10,
    warningSeconds: WARNING_SECONDS,
    closeMinutes:   15,
    enabled:        !!user,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }
  return (
    <>
      <SessionTimeoutModal
        visible={warningVisible}
        secondsLeft={secondsLeft}
        totalSeconds={WARNING_SECONDS}
        onStay={extendSession}
        onLogout={() => logoutMutation.mutate()}
      />
      <Switch>
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/courses" component={CoursesPage} />
        <ProtectedRoute path="/courses/:courseId" component={CourseLessonsPage} />
        <ProtectedRoute path="/progress" component={ProgressPage} />
        <ProtectedRoute path="/achievements" component={AchievementsPage} />
        <ProtectedRoute path="/ai-tutor" component={AITutorModern} />
        <ProtectedRoute path="/voice-study-companion" component={VoiceStudyCompanionV3} />
        <ProtectedRoute path="/voice-study-companion-v2" component={VoiceStudyCompanionV2} />
        <ProtectedRoute path="/voice-study-companion-v3" component={VoiceStudyCompanionV3} />
        <Route path="/studio/question-bank" component={QuestionBank} />
        <ProtectedRoute path="/quiz" component={QuizPage} />
        <ProtectedRoute path="/homework" component={HomeworkPage} />
        <ProtectedRoute path="/homework-helper" component={HomeworkHelperPage} />
        <ProtectedRoute path="/teacher/homework" component={TeacherHomeworkPage} />
        <ProtectedRoute path="/teacher/pdf-upload" component={TeacherPDFUpload} />
        <ProtectedRoute path="/content-manager" component={ContentManagerPage} />
        <ProtectedRoute path="/enhanced-content-manager" component={EnhancedContentManager} />
        <ProtectedRoute path="/analytics" component={AnalyticsPage} />
        <ProtectedRoute path="/community" component={CommunityPage} />
        <ProtectedRoute path="/communityNew" component={CommunityNewPage} />
        <ProtectedRoute path="/preparation-exam" component={PreparationExamPage} />
        <ProtectedRoute path="/main-exam" component={MainExamPage} />
        <ProtectedRoute path="/students" component={StudentsPage} />
        <ProtectedRoute path="/teachers" component={TeacherDashboard} />

        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <ProtectedRoute path="/notifications" component={NotificationPage} />
        <Route path="/" component={Landing} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <ProtectedRoute path="/enhanced-view" component={EnhancedView} />
        {/* <ProtectedRoute path="/bookExpanded" component={BookContentWindow} /> */}
        <ProtectedRoute path="/bookExpanded" component={BookContentWindowDemo} />
        <ProtectedRoute path="/bookexpanded" component={BookContentWindow} />
        <ProtectedRoute path="/bookGallery" component={BookGallery} />
        <ProtectedRoute path="/seminar-tool" component={SeminarToolPage} />
        <ProtectedRoute path="/debate-tool" component={DebateToolPage} />
        <Route path="/debatePage" component={DebatePage} />
        <Route path="/debatePage/join" component={DebatePage} />
        <Route path="/debate/join" component={DebatePage} />
        <Route path="/seminarPage" component={SeminarPage} />
        <Route path="/seminarPage/join" component={SeminarPage} />
        <Route path="/seminar/join" component={SeminarPage} />
        <ProtectedRoute path="/meetingPage" component={MeetingPage} />
        <ProtectedRoute path="/studio/quiz/:id?" component={(params) => <StudioQuizPage id={params.id} />} />
        <ProtectedRoute path="/bookGuide" component={QuizBankLanding} />
        <ProtectedRoute path="/bookGuide/:type" component={(params) => <QuizBankPageNew type={params.type} />} />
        <ProtectedRoute path="/studio/test-prep" component={TestPrepPage} />
        <ProtectedRoute path="/studio/qa" component={QAPage} />
        <ProtectedRoute path="/exam-preparation" component={ExamPreparationPage} />
        <ProtectedRoute path="/calendar" component={CalendarPage} />
        <ProtectedRoute path="/meeting-system" component={MeetingSystem} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppWithAuth />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
