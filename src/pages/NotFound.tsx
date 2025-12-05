import { useLocation, Navigate } from "react-router-dom";
import { useEffect, useMemo } from "react";

const NotFound = () => {
  const location = useLocation();

  // Detect URL encoding issue: /analytics%3Fview=conversion should be /analytics?view=conversion
  const correctedUrl = useMemo(() => {
    if (location.pathname.includes('%3F')) {
      // Decode the pathname and reconstruct proper URL
      const decodedPath = decodeURIComponent(location.pathname);
      const questionMarkIndex = decodedPath.indexOf('?');
      if (questionMarkIndex !== -1) {
        const path = decodedPath.substring(0, questionMarkIndex);
        const search = decodedPath.substring(questionMarkIndex);
        return { pathname: path, search };
      }
    }
    return null;
  }, [location.pathname]);

  useEffect(() => {
    if (!correctedUrl) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname, correctedUrl]);

  // Auto-redirect if we detected an encoding issue
  if (correctedUrl) {
    return <Navigate to={correctedUrl} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/80">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
};

export default NotFound;
