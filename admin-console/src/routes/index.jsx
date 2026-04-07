import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';

// project imports
import MainRoutes from './MainRoutes';
import LoginRoutes from './LoginRoutes';
import MobileRoutes from './MobileRoutes';
import { APP_DEFAULT_PATH } from 'config';

// ==============================|| ROUTING RENDER ||============================== //

const useHashRouter = import.meta.env.VITE_APP_USE_HASH_ROUTER === 'true';
const createRouter = useHashRouter ? createHashRouter : createBrowserRouter;

const router = createRouter(
  [
    {
      path: '/',
      element: <Navigate to={APP_DEFAULT_PATH} replace />
    },
    LoginRoutes,
    MobileRoutes,
    MainRoutes
  ],
  useHashRouter ? undefined : { basename: import.meta.env.VITE_APP_BASE_NAME }
);

export default router;
