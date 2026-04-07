import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { readMobileSession } from 'utils/mobile/session';

export default function MobileGuestGuard({ children }) {
  const navigate = useNavigate();
  const session = readMobileSession();

  useEffect(() => {
    if (session) {
      navigate('/mobile/select', { replace: true });
    }
  }, [session, navigate]);

  return session ? null : children;
}

MobileGuestGuard.propTypes = {
  children: PropTypes.any
};
