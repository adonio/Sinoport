import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { readMobileSession } from 'utils/mobile/session';

export default function MobileAuthGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = readMobileSession();

  useEffect(() => {
    if (!session) {
      navigate('/mobile/login', {
        state: {
          from: location.pathname
        },
        replace: true
      });
    }
  }, [session, navigate, location]);

  return session ? children : null;
}

MobileAuthGuard.propTypes = {
  children: PropTypes.any
};
