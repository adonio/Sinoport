import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import { APP_AUTH, AuthProvider } from 'config';

// ==============================|| AUTH GUARD ||============================== //

export default function AuthGuard({ children }) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const LOGIN_PATH = APP_AUTH === AuthProvider.JWT ? '/login' : `/${APP_AUTH.toLowerCase()}/login`;

  useEffect(() => {
    if (!isLoggedIn) {
      if (location.pathname !== LOGIN_PATH) {
        navigate(LOGIN_PATH, {
          state: {
            from: location.pathname
          },
          replace: true
        });
      }
    }
  }, [isLoggedIn, navigate, location.pathname, LOGIN_PATH]);

  return children;
}

AuthGuard.propTypes = { children: PropTypes.any };
