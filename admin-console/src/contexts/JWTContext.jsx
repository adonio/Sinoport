import { createContext, useEffect, useReducer } from 'react';

import { LOGIN, LOGOUT } from 'contexts/auth-reducer/actions';
import authReducer from 'contexts/auth-reducer/auth';

import Loader from 'components/Loader';

const initialState = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

const demoUser = {
  id: 'sinoport-control',
  name: 'Sinoport Control',
  email: 'ops@sinoport.io',
  role: 'Platform Admin'
};

const JWTContext = createContext(null);

export const JWTProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user: demoUser
      }
    });
  }, []);

  const login = async () => {
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user: demoUser
      }
    });
  };

  const register = async () => {
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user: demoUser
      }
    });
  };

  const logout = () => {
    dispatch({ type: LOGOUT });
  };

  const resetPassword = async () => {};

  const updateProfile = () => {};

  if (state.isInitialized !== undefined && !state.isInitialized) {
    return <Loader />;
  }

  return <JWTContext value={{ ...state, login, logout, register, resetPassword, updateProfile }}>{children}</JWTContext>;
};

export default JWTContext;
