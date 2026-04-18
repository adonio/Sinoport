import { createContext, useEffect, useReducer } from 'react';

import { LOGIN, LOGOUT } from 'contexts/auth-reducer/actions';
import authReducer from 'contexts/auth-reducer/auth';

import Loader from 'components/Loader';
import {
  buildUserFromActor,
  canBootstrapLocalSession,
  clearStationSession,
  fetchStationMe,
  logoutStationSession,
  persistStationSession,
  readStoredActor,
  requestStationLogin,
  resolveStationApiBaseUrl
} from 'utils/stationApi';

const initialState = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

const JWTContext = createContext(null);

async function bootstrapLocalStationSession() {
  const baseURL = resolveStationApiBaseUrl();

  if (!canBootstrapLocalSession(baseURL)) {
    return null;
  }

  const data = await requestStationLogin({
    email: 'supervisor@sinoport.local',
    password: 'Sinoport123!',
    stationCode: 'MME'
  });

  return data;
}

export const JWTProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        let actor = readStoredActor();

        if (!actor) {
          const bootstrapped = await bootstrapLocalStationSession();
          if (bootstrapped?.token && bootstrapped?.actor) {
            persistStationSession(bootstrapped);
            actor = bootstrapped.actor;
          }
        }

        if (!actor) {
          dispatch({ type: LOGOUT });
          return;
        }

        const me = await fetchStationMe();
        const nextActor = me?.actor || actor;
        persistStationSession({ actor: nextActor });

        if (!mounted) return;

        dispatch({
          type: LOGIN,
          payload: {
            isLoggedIn: true,
            user: buildUserFromActor({
              ...nextActor,
              display_name: me?.user?.display_name,
              email: me?.user?.email
            })
          }
        });
      } catch {
        if (mounted) {
          clearStationSession();
          dispatch({ type: LOGOUT });
        }
      }
    };

    void initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const data = await requestStationLogin({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || '')
    });

    if (!data?.token || !data?.actor) {
      throw new Error('Station login failed');
    }

    persistStationSession(data);
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user: buildUserFromActor({
          ...data.actor,
          display_name: data.user?.display_name,
          email: data.user?.email
        })
      }
    });
  };

  const register = async (_email, password) => {
    throw new Error('Self registration is not available');
  };

  const logout = async () => {
    await logoutStationSession();
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
